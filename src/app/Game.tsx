import { useEffect, useReducer, useRef } from 'react';
import { doorClick, errorTick, keyTick, ringBell, tramPass } from '../audio/bell';
import { ConfigScreen } from '../components/ConfigScreen';
import { CountdownScreen } from '../components/CountdownScreen';
import { Hud } from '../components/Hud';
import { ResultScreen } from '../components/ResultScreen';
import { StopConsole } from '../components/StopConsole';
import type { RouteData } from '../data/types';
import { directionIndexOf, initialState, reducer } from '../game/reducer';
import { RouteCanvas } from '../map/RouteCanvas';
import { loadLastConfig, loadSettings } from '../storage/local';

export function Game({ route }: { route: RouteData }) {
  const [state, dispatch] = useReducer(
    reducer,
    route,
    (r) => {
      const saved = { ...loadSettings(), ...loadLastConfig() };
      const validDirection = r.route.directions.some((d) => d.id === saved.directionId);
      if (!validDirection) delete saved.directionId;
      return initialState(r, saved);
    },
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef(state.phase);

  const inGame =
    state.phase === 'typing' ||
    state.phase === 'ready' ||
    state.phase === 'moving' ||
    state.phase === 'paused';

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

  // Phase-transition sounds: door click on READY, bell on depart,
  // rail hum + clacks while the tram rolls to the next stop.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const sound = state.config.soundOn;
    if (prev === 'typing' && state.phase === 'ready') {
      doorClick(sound);
      return;
    }
    if (prev !== 'ready') return;
    if (state.phase === 'moving' || (state.phase === 'finished' && state.finishReason === 'completed')) {
      ringBell(sound);
    }
    if (state.phase === 'moving') {
      tramPass(sound);
    }
  }, [state.phase, state.finishReason, state.config.soundOn]);

  // Per-keystroke ticks: light click for a correct key, low thud for an error.
  const prevKeysRef = useRef(state.totalKeystrokes);
  const prevErrorsRef = useRef(state.errors);
  useEffect(() => {
    const addedKeys = state.totalKeystrokes - prevKeysRef.current;
    const addedErrors = state.errors - prevErrorsRef.current;
    prevKeysRef.current = state.totalKeystrokes;
    prevErrorsRef.current = state.errors;
    if (addedKeys <= 0) return;
    if (addedErrors > 0) errorTick(state.config.soundOn);
    else keyTick(state.config.soundOn);
  }, [state.totalKeystrokes, state.errors, state.config.soundOn]);

  // Clicking empty space restores input focus; control buttons are exempt (PRD §6).
  const restoreFocus = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('button, select, a, input, option')) return;
    containerRef.current?.querySelector<HTMLInputElement>('.ghost-input')?.focus();
  };

  if (state.phase === 'config') return <ConfigScreen route={route} state={state} dispatch={dispatch} />;
  if (state.phase === 'countdown') return <CountdownScreen state={state} dispatch={dispatch} />;
  if (state.phase === 'finished') return <ResultScreen key={state.finishedAt ?? 0} state={state} dispatch={dispatch} />;

  return (
    <div className="screen game-screen" ref={containerRef} onMouseDown={restoreFocus}>
      <Hud state={state} dispatch={dispatch} />
      <div className="map-area">
        <RouteCanvas
          route={route}
          directionIndex={directionIndexOf(state)}
          stopIndex={state.stopIndex}
          phase={state.phase}
          dispatch={dispatch}
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
