import { useEffect, useState } from 'react';
import { clickTick } from '../audio/bell';
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

  // One beat per count value; dispatch happens in the timeout callback,
  // never inside a state updater (that would set Game state mid-render).
  useEffect(() => {
    clickTick(state.config.soundOn);
    const beat = state.quickRestart ? 500 : 1000;
    const timer = setTimeout(() => {
      if (count <= 1) dispatch({ type: 'COUNTDOWN_DONE', at: Date.now() });
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
    <main className="screen countdown-screen" aria-live="assertive">
      <p className="countdown-route">
        Route {state.route.route.shortName} → {direction.headsign}
      </p>
      <p className="countdown-number">{count > 0 ? count : 'GO'}</p>
      <p className="countdown-hint">Esc to cancel</p>
    </main>
  );
}
