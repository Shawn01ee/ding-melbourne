import { describe, expect, it } from 'vitest';
import { splitDelta, type Ghost } from '../src/game/ghost';
import { initialState, reducer, runStopCount, TIME_ATTACK_LENGTH } from '../src/game/reducer';
import { makeRoute } from './fixtures/makeRoute';

const route = makeRoute(12);

function configured(startStopIndex = 0) {
  return reducer(initialState(route), {
    type: 'CONFIGURE',
    patch: { mode: 'time-attack', startStopIndex },
  });
}

describe('time-attack mode', () => {
  it('caps the run at TIME_ATTACK_LENGTH stops', () => {
    expect(runStopCount(configured())).toBe(TIME_ATTACK_LENGTH);
  });

  it('shortens near the terminus instead of overrunning', () => {
    const stops = route.route.directions[0].stops.length;
    expect(runStopCount(configured(stops - 2))).toBe(2);
  });

  it('is shorter than a section run', () => {
    const section = reducer(initialState(route), {
      type: 'CONFIGURE',
      patch: { mode: 'section' },
    });
    expect(runStopCount(configured())).toBeLessThan(runStopCount(section));
  });
});

describe('splitDelta', () => {
  const ghost: Ghost = { totalMs: 5000, stops: 3, samples: [[0, 0], [5000, 1]], splits: [1000, 2500, 5000] };

  it('is positive when you cleared the stop faster', () => {
    expect(splitDelta(ghost, 0, 800)).toBe(200);
  });

  it('is negative when the ghost was faster', () => {
    expect(splitDelta(ghost, 1, 3000)).toBe(-500);
  });

  it('returns null without a comparable ghost split', () => {
    expect(splitDelta(ghost, 9, 1000)).toBeNull();
    expect(splitDelta(null, 0, 1000)).toBeNull();
    expect(splitDelta({ ...ghost, splits: undefined }, 0, 1000)).toBeNull();
  });
});
