import { useEffect, useState, type CSSProperties } from 'react';
import { clickTick, departureCue } from '../audio/bell';
import { inkForBackground } from '../brand';
import type { GameAction, GameState } from '../game/reducer';
import { currentDirection } from '../game/reducer';

interface CountdownScreenProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

/** 3-2-1 on first start; a single fast beat on restart (fast-reset principle). */
export function CountdownScreen({ state, dispatch }: CountdownScreenProps) {
  const [count, setCount] = useState(state.quickRestart ? 1 : 3);
  const direction = currentDirection(state);
  const firstStop = state.route.stops[direction.stops[state.config.startStopIndex]];

  // One beat per count value; dispatch happens in the timeout callback,
  // never inside a state updater (that would set Game state mid-render).
  useEffect(() => {
    clickTick(state.config.soundOn, count);
    const beat = state.quickRestart ? 500 : 1000;
    const timer = setTimeout(() => {
      if (count <= 1) {
        departureCue(state.config.soundOn);
        dispatch({ type: 'COUNTDOWN_DONE', at: Date.now() });
      }
      else setCount(count - 1);
    }, beat);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'EXIT' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <main
      className="screen countdown-screen"
      style={{ '--route-color': state.route.route.color } as CSSProperties}
      aria-live="assertive"
    >
      <div className="countdown-lines" aria-hidden="true" />
      <p className="brand countdown-brand">DING! MELBOURNE</p>
      <div className="countdown-service">
        <span
          className="route-badge"
          style={{
            background: state.route.route.color,
            color: inkForBackground(state.route.route.color),
          }}
        >
          {state.route.route.shortName}
        </span>
        <span>
          <small>FIRST STOP</small>
          <strong>{firstStop.landmark ?? firstStop.displayName.split('/')[0]}</strong>
        </span>
      </div>
      <p className="countdown-route">Doors closing · {direction.headsign} service</p>
      <div className="countdown-counter" aria-label={`Departing in ${count} seconds`}>
        <span className="countdown-counter-label">Departing in</span>
        <p className="countdown-number">{count > 0 ? String(count).padStart(2, '0') : 'GO'}</p>
        <span className="countdown-counter-unit">Seconds</span>
      </div>
      <p className="countdown-hint"><kbd>ESC</kbd> cancel run</p>
    </main>
  );
}
