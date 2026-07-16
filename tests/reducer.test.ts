import { describe, expect, it } from 'vitest';
import {
  initialState,
  reducer,
  SECTION_LENGTH,
  SPRINT_MS,
  targetText,
  type GameAction,
  type GameState,
} from '../src/game/reducer';
import { elapsedMs, totalRunStops } from '../src/game/selectors';
import { validateRouteData } from '../src/data/validate';
import { makeRoute } from './fixtures/makeRoute';

// 12-stop fixture so Section mode (10) finishes before the terminus.
const route = makeRoute(12);
const validated = validateRouteData(route);
if (!validated.ok) throw new Error('fixture invalid: ' + validated.problems.join('; '));
const REVERSE_DIR = route.route.directions[1].id;

const T0 = 1_000_000;

function fresh(config?: Parameters<typeof initialState>[1]): GameState {
  return initialState(route, config);
}

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(reducer, state);
}

/** CONFIG -> COUNTDOWN -> TYPING with startedAt = T0. */
function startTyping(config?: Parameters<typeof initialState>[1]): GameState {
  return run(fresh(config), { type: 'START', at: T0 - 3000 }, { type: 'COUNTDOWN_DONE', at: T0 });
}

/** First expected character of the current target, and a char that is never it. */
function firstChar(state: GameState): string {
  return [...targetText(state)][0];
}
function wrongChar(state: GameState): string {
  const c = firstChar(state).toLowerCase();
  return c === 'z' ? 'q' : 'z';
}

/** Types the current stop's full canonical answer, one keystroke at a time. */
function typeAnswer(state: GameState, at: number): GameState {
  const answer = targetText(state);
  let s = state;
  for (let i = 1; i <= answer.length; i++) {
    s = reducer(s, { type: 'INPUT', value: answer.slice(0, i), at });
  }
  return s;
}

describe('CONFIG', () => {
  it('starts in config and applies patches', () => {
    const s = fresh();
    expect(s.phase).toBe('config');
    const s2 = reducer(s, { type: 'CONFIGURE', patch: { mode: 'sprint', difficulty: 'driver' } });
    expect(s2.config.mode).toBe('sprint');
    expect(s2.config.difficulty).toBe('driver');
  });

  it('uses the short stop name for Standard and the full intersection for Driver', () => {
    expect(targetText(fresh({ difficulty: 'standard' }))).toBe('Stop A');
    expect(targetText(fresh({ difficulty: 'driver' }))).toBe('Stop A/Test St');
  });

  it('resets startStopIndex when direction changes', () => {
    const s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { startStopIndex: 2 } },
      { type: 'CONFIGURE', patch: { directionId: REVERSE_DIR } },
    );
    expect(s.config.startStopIndex).toBe(0);
  });

  it('ignores CONFIGURE outside config phase', () => {
    const s = startTyping();
    expect(reducer(s, { type: 'CONFIGURE', patch: { mode: 'sprint' } }).config.mode).toBe('full-route');
  });

  it('TOGGLE_SOUND works in any phase', () => {
    const s = startTyping();
    expect(reducer(s, { type: 'TOGGLE_SOUND' }).config.soundOn).toBe(false);
  });
});

describe('SELECT_ROUTE', () => {
  const other = makeRoute(6, 'tram-other');

  it('swaps the route and resets direction/start stop, keeping mode/difficulty', () => {
    const s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'sprint', difficulty: 'driver', startStopIndex: 4 } },
      { type: 'SELECT_ROUTE', route: other },
    );
    expect(s.route.route.id).toBe('tram-other');
    expect(s.config.directionId).toBe(other.route.directions[0].id);
    expect(s.config.startStopIndex).toBe(0);
    expect(s.config.mode).toBe('sprint');
    expect(s.config.difficulty).toBe('driver');
  });

  it('is a no-op for the same route id', () => {
    const s = fresh();
    expect(reducer(s, { type: 'SELECT_ROUTE', route })).toBe(s);
  });

  it('is ignored outside config phase', () => {
    const s = startTyping();
    expect(reducer(s, { type: 'SELECT_ROUTE', route: other }).route.route.id).toBe(route.route.id);
  });
});

describe('START / COUNTDOWN', () => {
  it('START moves config -> countdown, honouring startStopIndex', () => {
    const s = run(fresh(), { type: 'CONFIGURE', patch: { startStopIndex: 1 } }, { type: 'START', at: T0 });
    expect(s.phase).toBe('countdown');
    expect(s.stopIndex).toBe(1);
    expect(s.startedAt).toBeNull();
  });

  it('COUNTDOWN_DONE opens typing and starts the clock (AC-01)', () => {
    const s = startTyping();
    expect(s.phase).toBe('typing');
    expect(s.startedAt).toBe(T0);
  });

  it('COUNTDOWN_DONE is ignored outside countdown', () => {
    expect(reducer(fresh(), { type: 'COUNTDOWN_DONE', at: T0 }).phase).toBe('config');
  });
});

describe('TYPING input accounting', () => {
  it('counts a correct keystroke', () => {
    const base = startTyping();
    const s = reducer(base, { type: 'INPUT', value: firstChar(base), at: T0 + 100 });
    expect(s.totalKeystrokes).toBe(1);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.errors).toBe(0);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(1);
    expect(s.phase).toBe('typing');
  });

  it('marks a mismatch without advancing the stop (AC-02)', () => {
    const base = startTyping();
    const s = reducer(base, { type: 'INPUT', value: wrongChar(base), at: T0 + 100 });
    expect(s.errors).toBe(1);
    expect(s.stopHadError).toBe(true);
    expect(s.input).toBe('');
    expect(s.streak).toBe(0);
    expect(s.stopIndex).toBe(0);
    expect(s.phase).toBe('typing');
  });

  it('rejects a wrong key and accepts the expected key next without backspace', () => {
    const base = startTyping();
    const wrong = reducer(base, { type: 'INPUT', value: wrongChar(base), at: T0 + 100 });
    const s = reducer(wrong, { type: 'INPUT', value: firstChar(base), at: T0 + 200 });
    expect(s.input).toBe(firstChar(base));
    expect(s.totalKeystrokes).toBe(2);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.errors).toBe(1);
  });

  it('keeps totals after backspace (PRD §8)', () => {
    const base = startTyping();
    const typed = reducer(base, { type: 'INPUT', value: firstChar(base), at: T0 + 100 });
    const s = reducer(typed, { type: 'INPUT', value: '', at: T0 + 200 });
    expect(s.totalKeystrokes).toBe(1);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.input).toBe('');
    expect(s.streak).toBe(0);
  });

  it('is case-insensitive on standard difficulty', () => {
    const base = startTyping();
    const s = reducer(base, { type: 'INPUT', value: firstChar(base).toLowerCase(), at: T0 + 100 });
    expect(s.correctKeystrokes).toBe(1);
  });

  it('completing the answer immediately opens the next stop', () => {
    const s = typeAnswer(startTyping(), T0 + 500);
    expect(s.phase).toBe('typing');
    expect(s.stopIndex).toBe(1);
    expect(s.stopsCompleted).toBe(1);
    expect(s.input).toBe('');
  });

  it('ignores non-prefix replacement edits', () => {
    const base = startTyping();
    const s = reducer(base, { type: 'INPUT', value: firstChar(base), at: T0 + 100 });
    expect(reducer(s, { type: 'INPUT', value: 'replacement', at: T0 + 200 })).toBe(s);
  });

  it('ignores input outside typing', () => {
    const s = fresh();
    expect(reducer(s, { type: 'INPUT', value: 'x', at: T0 }).input).toBe('');
  });

  it('INVALID_ACTION (paste) counts one error keystroke', () => {
    const base = startTyping();
    const typed = reducer(base, { type: 'INPUT', value: firstChar(base), at: T0 + 50 });
    const s = reducer(typed, { type: 'INVALID_ACTION' });
    expect(s.totalKeystrokes).toBe(2);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.stopHadError).toBe(true);
    expect(s.streak).toBe(0);
  });
});

describe('UNINTERRUPTED STOP ADVANCE', () => {
  it('raises combo for every correct character and carries it into the next stop', () => {
    const base = startTyping();
    const answerLength = [...targetText(base)].length;
    const s = typeAnswer(base, T0 + 500);
    expect(s.phase).toBe('typing');
    expect(s.stopsCompleted).toBe(1);
    expect(s.streak).toBe(answerLength);
    expect(s.bestStreak).toBe(answerLength);

    const continued = reducer(s, { type: 'INPUT', value: firstChar(s), at: T0 + 501 });
    expect(continued.streak).toBe(answerLength + 1);
    expect(continued.bestStreak).toBe(answerLength + 1);
  });

  it('a wrong character resets combo but the following correct character starts it again', () => {
    let s = startTyping();
    s = reducer(s, { type: 'INPUT', value: firstChar(s), at: T0 + 25 });
    expect(s.streak).toBe(1);
    s = reducer(s, { type: 'INPUT', value: s.input + wrongChar(s), at: T0 + 50 });
    expect(s.streak).toBe(0);
    s = reducer(s, { type: 'INPUT', value: s.input + [...targetText(s)][1], at: T0 + 75 });
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it('accepts the first key of the next stop immediately', () => {
    const advanced = typeAnswer(startTyping(), T0 + 500);
    const nextChar = firstChar(advanced);
    const s = reducer(advanced, { type: 'INPUT', value: nextChar, at: T0 + 501 });
    expect(s.stopIndex).toBe(1);
    expect(s.input).toBe(nextChar);
    expect(s.totalKeystrokes).toBe(advanced.totalKeystrokes + 1);
  });
});

describe('FINISHED', () => {
  it('full route: departing the last stop finishes the run (AC-04)', () => {
    let s = startTyping();
    const stopsCount = route.route.directions[0].stops.length;
    for (let i = 0; i < stopsCount; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
      if (i < stopsCount - 1) expect(s.phase).toBe('typing');
    }
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('completed');
    expect(s.stopsCompleted).toBe(stopsCount);
  });

  it('starting mid-route finishes after the remaining stops', () => {
    const stopsCount = route.route.directions[0].stops.length;
    const startIndex = stopsCount - 2; // two stops from the terminus
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { startStopIndex: startIndex } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    for (let i = 0; i < 2; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
    }
    expect(s.phase).toBe('finished');
    expect(s.stopsCompleted).toBe(2);
  });

  it('section mode finishes after SECTION_LENGTH stops, before the terminus', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'section' } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    expect(totalRunStops(s)).toBe(SECTION_LENGTH); // fixture has 12 > 10 stops
    for (let i = 0; i < SECTION_LENGTH; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
      if (i < SECTION_LENGTH - 1) expect(s.phase).toBe('typing');
    }
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('completed');
    expect(s.stopsCompleted).toBe(SECTION_LENGTH);
    expect(s.stopIndex).toBeLessThan(route.route.directions[0].stops.length - 1);
  });

  it('section mode near the terminus caps at the remaining stops', () => {
    const stopsCount = route.route.directions[0].stops.length;
    const s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'section', startStopIndex: stopsCount - 3 } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    expect(totalRunStops(s)).toBe(3); // fewer than SECTION_LENGTH remain
  });

  it('sprint: TICK past 60s finishes with time-up and locks input (AC-05)', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'sprint' } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    s = typeAnswer(s, T0 + 500);
    const stopsBefore = s.stopsCompleted;

    s = reducer(s, { type: 'TICK', at: T0 + SPRINT_MS + 1 });
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('time-up');
    expect(s.stopsCompleted).toBe(stopsBefore);
    expect(elapsedMs(s)).toBe(SPRINT_MS);

    expect(reducer(s, { type: 'INPUT', value: 'x', at: T0 + SPRINT_MS + 100 }).input).toBe('');
  });

  it('sprint: completing an answer at the deadline resolves as time-up', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'sprint' } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    const answer = targetText(s);
    for (let i = 1; i < answer.length; i++) {
      s = reducer(s, { type: 'INPUT', value: answer.slice(0, i), at: T0 + 500 });
    }
    s = reducer(s, { type: 'INPUT', value: answer, at: T0 + SPRINT_MS + 5 });
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('time-up');
    expect(s.stopsCompleted).toBe(0);
  });
});

describe('PAUSE / RESUME', () => {
  it('pauses from typing and resumes to the same phase', () => {
    const s = run(startTyping(), { type: 'PAUSE', at: T0 + 1000 });
    expect(s.phase).toBe('paused');
    expect(s.pausedFrom).toBe('typing');
    const s2 = reducer(s, { type: 'RESUME', at: T0 + 5000 });
    expect(s2.phase).toBe('typing');
    expect(s2.pausedTotal).toBe(4000);
  });

  it('excludes paused time from the elapsed clock', () => {
    const s = run(
      startTyping(),
      { type: 'PAUSE', at: T0 + 1000 },
      { type: 'RESUME', at: T0 + 11_000 },
      { type: 'TICK', at: T0 + 12_000 },
    );
    expect(elapsedMs(s)).toBe(2000);
  });

  it('pausing after an instant stop advance preserves the new target', () => {
    const advanced = typeAnswer(startTyping(), T0 + 500);
    const nextChar = firstChar(advanced);
    const partial = reducer(advanced, { type: 'INPUT', value: nextChar, at: T0 + 600 });
    const s = reducer(partial, { type: 'PAUSE', at: T0 + 800 });
    expect(s.phase).toBe('paused');
    expect(s.stopIndex).toBe(1);
    expect(s.input).toBe(nextChar);
    expect(s.pausedFrom).toBe('typing');
  });

  it('PAUSE is ignored in config/finished', () => {
    expect(reducer(fresh(), { type: 'PAUSE', at: T0 }).phase).toBe('config');
  });
});

describe('RESTART / EXIT', () => {
  function finished(): GameState {
    let s = startTyping();
    const stopsCount = route.route.directions[0].stops.length;
    for (let i = 0; i < stopsCount; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
    }
    return s;
  }

  it('RESTART re-enters countdown quickly with counters reset', () => {
    const s = reducer(finished(), { type: 'RESTART', at: T0 + 60_000 });
    expect(s.phase).toBe('countdown');
    expect(s.quickRestart).toBe(true);
    expect(s.stopsCompleted).toBe(0);
    expect(s.totalKeystrokes).toBe(0);
    expect(s.startedAt).toBeNull();
    expect(s.config.mode).toBe('full-route'); // config preserved
  });

  it('EXIT returns to config from any phase', () => {
    expect(reducer(finished(), { type: 'EXIT' }).phase).toBe('config');
    expect(reducer(startTyping(), { type: 'EXIT' }).phase).toBe('config');
  });
});
