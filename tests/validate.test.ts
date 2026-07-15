import { describe, expect, it } from 'vitest';
import { validateRouteData } from '../src/data/validate';
import { makeRoute } from './fixtures/makeRoute';

function clone(): any {
  return JSON.parse(JSON.stringify(makeRoute(6)));
}

describe('validateRouteData', () => {
  it('accepts a well-formed schema-v2 route', () => {
    expect(validateRouteData(makeRoute(6)).ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(validateRouteData(null).ok).toBe(false);
    expect(validateRouteData('nope').ok).toBe(false);
  });

  it('rejects fewer than 2 directions', () => {
    const bad = clone();
    bad.route.directions = [bad.route.directions[0]];
    const result = validateRouteData(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/2 directions/);
  });

  it('rejects direction references to unknown stops', () => {
    const bad = clone();
    bad.route.directions[0].stops[1] = 'stop-does-not-exist';
    expect(validateRouteData(bad).ok).toBe(false);
  });

  it('rejects empty answer arrays', () => {
    const bad = clone();
    const firstStop = bad.route.directions[0].stops[0];
    bad.stops[firstStop].answers.easy = [];
    const result = validateRouteData(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/easy answers/);
  });

  it('rejects non-monotonic progress along a direction', () => {
    const bad = clone();
    const secondStop = bad.route.directions[0].stops[1];
    bad.stops[secondStop].position.progress = 0.99; // jumps past later stops
    const result = validateRouteData(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/progress not increasing/);
  });

  it('rejects out-of-range shape coordinates', () => {
    const bad = clone();
    bad.route.directions[0].shape[0] = [999, -37.8];
    expect(validateRouteData(bad).ok).toBe(false);
  });
});
