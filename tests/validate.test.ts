import { describe, expect, it } from 'vitest';
import routeJson from '../src/data/generated/route-96.json';
import { validateRouteData } from '../src/data/validate';

function clone(): any {
  return JSON.parse(JSON.stringify(routeJson));
}

describe('validateRouteData', () => {
  it('accepts the shipped Route 96 fixture', () => {
    const result = validateRouteData(routeJson);
    expect(result.ok).toBe(true);
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
    bad.stops['stop-southern-cross'].answers.easy = [];
    const result = validateRouteData(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/easy answers/);
  });

  it('rejects non-monotonic progress along a direction', () => {
    const bad = clone();
    bad.stops['stop-southern-cross'].position.progress = 0.9; // jumps past the following stop's 0.564
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
