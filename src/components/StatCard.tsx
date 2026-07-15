import type { GameState } from '../game/reducer';
import {
  accuracyOf,
  elapsedMs,
  formatClock,
  remainingMs,
  totalRunStops,
  wpmOf,
} from '../game/selectors';

const GAUGE_MAX_WPM = 150;

/** Floating run-stats card over the map: WPM gauge, clock, mini metrics. */
export function StatCard({ state }: { state: GameState }) {
  const sprint = state.config.mode === 'sprint';
  const clock = sprint ? remainingMs(state) : elapsedMs(state);
  const wpmValue = wpmOf(state);
  const needleAngle = (Math.min(wpmValue, GAUGE_MAX_WPM) / GAUGE_MAX_WPM) * 180 - 90;

  return (
    <dl className="stat-card">
      <div className="gauge">
        <svg viewBox="0 0 80 48" aria-hidden="true">
          <path className="gauge-track" d="M9 42 A31 31 0 0 1 71 42" />
          <line
            className="gauge-needle"
            x1="40"
            y1="42"
            x2="40"
            y2="16"
            transform={`rotate(${needleAngle} 40 42)`}
          />
          <circle className="gauge-hub" cx="40" cy="42" r="4" />
        </svg>
        <div className="hud-stat">
          <dt>WPM</dt>
          <dd>{wpmValue.toFixed(0)}</dd>
        </div>
      </div>

      <div className={`hud-stat stat-clock${sprint ? ' hud-timer' : ''}`}>
        <dt>{sprint ? 'Left' : 'Time'}</dt>
        <dd>{formatClock(clock)}</dd>
      </div>

      <div className="stat-minis">
        <div className="hud-stat">
          <dt>Stops</dt>
          <dd>
            {state.stopsCompleted}/{totalRunStops(state)}
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Accuracy</dt>
          <dd>{accuracyOf(state).toFixed(0)}%</dd>
        </div>
        <div className="hud-stat">
          <dt>Streak</dt>
          <dd>{state.streak}</dd>
        </div>
      </div>
    </dl>
  );
}
