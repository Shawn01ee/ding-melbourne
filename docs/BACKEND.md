# Phase 4 — Accounts & leaderboard (Supabase)

## Why Supabase (over Firebase)

- **Leaderboards are a ranking problem**, and Postgres SQL does ranking, "your
  rank", and per-route/mode/difficulty boards natively. Firestore (NoSQL) fights
  you on ordering and rank-of-document.
- **Server-side score validation** lives in a Postgres `SECURITY DEFINER`
  function + Row Level Security — no separate function deploy, and **no billing
  card required**. Firebase Cloud Functions require the paid Blaze plan.
- Standard Postgres = low lock-in; generous free tier (500 MB DB, 50k MAU).

## Anti-cheat model (v1)

The browser can never write to the `scores` table — RLS grants only `SELECT`.
Every submission goes through `submit_score()`, which:

1. requires an authenticated user and an existing profile,
2. rate-limits to 20 submissions/user/minute,
3. sanity-checks bounds (accuracy 0–100, wpm ≤ 400, time ≤ 1h, …),
4. **recomputes the score server-side** from the run components, so a tampered
   client cannot post an arbitrary score.

Future hardening (Phase 4.5): submit a signed keystroke/timing log and verify
the run server-side (replay), plus per-route min-time plausibility.

## One-time setup (≈5 min — needs your account)

1. Create a project at https://supabase.com (free tier). Note the **Project URL**
   and **anon public key** from *Settings → API*.
2. In *SQL Editor*, run [`supabase/migrations/0001_leaderboard.sql`](../supabase/migrations/0001_leaderboard.sql).
3. *Authentication → Providers*: enable **Email** (magic link) and optionally
   **Google** (needs a Google OAuth client id/secret). Add your site URL and
   `https://ding-melbourne.vercel.app` to *URL Configuration → Redirect URLs*.
4. Set env vars:
   - Local: copy `.env.example` → `.env.local`, fill both values.
   - Vercel: *Project → Settings → Environment Variables*, add
     `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.

That's it — send me the URL + anon key (or just confirm they're set) and I'll
wire up and test the sign-in, profile, submit-on-finish, and leaderboard UI
against the live project.

## Client layer

`src/backend/leaderboard.ts` is already written and **env-gated**: with no env
vars it is inert (tree-shaken out; the game is unchanged). Once configured it
exposes `signIn*`, `saveProfileName`, `submitScore`, and `fetchTopScores`.
