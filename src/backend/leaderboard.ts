import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { GameConfig } from '../game/reducer';

/**
 * Env-gated Supabase leaderboard layer. When VITE_SUPABASE_URL / _ANON_KEY are
 * absent the whole feature is off and the game plays exactly as before with
 * local personal bests only. The client is dynamically imported so it never
 * ships in the bundle unless the backend is configured.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backendEnabled = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

async function getClient(): Promise<SupabaseClient> {
  if (!backendEnabled) throw new Error('Leaderboard backend is not configured.');
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }),
    );
  }
  return clientPromise;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  timeMs: number;
  wpm: number;
  accuracy: number;
  stops: number;
  createdAt: string;
}

export interface RunResult {
  stops: number;
  timeMs: number;
  wpm: number;
  accuracy: number;
  bestStreak: number;
  errors: number;
}

export interface AccountInfo {
  id: string;
  email: string | null;
  provider: string | null;
  avatarUrl: string | null;
  fullName: string | null;
}

function toAccount(user: User): AccountInfo {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    provider: (user.app_metadata?.provider as string | undefined) ?? 'email',
    avatarUrl: (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null,
    fullName: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
  };
}

export async function getAccount(): Promise<AccountInfo | null> {
  if (!backendEnabled) return null;
  const client = await getClient();
  const { data } = await client.auth.getUser();
  return data.user ? toAccount(data.user) : null;
}

/** Delete the caller's public profile and every score, then sign out. */
export async function deleteMyData(): Promise<void> {
  const client = await getClient();
  const { error } = await client.rpc('delete_my_data');
  if (error) throw error;
  await client.auth.signOut();
}

export async function onAuthChange(cb: (account: AccountInfo | null) => void): Promise<() => void> {
  if (!backendEnabled) return () => {};
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((_event, session) =>
    cb(session?.user ? toAccount(session.user) : null),
  );
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<void> {
  const client = await getClient();
  await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
}

export async function signInWithEmail(email: string): Promise<void> {
  const client = await getClient();
  await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
}

export async function signOut(): Promise<void> {
  const client = await getClient();
  await client.auth.signOut();
}

/** Read the caller's public display name, if a profile row exists. */
export async function getProfileName(): Promise<string | null> {
  if (!backendEnabled) return null;
  const client = await getClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data } = await client.from('profiles').select('display_name').eq('id', auth.user.id).maybeSingle();
  return data?.display_name ?? null;
}

/** Create or rename the caller's public profile (required before submitting). */
export async function saveProfileName(displayName: string): Promise<void> {
  const client = await getClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Sign in first.');
  const { error } = await client
    .from('profiles')
    .upsert({ id: auth.user.id, display_name: displayName.trim() });
  if (error) throw error;
}

/** Submit a finished run through the validated RPC. Returns false if signed out. */
export async function submitScore(
  routeShort: string,
  config: GameConfig,
  result: RunResult,
): Promise<boolean> {
  if (!backendEnabled) return false;
  const client = await getClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return false;
  const { error } = await client.rpc('submit_score', {
    p_route_short: routeShort,
    p_direction_id: config.directionId,
    p_mode: config.mode,
    p_difficulty: config.difficulty,
    p_start_stop_index: config.startStopIndex,
    p_stops: result.stops,
    p_time_ms: Math.round(result.timeMs),
    p_wpm: result.wpm,
    p_accuracy: result.accuracy,
    p_best_streak: result.bestStreak,
    p_errors: result.errors,
  });
  if (error) throw error;
  return true;
}

export async function fetchTopScores(params: {
  routeShort: string;
  directionId: string;
  mode: string;
  difficulty: string;
  limit?: number;
}): Promise<LeaderboardEntry[]> {
  if (!backendEnabled) return [];
  const client = await getClient();
  const { data, error } = await client.rpc('top_scores', {
    p_route_short: params.routeShort,
    p_direction_id: params.directionId,
    p_mode: params.mode,
    p_difficulty: params.difficulty,
    p_limit: params.limit ?? 50,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    rank: Number(row.rank),
    userId: String(row.user_id),
    displayName: String(row.display_name),
    score: Number(row.score),
    timeMs: Number(row.time_ms),
    wpm: Number(row.wpm),
    accuracy: Number(row.accuracy),
    stops: Number(row.stops),
    createdAt: String(row.created_at),
  }));
}
