import type { RouteData } from '../data/types';
import type { GameAction, GameState } from '../game/reducer';
import { directionIndexOf } from '../game/reducer';
import { stopShortName } from '../game/selectors';
import { saveLastConfig, saveSettings } from '../storage/local';
import { BRAND, TAGLINE } from '../brand';

interface ConfigScreenProps {
  route: RouteData;
  state: GameState;
  dispatch: (action: GameAction) => void;
}

export function ConfigScreen({ route, state, dispatch }: ConfigScreenProps) {
  const { config } = state;
  const direction = route.route.directions[directionIndexOf(state)];
  const startableStops = direction.stops.slice(0, -1);

  const start = () => {
    saveLastConfig(config);
    saveSettings({ soundOn: config.soundOn, difficulty: config.difficulty });
    dispatch({ type: 'START', at: Date.now() });
  };

  return (
    <main className="screen config-screen">
      <header className="config-hero">
        <p className="brand">{BRAND}</p>
        <h1>{TAGLINE}</h1>
        <p className="sub">Pick a route. Type every stop. Ring the bell.</p>
      </header>

      <section className="config-card" aria-label="Game setup">
        <div className="route-card" style={{ borderColor: route.route.color }}>
          <span className="route-badge" style={{ background: route.route.color }}>
            {route.route.shortName}
          </span>
          <span className="route-name">{route.route.longName}</span>
        </div>

        <fieldset>
          <legend>Direction</legend>
          <div className="option-row" role="radiogroup" aria-label="Direction">
            {route.route.directions.map((dir) => (
              <button
                key={dir.id}
                type="button"
                role="radio"
                aria-checked={config.directionId === dir.id}
                className={config.directionId === dir.id ? 'option selected' : 'option'}
                onClick={() => dispatch({ type: 'CONFIGURE', patch: { directionId: dir.id } })}
              >
                → {dir.headsign}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <label htmlFor="start-stop">Start stop</label>
          </legend>
          <select
            id="start-stop"
            value={config.startStopIndex}
            onChange={(e) =>
              dispatch({ type: 'CONFIGURE', patch: { startStopIndex: Number(e.target.value) } })
            }
          >
            {startableStops.map((stopId, i) => (
              <option key={stopId} value={i}>
                {route.stops[stopId].displayName}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Mode</legend>
          <div className="option-row" role="radiogroup" aria-label="Mode">
            {(
              [
                ['full-route', 'Full Route'],
                ['sprint', '60-second Sprint'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={config.mode === mode}
                className={config.mode === mode ? 'option selected' : 'option'}
                onClick={() => dispatch({ type: 'CONFIGURE', patch: { mode } })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Difficulty</legend>
          <div className="option-row" role="radiogroup" aria-label="Difficulty">
            {(
              [
                ['easy', 'Easy'],
                ['standard', 'Standard'],
                ['driver', 'Driver'],
              ] as const
            ).map(([difficulty, label]) => (
              <button
                key={difficulty}
                type="button"
                role="radio"
                aria-checked={config.difficulty === difficulty}
                className={config.difficulty === difficulty ? 'option selected' : 'option'}
                onClick={() => dispatch({ type: 'CONFIGURE', patch: { difficulty } })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Sound</legend>
          <button
            type="button"
            className="option"
            aria-pressed={config.soundOn}
            onClick={() => dispatch({ type: 'CONFIGURE', patch: { soundOn: !config.soundOn } })}
          >
            {config.soundOn ? '🔔 Bell on' : '🔕 Bell off'}
          </button>
        </fieldset>

        <div className="journey-row" aria-label="Selected journey">
          {(() => {
            const startStop = route.stops[direction.stops[config.startStopIndex]];
            const terminus = route.stops[direction.stops[direction.stops.length - 1]];
            return (
              <>
                <span className="journey-end">
                  {startStop.stopNumber && (
                    <span className="roundel roundel-dark">#{startStop.stopNumber}</span>
                  )}
                  {stopShortName(startStop)}
                </span>
                <span className="journey-arrow" style={{ color: route.route.color }}>
                  ⟶
                </span>
                <span className="journey-end">
                  {stopShortName(terminus)}
                  {terminus.stopNumber && (
                    <span className="roundel roundel-dark">#{terminus.stopNumber}</span>
                  )}
                </span>
              </>
            );
          })()}
        </div>

        <button type="button" className="start-button" onClick={start}>
          RING TO START
        </button>
        <p className="start-hint">Type each stop name, then Enter or Space rings the bell</p>
      </section>

      <footer className="config-footer">
        <p>
          Independent fan-made project — not affiliated with Transport Victoria or Yarra Trams.
        </p>
        <p>
          Contains public transport data supplied by the Victorian Department of Transport and
          Planning, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          . Current build uses a small hand-made development fixture.
        </p>
      </footer>
    </main>
  );
}
