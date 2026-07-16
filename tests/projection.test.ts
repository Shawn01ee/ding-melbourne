import { describe, expect, it } from 'vitest';
import { projectCoordinates, projectPath } from '../src/map/projection';

const reference: [number, number][] = [
  [144.95, -37.9],
  [145.05, -37.8],
];

describe('shared map projection', () => {
  it('projects the active route exactly like projectPath', () => {
    const shared = projectCoordinates(reference, reference, 1000, 640, 70);
    const path = projectPath(reference, 1000, 640, 70);
    expect(shared).toEqual(path.points);
  });

  it('keeps another route in the active route geographic frame', () => {
    const other: [number, number][] = [
      [145, -37.85],
      [145.1, -37.75],
    ];
    const activePoints = projectCoordinates(reference, reference, 1000, 640, 70);
    const points = projectCoordinates(other, reference, 1000, 640, 70);
    expect(points[0].x).toBeGreaterThan(activePoints[0].x);
    expect(points[0].x).toBeLessThan(activePoints[1].x);
    expect(points[1].x).toBeGreaterThan(activePoints[1].x);
    expect(points[1].y).toBeLessThan(activePoints[1].y);
  });
});
