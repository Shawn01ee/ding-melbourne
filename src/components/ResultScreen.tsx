import { useState } from 'react';
import type { GameAction, GameState } from '../game/reducer';
import { accuracyOf, elapsedMs, formatClock, scoreOf, totalRunStops, wpmOf } from '../game/selectors';
import { isBetter, loadBest, pbKey, saveBest, type PersonalBest } from '../storage/local';

interface ResultScreenProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

export function ResultScreen({ state, dispatch }: ResultScreenProps) {
  // Compare-and-save synchronously once on mount so the pre-run PB is shown.
  const [{ previous, isNew, result }] = useState(() => {
    const key = pbKey(state.route.route.id, state.config);
    const run: PersonalBest = {
      timeMs: elapsedMs(state),
      stops: state.stopsCompleted,
      accuracy: accuracyOf(state),
      wpm: wpmOf(state),
      score: scoreOf(state),
      at: new Date().toISOString(),
    };
    const prev = loadBest(key);
    const better = isBetter(state.config.mode, run, prev);
    if (better) saveBest(key, run);
    return { previous: prev, isNew: better, result: run };
  });

  const sprint = state.config.mode === 'sprint';
  const completed = state.finishReason === 'completed';

  return (
    <main className="screen result-screen">
      <h1 className="result-title">
        {completed ? 'End of the line!' : "Time's up!"}
        {isNew && <span className="pb-badge">NEW PERSONAL BEST</span>}
      </h1>

      <dl className="result-grid">
        <div>
          <dt>{sprint ? 'Stops cleared' : 'Clear time'}</dt>
          <dd>{sprint ? result.stops : formatClock(result.timeMs)}</dd>
        </div>
        <div>
          <dt>{sprint ? 'Time' : 'Stops'}</dt>
          <dd>{sprint ? formatClock(result.timeMs) : `${result.stops}/${totalRunStops(state)}`}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{result.accuracy.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>WPM</dt>
          <dd>{result.wpm.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{state.bestStreak}</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{result.score}</dd>
        </div>
      </dl>

      <p className="pb-compare">
        {previous
          ? sprint
            ? `Personal best: ${previous.stops} stops (${previous.wpm.toFixed(1)} WPM)`
            : `Personal best: ${formatClock(previous.timeMs)}`
          : 'First run on this setup — benchmark set.'}
      </p>

      <div className="result-actions">
        <button
          type="button"
          className="start-button"
          autoFocus
          onClick={() => dispatch({ type: 'RESTART', at: Date.now() })}
        >
          RUN IT AGAIN
        </button>
        <button type="button" className="option" onClick={() => dispatch({ type: 'EXIT' })}>
          Change setup
        </button>
      </div>
    </main>
  );
}
