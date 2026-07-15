import type { AvailableRoute } from '../data/routes';
import type { RouteData } from '../data/types';
import type { GameAction, GameState, Mode } from '../game/reducer';
import { directionIndexOf, SECTION_LENGTH } from '../game/reducer';
import { stopShortName } from '../game/selectors';
import { saveLastConfig, saveLastRouteId, saveSettings } from '../storage/local';
import { BRAND, TAGLINE } from '../brand';

interface ConfigScreenProps {
  routes: AvailableRoute[];
  route: RouteData;
  state: GameState;
  dispatch: (action: GameAction) => void;
}

const MODES: [Mode, string, string][] = [
  ['full-route', 'Full Route', 'Start to terminus'],
  ['section', `${SECTION_LENGTH}-Stop Section`, `Next ${SECTION_LENGTH} stops`],
  ['sprint', '60s Sprint', 'As many as you can'],
];

export function ConfigScreen({ routes, route, state, dispatch }: ConfigScreenProps) {
  const { config } = state;
  const direction = route.route.directions[directionIndexOf(state)];
  // Any stop except the terminus can be a start (a run needs ≥1 hop).
  const startableStops = direction.stops.slice(0, -1);

  const start = () => {
    saveLastRouteId(route.route.id);
    saveLastConfig(config);
    saveSettings({ soundOn: config.soundOn, difficulty: config.difficulty });
    dispatch({ type: 'START', at: Date.now() });
  };

  const startStop = route.stops[direction.stops[config.startStopIndex]];
  const runEndIndex =
    config.mode === 'section'
      ? Math.min(config.startStopIndex + SECTION_LENGTH - 1, direction.stops.length - 1)
      : direction.stops.length - 1;
  const endStop = route.stops[direction.stops[runEndIndex]];

  return (
    <main className="screen config-screen">
      <header className="config-hero">
        <p className="brand">{BRAND}</p>
        <h1>{TAGLINE}</h1>
        <p className="sub">Pick a route. Type every stop. Ring the bell.</p>
      </header>

      <section className="config-card" aria-label="Game setup">
        <fieldset>
          <legend>Route</legend>
          <div className="route-grid" role="radiogroup" aria-label="Route">
            {routes.map(({ data, totalStops }) => {
              const selected = data.route.id === route.route.id;
              return (
                <button
                  key={data.route.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? 'route-chip selected' : 'route-chip'}
                  style={selected ? { borderColor: data.route.color } : undefined}
                  onClick={() => dispatch({ type: 'SELECT_ROUTE', route: data })}
                >
                  <span className="route-badge" style={{ background: data.route.color }}>
                    {data.route.shortName}
                  </span>
                  <span className="route-chip-text">
                    <span className="route-chip-name">{data.route.longName}</span>
                    <span className="route-chip-meta">{totalStops} stops</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

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
                {i + 1}. {route.stops[stopId].displayName}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Mode</legend>
          <div className="option-row" role="radiogroup" aria-label="Mode">
            {MODES.map(([mode, label, hint]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={config.mode === mode}
                className={config.mode === mode ? 'option option-mode selected' : 'option option-mode'}
                onClick={() => dispatch({ type: 'CONFIGURE', patch: { mode } })}
              >
                <span className="option-mode-label">{label}</span>
                <span className="option-mode-hint">{hint}</span>
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
          <span className="journey-end">
            {startStop.stopNumber && <span className="roundel roundel-dark">#{startStop.stopNumber}</span>}
            {stopShortName(startStop)}
          </span>
          <span className="journey-arrow" style={{ color: route.route.color }}>
            {config.mode === 'sprint' ? '∞' : '⟶'}
          </span>
          <span className="journey-end">
            {config.mode === 'sprint' ? 'as far as you get' : stopShortName(endStop)}
            {config.mode !== 'sprint' && endStop.stopNumber && (
              <span className="roundel roundel-dark">#{endStop.stopNumber}</span>
            )}
          </span>
        </div>

        <button type="button" className="start-button" onClick={start}>
          RING TO START
        </button>
        <p className="start-hint">Type each stop name, then Enter or Space rings the bell</p>
      </section>

      <footer className="config-footer">
        <p>Independent fan-made project — not affiliated with Transport Victoria or Yarra Trams.</p>
        <p>
          Contains public transport data supplied by the Victorian Department of Transport and
          Planning, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
