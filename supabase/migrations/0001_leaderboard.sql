-- DING! MELBOURNE — leaderboard schema (v1)
-- Apply in the Supabase SQL editor (or `supabase db push`).
--
-- Design: the browser NEVER writes to the scores table directly. RLS grants
-- only SELECT; all inserts go through submit_score(), a SECURITY DEFINER RPC
-- that authenticates, rate-limits, sanity-checks, and RECOMPUTES the score
-- server-side so a tampered client cannot inflate the board.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are public read" on public.profiles;
create policy "profiles are public read" on public.profiles for select using (true);

drop policy if exists "user manages own profile" on public.profiles;
create policy "user manages own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- scores ----------
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  route_short text not null,
  direction_id text not null,
  mode text not null check (mode in ('full-route', 'section', 'sprint')),
  difficulty text not null check (difficulty in ('standard', 'driver')),
  start_stop_index int not null default 0,
  stops int not null,
  time_ms int not null,
  wpm real not null,
  accuracy real not null,
  score int not null,
  best_streak int not null default 0,
  errors int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

drop policy if exists "scores are public read" on public.scores;
create policy "scores are public read" on public.scores for select using (true);
-- No insert/update/delete policy: direct client writes are impossible.

create index if not exists scores_board_idx
  on public.scores (route_short, mode, difficulty, direction_id, score desc, time_ms asc);
create index if not exists scores_user_idx
  on public.scores (user_id, created_at desc);

-- ---------- submit_score (validated insert) ----------
create or replace function public.submit_score(
  p_route_short text,
  p_direction_id text,
  p_mode text,
  p_difficulty text,
  p_start_stop_index int,
  p_stops int,
  p_time_ms int,
  p_wpm real,
  p_accuracy real,
  p_best_streak int,
  p_errors int
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recent int;
  v_score int;
  v_id bigint;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  -- A profile (display name) must exist before a score can appear on the board.
  if not exists (select 1 from profiles where id = v_uid) then
    raise exception 'profile required';
  end if;

  -- Rate limit: at most 20 submissions per user per minute.
  select count(*) into v_recent from scores
    where user_id = v_uid and created_at > now() - interval '1 minute';
  if v_recent >= 20 then raise exception 'rate limited'; end if;

  -- Sanity bounds (cheap first line of defence; replay verification is future work).
  if p_mode not in ('full-route', 'section', 'sprint') then raise exception 'bad mode'; end if;
  if p_difficulty not in ('standard', 'driver') then raise exception 'bad difficulty'; end if;
  if p_accuracy < 0 or p_accuracy > 100 then raise exception 'bad accuracy'; end if;
  if p_wpm < 0 or p_wpm > 400 then raise exception 'bad wpm'; end if;
  if p_stops < 0 or p_stops > 200 then raise exception 'bad stops'; end if;
  if p_time_ms < 0 or p_time_ms > 3600000 then raise exception 'bad time'; end if;
  if p_best_streak < 0 or p_best_streak > 400 then raise exception 'bad streak'; end if;
  if p_errors < 0 or p_errors > 100000 then raise exception 'bad errors'; end if;

  -- Recompute the score from components (mirrors src/game/scoring.ts) so the
  -- client cannot submit an arbitrary score value.
  v_score := greatest(0, p_stops * 100 + p_best_streak * 20 + round(p_wpm)::int * 2 - p_errors * 5);

  insert into scores (
    user_id, route_short, direction_id, mode, difficulty, start_stop_index,
    stops, time_ms, wpm, accuracy, score, best_streak, errors
  ) values (
    v_uid, p_route_short, p_direction_id, p_mode, p_difficulty, coalesce(p_start_stop_index, 0),
    p_stops, p_time_ms, p_wpm, p_accuracy, v_score, p_best_streak, p_errors
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_score(text, text, text, text, int, int, int, real, real, int, int) from public;
grant execute on function public.submit_score(text, text, text, text, int, int, int, real, real, int, int) to authenticated;

-- ---------- top_scores (best row per user, ranked) ----------
create or replace function public.top_scores(
  p_route_short text,
  p_direction_id text,
  p_mode text,
  p_difficulty text,
  p_limit int default 50
) returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  score int,
  time_ms int,
  wpm real,
  accuracy real,
  stops int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (s.user_id) s.*
    from scores s
    where s.route_short = p_route_short
      and s.direction_id = p_direction_id
      and s.mode = p_mode
      and s.difficulty = p_difficulty
    order by s.user_id,
      -- Sprint: more stops (then faster WPM). Otherwise: fastest clear time.
      case when p_mode = 'sprint' then s.stops end desc nulls last,
      case when p_mode = 'sprint' then s.wpm end desc nulls last,
      case when p_mode <> 'sprint' then s.time_ms end asc nulls last
  )
  select
    row_number() over (
      order by
        case when p_mode = 'sprint' then b.stops end desc nulls last,
        case when p_mode = 'sprint' then b.wpm end desc nulls last,
        case when p_mode <> 'sprint' then b.time_ms end asc nulls last
    ) as rank,
    b.user_id, p.display_name, b.score, b.time_ms, b.wpm, b.accuracy, b.stops, b.created_at
  from best b
  join profiles p on p.id = b.user_id
  order by rank
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.top_scores(text, text, text, text, int) to anon, authenticated;
