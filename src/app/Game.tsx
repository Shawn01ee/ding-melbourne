import { useEffect, useMemo, useReducer, useRef } from 'react';
import { approachCue, errorTick, keyTick, stopArrivalCue } from '../audio/bell';
import { ConfigScreen } from '../components/ConfigScreen';
import { CountdownScreen } from '../components/CountdownScreen';
import { Hud } from '../components/Hud';
import { ResultScreen } from '../components/ResultScreen';
import { StopConsole } from '../components/StopConsole';
import type { AvailableRoute } from '../data/routes';
import { directionIndexOf, initialState, reducer, targetText } from '../game/reducer';
import { RouteCanvas } from '../map/RouteCanvas';
import { loadLastConfig, loadLastRouteId, loadSettings } from '../storage/local';

export function Game({ routes }: { routes: AvailableRoute[] }) {
  const [state, dispatch] = useReducer(
    reducer,
    routes,
    (list) => {
      const lastId = loadLastRouteId();
      const route = list.find((r) => r.data.route.id === lastId)?.data ?? list[0].data;
      const saved = { ...loadSettings(), ...loadLastConfig() };
      const validDirection = route.route.directions.some((d) => d.id === saved.directionId);
      if (!validDirection) delete saved.directionId;
      return initialState(route, saved);
    },
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const route = state.route;
  const networkRoutes = useMemo(() => routes.map((available) => available.data), [routes]);

  const inGame = state.phase === 'typing' || state.phase === 'paused';
  const target = targetText(state);
  const typedProgress = target.length > 0 ? [...state.input].length / [...target].length : 0;

  // Concise, browser-readable state for visual regression and accessibility
  // tooling. The SVG uses a follow camera, so route order is more useful than
  // raw screen coordinates here.
  useEffect(() => {
    const testWindow = window as Window & { render_game_to_text?: () => string };
    testWindow.render_game_to_text = () => {
      const direction = route.route.directions[directionIndexOf(state)];
      const stopId = direction.stops[state.stopIndex];
      const stop = route.stops[stopId];
      return JSON.stringify({
        phase: state.phase,
        route: route.route.shortName,
        headsign: direction.headsign,
        mode: state.config.mode,
        difficulty: state.config.difficulty,
        stopIndex: state.stopIndex,
        stopCount: direction.stops.length,
        currentStop: stop?.displayName ?? null,
        target,
        input: state.input,
        typedProgress: Number(typedProgress.toFixed(3)),
        stopsCompleted: state.stopsCompleted,
        combo: state.streak,
        bestCombo: state.bestStreak,
        errors: state.errors,
        note: 'Each correct character raises combo and moves the tram. A miss resets combo but does not stick; a completed stop opens the next target immediately.',
      });
    };
    return () => {
      delete testWindow.render_game_to_text;
    };
  }, [route, state]);

  // Clock tick while a run is live.
  useEffect(() => {
    if (!inGame || state.phase === 'paused') return;
    const timer = setInterval(() => dispatch({ type: 'TICK', at: Date.now() }), 200);
    return () => clearInterval(timer);
  }, [inGame, state.phase]);

  // Auto-pause when the tab hides (PRD §6).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: 'PAUSE', at: Date.now() });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A completed stop gets its own arrival response. Progression is never
  // delayed by audio or map animation, so fast typists can keep typing.
  const prevStopsRef = useRef(state.stopsCompleted);
  useEffect(() => {
    const added = state.stopsCompleted - prevStopsRef.current;
    prevStopsRef.current = state.stopsCompleted;
    if (added > 0) {
      stopArrivalCue(state.config.soundOn, state.phase === 'finished', state.stopsCompleted);
    }
  }, [state.stopsCompleted, state.config.soundOn, state.phase]);

  // Per-keystroke ticks: light click for a correct key, low thud for an error.
  const prevKeysRef = useRef(state.totalKeystrokes);
  const prevErrorsRef = useRef(state.errors);
  const prevKeyAtRef = useRef(state.now);
  const prevProgressRef = useRef(typedProgress);
  const prevStopIndexRef = useRef(state.stopIndex);
  useEffect(() => {
    const addedKeys = state.totalKeystrokes - prevKeysRef.current;
    const addedErrors = state.errors - prevErrorsRef.current;
    prevKeysRef.current = state.totalKeystrokes;
    prevErrorsRef.current = state.errors;
    if (addedKeys <= 0) {
      if (addedKeys < 0) {
        prevKeyAtRef.current = state.now;
        prevProgressRef.current = typedProgress;
        prevStopIndexRef.current = state.stopIndex;
      }
      return;
    }

    const cadenceMs = Math.max(24, state.now - prevKeyAtRef.current);
    const sameStop = prevStopIndexRef.current === state.stopIndex;
    const crossedApproach = sameStop && prevProgressRef.current < 0.7 && typedProgress >= 0.7;

    if (addedErrors > 0) errorTick(state.config.soundOn);
    else {
      keyTick(state.config.soundOn, state.streak, typedProgress, cadenceMs);
      if (crossedApproach) approachCue(state.config.soundOn, state.stopIndex);
    }

    prevKeyAtRef.current = state.now;
    prevProgressRef.current = typedProgress;
    prevStopIndexRef.current = state.stopIndex;
  }, [
    state.totalKeystrokes,
    state.errors,
    state.config.soundOn,
    state.streak,
    state.now,
    state.stopIndex,
    typedProgress,
  ]);

  // Clicking empty space restores input focus; control buttons are exempt (PRD §6).
  const restoreFocus = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('button, select, a, input, option')) return;
    containerRef.current?.querySelector<HTMLInputElement>('.ghost-input')?.focus();
  };

  if (state.phase === 'config')
    return <ConfigScreen routes={routes} route={route} state={state} dispatch={dispatch} />;
  if (state.phase === 'countdown') return <CountdownScreen state={state} dispatch={dispatch} />;
  if (state.phase === 'finished')
    return (
      <ResultScreen
        key={state.finishedAt ?? 0}
        state={state}
        routes={networkRoutes}
        dispatch={dispatch}
      />
    );

  return (
    <div className="screen game-screen" ref={containerRef} onMouseDown={restoreFocus}>
      <Hud state={state} dispatch={dispatch} />
      <div className="map-area">
        <RouteCanvas
          route={route}
          networkRoutes={networkRoutes}
          directionIndex={directionIndexOf(state)}
          stopIndex={state.stopIndex}
          startStopIndex={state.config.startStopIndex}
          typedProgress={typedProgress}
        />
      </div>
      <StopConsole state={state} dispatch={dispatch} />

      {state.phase === 'paused' && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="pause-card">
            <h2>Paused</h2>
            <button
              type="button"
              className="start-button"
              autoFocus
              onClick={() => dispatch({ type: 'RESUME', at: Date.now() })}
            >
              RESUME
            </button>
            <button
              type="button"
              className="option"
              onClick={() => dispatch({ type: 'RESTART', at: Date.now() })}
            >
              Restart run
            </button>
            <button type="button" className="option" onClick={() => dispatch({ type: 'EXIT' })}>
              Exit to setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
