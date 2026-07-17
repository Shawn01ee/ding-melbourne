import { describe, expect, it } from 'vitest';
import type { RouteData } from '../src/data/types';
import { stopProgress } from '../src/data/types';
import { projectCoordinates, projectPath, projectPathInFrame } from '../src/map/projection';

const generatedRoutes = Object.values(
  import.meta.glob<RouteData>('../src/data/generated/route-*.json', {
    eager: true,
    import: 'default',
  }),
);

const reference: [number, number][] = [
  [144.95, -37.9],
  [145.05, -37.8],
];

function retracedLoopCount(points: { x: number; y: number }[]): number {
  let count = 0;
  for (let end = 3; end < points.length; end++) {
    for (let start = end - 3; start >= 0; start--) {
      if (Math.hypot(points[end].x - points[start].x, points[end].y - points[start].y) > 2.5) continue;
      const candidate = points.slice(start, end + 1);
      let length = 0;
      let twiceArea = 0;
      for (let i = 1; i < candidate.length; i++) {
        length += Math.hypot(candidate[i].x - candidate[i - 1].x, candidate[i].y - candidate[i - 1].y);
      }
      for (let i = 0; i < candidate.length; i++) {
        const a = candidate[i];
        const b = candidate[(i + 1) % candidate.length];
        twiceArea += a.x * b.y - b.x * a.y;
      }
      const areaRatio = Math.abs(twiceArea) / 2 / Math.max(length * length, 1);
      if (length >= 8 && areaRatio <= 0.012) count++;
    }
  }
  return count;
}

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

  it('cleans a route in its own scale before placing it in a shared network frame', () => {
    const route = generatedRoutes.find((candidate) => candidate.route.shortName === '59')!;
    const shape = route.route.directions[0].shape;
    const networkFrame = generatedRoutes.flatMap((candidate) => candidate.route.directions[0].shape);
    const local = projectPath(shape, 1200, 700, 48);
    const shared = projectPathInFrame(shape, networkFrame, 1200, 700, 48);

    expect(shared.points).toHaveLength(local.points.length);
    expect(shared.points.length).toBeLessThan(shape.length);
  });

  it('removes the known first-direction retraces from network previews', () => {
    const networkFrame = generatedRoutes.flatMap((candidate) => candidate.route.directions[0].shape);

    for (const shortName of ['12', '57', '59', '96']) {
      const route = generatedRoutes.find((candidate) => candidate.route.shortName === shortName)!;
      const shape = route.route.directions[0].shape;
      const raw = projectCoordinates(shape, networkFrame, 1200, 700, 48);
      const clean = projectPathInFrame(shape, networkFrame, 1200, 700, 48);

      expect(clean.points.length, `Route ${shortName} preview cleanup`).toBeLessThan(raw.length);
      expect(clean.points).toHaveLength(projectPath(shape, 1200, 700, 48).points.length);
    }
  });

  it('erases overshoot-and-return spikes while keeping progress forward', () => {
    const spiked: [number, number][] = [
      [144.95, -37.9],
      [144.98, -37.87],
      [144.951, -37.899],
      [145.02, -37.83],
      [145.05, -37.8],
    ];
    const path = projectPath(spiked, 1000, 640, 70);
    const mapped = [0, 0.2, 0.4, 0.6, 0.8, 1].map((progress) => path.remapProgress(progress));

    expect(path.points.length).toBeLessThan(spiked.length);
    expect(mapped).toEqual([...mapped].sort((a, b) => a - b));
    for (let i = 1; i < path.points.length - 1; i++) {
      const a = path.points[i - 1];
      const b = path.points[i];
      const c = path.points[i + 1];
      const ab = [b.x - a.x, b.y - a.y];
      const bc = [c.x - b.x, c.y - b.y];
      const cosine = (ab[0] * bc[0] + ab[1] * bc[1]) / (Math.hypot(...ab) * Math.hypot(...bc));
      expect(cosine).toBeGreaterThan(-0.75);
    }
  });

  it('erases a multi-point out-and-back before Batman-Park-style retracing can render', () => {
    const retraced: [number, number][] = [
      [144.95, -37.9],
      [144.96, -37.89],
      [144.97, -37.88],
      [144.98, -37.87],
      [144.97, -37.88],
      [144.96, -37.89],
      [144.97, -37.88],
      [144.99, -37.86],
    ];
    const path = projectPath(retraced, 1000, 640, 70);

    expect(path.points.length).toBeLessThanOrEqual(5);
    expect(retracedLoopCount(path.points)).toBe(0);
  });

  it('keeps every generated tram direction forward-only after cleanup', () => {
    for (const route of generatedRoutes) {
      for (const direction of route.route.directions) {
        const path = projectPath(direction.shape, 1000, 640, 70);
        expect(
          retracedLoopCount(path.points),
          `${route.route.shortName} ${direction.headsign} retraced loops`,
        ).toBe(0);
        const stopProgresses = direction.stops.map((id) =>
          path.remapProgress(stopProgress(route, id)),
        );
        expect(stopProgresses, `${route.route.shortName} ${direction.headsign} stop order`).toEqual(
          [...stopProgresses].sort((a, b) => a - b),
        );

        for (let i = 1; i < path.points.length - 1; i++) {
          const a = path.points[i - 1];
          const b = path.points[i];
          const c = path.points[i + 1];
          const ab = [b.x - a.x, b.y - a.y];
          const bc = [c.x - b.x, c.y - b.y];
          const cosine = (ab[0] * bc[0] + ab[1] * bc[1]) / (Math.hypot(...ab) * Math.hypot(...bc));
          expect(cosine, `${route.route.shortName} ${direction.headsign} point ${i}`).toBeGreaterThan(-0.75);
        }
      }
    }
  });
});
