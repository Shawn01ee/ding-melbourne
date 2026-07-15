import { describe, expect, it } from 'vitest';
import routeJson from '../src/data/generated/route-96.json';
import {
  initialState,
  reducer,
  SPRINT_MS,
  targetText,
  type GameAction,
  type GameState,
} from '../src/game/reducer';
import { elapsedMs } from '../src/game/selectors';
import { validateRouteData } from '../src/data/validate';

const validated = validateRouteData(routeJson);
if (!validated.ok) throw new Error('fixture invalid: ' + validated.problems.join('; '));
const route = validated.data;

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
    const s2 = reducer(s, { type: 'CONFIGURE', patch: { mode: 'sprint', difficulty: 'easy' } });
    expect(s2.config.mode).toBe('sprint');
    expect(s2.config.difficulty).toBe('easy');
  });

  it('resets startStopIndex when direction changes', () => {
    const s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { startStopIndex: 2 } },
      { type: 'CONFIGURE', patch: { directionId: 'to-east-brunswick' } },
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
    const s = reducer(startTyping(), { type: 'INPUT', value: 'M', at: T0 + 100 });
    expect(s.totalKeystrokes).toBe(1);
    expect(s.correctKeystrokes).toBe(1);
    expect(s.errors).toBe(0);
    expect(s.phase).toBe('typing');
  });

  it('marks a mismatch without advancing the stop (AC-02)', () => {
    const s = reducer(startTyping(), { type: 'INPUT', value: 'X', at: T0 + 100 });
    expect(s.errors).toBe(1);
    expect(s.stopHadError).toBe(true);
    expect(s.stopIndex).toBe(0);
    expect(s.phase).toBe('typing');
  });

  it('keeps totals after backspace (PRD §8)', () => {
    const s = run(
      startTyping(),
      { type: 'INPUT', value: 'X', at: T0 + 100 },
      { type: 'INPUT', value: '', at: T0 + 200 },
    );
    expect(s.totalKeystrokes).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.input).toBe('');
  });

  it('is case-insensitive on standard difficulty', () => {
    const s = reducer(startTyping(), { type: 'INPUT', value: 'm', at: T0 + 100 });
    expect(s.correctKeystrokes).toBe(1);
  });

  it('completing the answer transitions to ready, not auto-move (PRD §8)', () => {
    const s = typeAnswer(startTyping(), T0 + 500);
    expect(s.phase).toBe('ready');
    expect(s.stopIndex).toBe(0);
  });

  it('editing in ready drops back to typing', () => {
    const s = typeAnswer(startTyping(), T0 + 500);
    const s2 = reducer(s, { type: 'INPUT', value: s.input.slice(0, -1), at: T0 + 600 });
    expect(s2.phase).toBe('typing');
  });

  it('ignores input outside typing/ready', () => {
    const s = fresh();
    expect(reducer(s, { type: 'INPUT', value: 'x', at: T0 }).input).toBe('');
  });

  it('INVALID_ACTION (paste) counts one error keystroke', () => {
    const s = reducer(startTyping(), { type: 'INVALID_ACTION' });
    expect(s.totalKeystrokes).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.stopHadError).toBe(true);
  });
});

describe('DEPART / MOVING', () => {
  it('DEPART is ignored while still typing', () => {
    const s = reducer(startTyping(), { type: 'DEPART', at: T0 + 100 });
    expect(s.phase).toBe('typing');
  });

  it('DEPART from ready enters moving, counts the stop and streak (AC-03)', () => {
    const s = reducer(typeAnswer(startTyping(), T0 + 500), { type: 'DEPART', at: T0 + 600 });
    expect(s.phase).toBe('moving');
    expect(s.stopsCompleted).toBe(1);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it('a stop passed with an error resets the streak', () => {
    let s = startTyping();
    s = reducer(s, { type: 'INPUT', value: 'X', at: T0 + 50 });
    s = reducer(s, { type: 'INPUT', value: '', at: T0 + 60 });
    s = typeAnswer(s, T0 + 500);
    s = reducer(s, { type: 'DEPART', at: T0 + 600 });
    expect(s.streak).toBe(0);
  });

  it('input is locked during moving', () => {
    const s = reducer(typeAnswer(startTyping(), T0 + 500), { type: 'DEPART', at: T0 + 600 });
    expect(reducer(s, { type: 'INPUT', value: 'x', at: T0 + 700 }).input).toBe('');
  });

  it('MOVE_DONE advances to the next stop and reopens typing', () => {
    const s = run(
      typeAnswer(startTyping(), T0 + 500),
      { type: 'DEPART', at: T0 + 600 },
      { type: 'MOVE_DONE', at: T0 + 1200 },
    );
    expect(s.phase).toBe('typing');
    expect(s.stopIndex).toBe(1);
    expect(s.input).toBe('');
    expect(s.stopHadError).toBe(false);
  });

  it('MOVE_DONE is ignored outside moving', () => {
    const s = startTyping();
    expect(reducer(s, { type: 'MOVE_DONE', at: T0 + 100 }).stopIndex).toBe(0);
  });
});

describe('FINISHED', () => {
  it('full route: departing the last stop finishes the run (AC-04)', () => {
    let s = startTyping();
    const stopsCount = route.route.directions[0].stops.length;
    for (let i = 0; i < stopsCount; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
      s = reducer(s, { type: 'DEPART', at: T0 + 1000 * (i + 1) + 500 });
      if (i < stopsCount - 1) {
        expect(s.phase).toBe('moving');
        s = reducer(s, { type: 'MOVE_DONE', at: T0 + 1000 * (i + 1) + 900 });
      }
    }
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('completed');
    expect(s.stopsCompleted).toBe(stopsCount);
  });

  it('starting mid-route finishes after the remaining stops', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { startStopIndex: 3 } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    for (let i = 0; i < 2; i++) {
      s = typeAnswer(s, T0 + 1000 * (i + 1));
      s = reducer(s, { type: 'DEPART', at: T0 + 1000 * (i + 1) + 500 });
      if (s.phase === 'moving') s = reducer(s, { type: 'MOVE_DONE', at: T0 + 1000 * (i + 1) + 900 });
    }
    expect(s.phase).toBe('finished');
    expect(s.stopsCompleted).toBe(2);
  });

  it('sprint: TICK past 60s finishes with time-up and locks input (AC-05)', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'sprint' } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    s = typeAnswer(s, T0 + 500);
    s = reducer(s, { type: 'DEPART', at: T0 + 600 });
    s = reducer(s, { type: 'MOVE_DONE', at: T0 + 1200 });
    const stopsBefore = s.stopsCompleted;

    s = reducer(s, { type: 'TICK', at: T0 + SPRINT_MS + 1 });
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('time-up');
    expect(s.stopsCompleted).toBe(stopsBefore);
    expect(elapsedMs(s)).toBe(SPRINT_MS);

    expect(reducer(s, { type: 'INPUT', value: 'x', at: T0 + SPRINT_MS + 100 }).input).toBe('');
  });

  it('sprint: DEPART exactly at the deadline resolves as time-up', () => {
    let s = run(
      fresh(),
      { type: 'CONFIGURE', patch: { mode: 'sprint' } },
      { type: 'START', at: T0 - 3000 },
      { type: 'COUNTDOWN_DONE', at: T0 },
    );
    s = typeAnswer(s, T0 + 500);
    s = reducer(s, { type: 'DEPART', at: T0 + SPRINT_MS + 5 });
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

  it('pausing mid-move settles the hop first', () => {
    const s = run(
      typeAnswer(startTyping(), T0 + 500),
      { type: 'DEPART', at: T0 + 600 },
      { type: 'PAUSE', at: T0 + 800 },
    );
    expect(s.phase).toBe('paused');
    expect(s.stopIndex).toBe(1);
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
      s = reducer(s, { type: 'DEPART', at: T0 + 1000 * (i + 1) + 500 });
      if (s.phase === 'moving') s = reducer(s, { type: 'MOVE_DONE', at: T0 + 1000 * (i + 1) + 900 });
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
