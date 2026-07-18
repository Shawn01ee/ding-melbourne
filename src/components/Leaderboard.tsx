import { useEffect, useState } from 'react';
import type { AuthState } from '../backend/useAuth';
import { fetchTopScores, submitScore, type LeaderboardEntry } from '../backend/leaderboard';
import type { GameConfig } from '../game/reducer';
import { formatClock } from '../game/selectors';

interface LeaderboardProps {
  auth: AuthState;
  routeShort: string;
  config: GameConfig;
  /** The just-finished run, submitted once when the player is signed in. */
  result: { stops: number; timeMs: number; wpm: number; accuracy: number; bestStreak: number; errors: number };
}

/** Pure list — easy to unit test with mock rows. */
export function LeaderboardList({
  entries,
  mode,
  meId,
}: {
  entries: LeaderboardEntry[];
  mode: string;
  meId: string | null;
}) {
  const sprint = mode === 'sprint';
  return (
    <ol className="leaderboard-list">
      {entries.map((e) => (
        <li key={e.userId} className={e.userId === meId ? 'leaderboard-row me' : 'leaderboard-row'}>
          <span className="lb-rank">{e.rank}</span>
          <span className="lb-name">{e.displayName}</span>
          <span className="lb-metric">{sprint ? `${e.stops} stops` : formatClock(e.timeMs)}</span>
          <span className="lb-sub">{e.wpm.toFixed(0)} wpm</span>
        </li>
      ))}
    </ol>
  );
}

/** Handles the sign-in / name / submit / fetch flow on the result screen. */
export function Leaderboard({ auth, routeShort, config, result }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [nameDraft, setNameDraft] = useState('');
  const needsName = auth.signedIn && !auth.displayName;

  useEffect(() => {
    if (!auth.enabled) return;
    let active = true;
    void (async () => {
      try {
        if (auth.signedIn && auth.displayName) {
          setStatus('working');
          await submitScore(routeShort, config, result);
        }
        const rows = await fetchTopScores({
          routeShort,
          directionId: config.directionId,
          mode: config.mode,
          difficulty: config.difficulty,
          limit: 10,
        });
        if (active) {
          setEntries(rows);
          setStatus('idle');
        }
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
    // Re-run once the player gains a display name (first-time sign-in).
  }, [auth.enabled, auth.signedIn, auth.displayName, routeShort, config, result]);

  if (!auth.enabled) return null;

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <h2 className="leaderboard-title">
        Leaderboard <span>Route {routeShort}</span>
      </h2>

      {!auth.signedIn && (
        <button type="button" className="auth-google" onClick={() => void auth.signIn()}>
          <span className="auth-g" aria-hidden="true">G</span>
          Sign in with Google to post your score
        </button>
      )}

      {needsName && (
        <form
          className="leaderboard-name"
          onSubmit={(e) => {
            e.preventDefault();
            const name = nameDraft.trim();
            if (name.length >= 2) void auth.setDisplayName(name);
          }}
        >
          <label htmlFor="lb-name">Choose a leaderboard name</label>
          <div>
            <input
              id="lb-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={24}
              minLength={2}
              placeholder="e.g. Tram Ace"
              autoComplete="off"
            />
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {status === 'error' && <p className="leaderboard-note">Couldn't reach the leaderboard.</p>}

      {entries && entries.length > 0 ? (
        <LeaderboardList entries={entries} mode={config.mode} meId={auth.userId} />
      ) : (
        status !== 'error' && <p className="leaderboard-note">Be the first to post a time here.</p>
      )}
    </section>
  );
}
