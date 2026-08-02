import { ghostGapMs, mapProgressOf, type Ghost } from '../game/ghost';
import type { GameState } from '../game/reducer';
import {
  elapsedMs,
  formatClock,
  remainingMs,
  totalRunStops,
  wpmOf,
} from '../game/selectors';

/** Compact live metrics. Detailed accuracy and score belong on the result card. */
export function StatCard({ state, ghost = null }: { state: GameState; ghost?: Ghost | null }) {
  const sprint = state.config.mode === 'sprint';
  const clock = sprint ? remainingMs(state) : elapsedMs(state);
  // Time-attack gap: how far ahead/behind your own best run you are right now.
  const gap = ghostGapMs(ghost, mapProgressOf(state), elapsedMs(state));

  return (
    <dl className="stat-card">
      {gap !== null && (
        <div className={`hud-stat stat-ghost ${gap >= 0 ? 'ahead' : 'behind'}`}>
          <dt>vs ghost</dt>
          <dd>
            {gap >= 0 ? '−' : '+'}
            {(Math.abs(gap) / 1000).toFixed(1)}s
          </dd>
        </div>
      )}
      <div className={`hud-stat stat-clock${sprint ? ' hud-timer' : ''}`}>
        <dt>{sprint ? 'Remaining' : 'Time'}</dt>
        <dd>{formatClock(clock)}</dd>
      </div>
      <div className="hud-stat">
        <dt>Stops</dt>
        <dd>{state.stopsCompleted}/{totalRunStops(state)}</dd>
      </div>
      <div className="hud-stat stat-combo">
        <dt>Combo</dt>
        <dd key={state.streak} className={state.streak > 0 ? 'combo-pop' : undefined}>
          {state.streak}
        </dd>
      </div>
      <div className="hud-stat">
        <dt>WPM</dt>
        <dd>{wpmOf(state).toFixed(0)}</dd>
      </div>
    </dl>
  );
}
