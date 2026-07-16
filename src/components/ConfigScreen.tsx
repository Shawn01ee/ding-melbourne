import { useEffect, useRef, type CSSProperties } from 'react';
import { primeAudio } from '../audio/bell';
import { NetworkOverview } from './NetworkOverview';
import { ThemeToggle } from './ThemeToggle';
import type { AvailableRoute } from '../data/routes';
import type { RouteData } from '../data/types';
import type { GameAction, GameState, Mode } from '../game/reducer';
import { directionIndexOf, SECTION_LENGTH } from '../game/reducer';
import { stopShortName } from '../game/selectors';
import { saveLastConfig, saveLastRouteId, saveSettings, type ColorTheme } from '../storage/local';
import { BRAND, TAGLINE, inkForBackground } from '../brand';

interface ConfigScreenProps {
  routes: AvailableRoute[];
  route: RouteData;
  state: GameState;
  dispatch: (action: GameAction) => void;
  theme: ColorTheme;
  networkOpen: boolean;
  onToggleTheme: () => void;
  onOpenNetwork: () => void;
  onCloseNetwork: () => void;
}

const MODES: [Mode, string, string][] = [
  ['full-route', 'Full Route', 'Start to terminus'],
  ['section', `${SECTION_LENGTH}-Stop Section`, `Next ${SECTION_LENGTH} stops`],
  ['sprint', '60s Sprint', 'As many as you can'],
];

export function ConfigScreen({
  routes,
  route,
  state,
  dispatch,
  theme,
  networkOpen,
  onToggleTheme,
  onOpenNetwork,
  onCloseNetwork,
}: ConfigScreenProps) {
  const { config } = state;
  const selectedRouteRef = useRef<HTMLButtonElement>(null);
  const direction = route.route.directions[directionIndexOf(state)];
  // Any stop except the terminus can be a start (a run needs ≥1 hop).
  const startableStops = direction.stops.slice(0, -1);

  useEffect(() => {
    selectedRouteRef.current?.scrollIntoView({ block: 'nearest' });
  }, [route.route.id]);

  const start = () => {
    // Prime Web Audio while this trusted click is active. Later typing cues
    // can then respond immediately even under strict autoplay policies.
    primeAudio(config.soundOn);
    saveLastRouteId(route.route.id);
    saveLastConfig(config);
    saveSettings({ soundOn: config.soundOn, difficulty: config.difficulty });
    onCloseNetwork();
    dispatch({ type: 'START', at: Date.now() });
  };

  const startStop = route.stops[direction.stops[config.startStopIndex]];
  const runEndIndex =
    config.mode === 'section'
      ? Math.min(config.startStopIndex + SECTION_LENGTH - 1, direction.stops.length - 1)
      : direction.stops.length - 1;
  const endStop = route.stops[direction.stops[runEndIndex]];

  return (
    <main
      className="screen config-screen"
      style={{ '--route-color': route.route.color } as CSSProperties}
    >
      <svg
        className="config-network"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d="M-80 730 L245 585 L455 610 L735 430 L1060 485 L1510 245" />
        <path d="M-40 210 L315 185 L565 325 L800 250 L1010 80 L1490 155" />
        <path d="M120 -50 L255 245 L190 470 L395 730 L420 960" />
        <path d="M1040 -70 L980 225 L1110 520 L1025 950" />
        <path d="M-70 470 L280 305 L620 315 L910 590 L1450 690" />
      </svg>

      <div className="config-utilities" aria-label="Display controls">
        <button type="button" className="network-open" onClick={onOpenNetwork}>
          <span aria-hidden="true">⌘</span>
          <span>Network map</span>
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <header className="config-hero">
        <p className="config-kicker">Melbourne tram typing game</p>
        <p className="brand config-brand">{BRAND}</p>
        <h1 aria-label={TAGLINE}>
          <span>MISS YOUR</span>
          <span>STOP? DON'T</span>
          <span>MISS THE</span>
          <span>SPELLING.</span>
        </h1>
        <p className="sub">Pick a line, learn the stops, and drive it one perfect word at a time.</p>

        <div className="journey-preview" aria-label="Selected journey">
          <span
            className="journey-route"
            style={{
              background: route.route.color,
              color: inkForBackground(route.route.color),
            }}
          >
            {route.route.shortName}
          </span>
          <span className="journey-preview-stop">
            <small>BOARD AT</small>
            <strong>{stopShortName(startStop)}</strong>
          </span>
          <span className="journey-preview-line" aria-hidden="true">
            <i />
          </span>
          <span className="journey-preview-stop journey-preview-stop-end">
            <small>{config.mode === 'sprint' ? 'GO FOR' : 'BOUND FOR'}</small>
            <strong>{config.mode === 'sprint' ? '60 seconds' : stopShortName(endStop)}</strong>
          </span>
        </div>

        <p className="config-instruction">
          <kbd>TYPE</kbd> the stop · wrong keys do not stick · every clear rings the bell
        </p>
      </header>

      <section className="config-card" aria-label="Game setup">
        <fieldset>
          <legend>
            Route <span className="route-count">{routes.length} lines</span>
          </legend>
          <div className="route-grid" role="radiogroup" aria-label="Route">
            {routes.map(({ data, totalStops }) => {
              const selected = data.route.id === route.route.id;
              return (
                <button
                  key={data.route.id}
                  ref={selected ? selectedRouteRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? 'route-chip selected' : 'route-chip'}
                  style={selected ? { borderColor: data.route.color } : undefined}
                  onClick={() => dispatch({ type: 'SELECT_ROUTE', route: data })}
                >
                  <span
                    className="route-badge"
                    style={{
                      background: data.route.color,
                      color: inkForBackground(data.route.color),
                    }}
                  >
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

        <div className="config-field-row">
          <fieldset>
            <legend>Difficulty</legend>
            <div className="option-row" role="radiogroup" aria-label="Difficulty">
              {(
                [
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

          <fieldset className="sound-field">
            <legend>Sound</legend>
            <button
              type="button"
              className="option sound-option"
              aria-pressed={config.soundOn}
              onClick={() => dispatch({ type: 'CONFIGURE', patch: { soundOn: !config.soundOn } })}
            >
              {config.soundOn ? '🔔 Bell on' : '🔕 Bell off'}
            </button>
          </fieldset>
        </div>

        <button type="button" className="start-button" onClick={start}>
          <span>RING TO START</span>
          <span aria-hidden="true">→</span>
        </button>
        <p className="start-hint">Route {route.route.shortName} · {direction.headsign} · {startableStops.length + 1} stops</p>
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

      {networkOpen && (
        <NetworkOverview
          routes={routes}
          selectedRouteId={route.route.id}
          onSelect={(selected) => {
            dispatch({ type: 'SELECT_ROUTE', route: selected });
            onCloseNetwork();
          }}
          onClose={onCloseNetwork}
        />
      )}
    </main>
  );
}
