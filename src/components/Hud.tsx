import { primeAudio } from '../audio/bell';
import type { GameAction, GameState } from '../game/reducer';
import { currentDirection } from '../game/reducer';
import { stopAt, stopShortName, totalRunStops } from '../game/selectors';
import { BRAND, inkForBackground } from '../brand';

interface HudProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

/** Slim top bar: identity + controls. Run metrics live in the floating StatCard. */
export function Hud({ state, dispatch }: HudProps) {
  const direction = currentDirection(state);
  const origin = stopAt(state, state.config.startStopIndex);
  const destination = stopAt(state, state.config.startStopIndex + totalRunStops(state) - 1);

  return (
    <header className="hud">
      <div className="hud-service-card">
        <span className="hud-monogram" aria-hidden="true">DM</span>
        <span className="brand brand-small">{BRAND}</span>
        <span
          className="route-badge"
          style={{
            background: state.route.route.color,
            color: inkForBackground(state.route.route.color),
          }}
        >
          {state.route.route.shortName}
        </span>
      </div>

      <div className="journey-board" aria-label={`${origin?.displayName} to ${destination?.displayName}`}>
        <div className="journey-terminal">
          <span>Boarding at</span>
          <strong>{origin ? stopShortName(origin) : 'Start'}</strong>
        </div>
        <div className="journey-board-line" aria-hidden="true">
          <i style={{ background: state.route.route.color }} />
          <small>{state.stopsCompleted}/{totalRunStops(state)} stops</small>
        </div>
        <div className="journey-terminal journey-terminal-end">
          <span>Bound for</span>
          <strong>{destination ? stopShortName(destination) : direction.headsign}</strong>
        </div>
      </div>

      <div className="hud-right">
        <button
          type="button"
          className="hud-button"
          aria-pressed={state.config.soundOn}
          aria-label={state.config.soundOn ? 'Turn sound off' : 'Turn sound on'}
          onClick={() => {
            if (!state.config.soundOn) primeAudio(true);
            dispatch({ type: 'TOGGLE_SOUND' });
            // Focus-restore exception button (PRD §6): act, then hand focus back.
            document.querySelector<HTMLInputElement>('.ghost-input')?.focus();
          }}
        >
          <span aria-hidden="true">{state.config.soundOn ? '🔔' : '🔕'}</span>
          <span className="hud-button-label">Sound</span>
        </button>
        <button
          type="button"
          className="hud-button"
          aria-label="Pause game"
          onClick={() => dispatch({ type: 'PAUSE', at: Date.now() })}
        >
          <span aria-hidden="true">Ⅱ</span>
          <span className="hud-button-label">Pause</span>
        </button>
      </div>
    </header>
  );
}
