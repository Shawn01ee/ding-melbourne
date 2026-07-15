import type { GameAction, GameState } from '../game/reducer';
import { currentDirection } from '../game/reducer';
import { BRAND } from '../brand';

interface HudProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

/** Slim top bar: identity + controls. Run metrics live in the floating StatCard. */
export function Hud({ state, dispatch }: HudProps) {
  const direction = currentDirection(state);

  return (
    <header className="hud">
      <div className="hud-left">
        <span className="brand brand-small">{BRAND}</span>
        <span className="route-badge" style={{ background: state.route.route.color }}>
          {state.route.route.shortName}
        </span>
        <span className="hud-headsign">→ {direction.headsign}</span>
      </div>

      <div className="hud-right">
        <button
          type="button"
          className="hud-button"
          aria-pressed={state.config.soundOn}
          aria-label={state.config.soundOn ? 'Turn sound off' : 'Turn sound on'}
          onClick={() => {
            dispatch({ type: 'TOGGLE_SOUND' });
            // Focus-restore exception button (PRD §6): act, then hand focus back.
            document.querySelector<HTMLInputElement>('.ghost-input')?.focus();
          }}
        >
          {state.config.soundOn ? '🔔' : '🔕'}
        </button>
        <button
          type="button"
          className="hud-button"
          aria-label="Pause game"
          onClick={() => dispatch({ type: 'PAUSE', at: Date.now() })}
        >
          ⏸
        </button>
      </div>
    </header>
  );
}
