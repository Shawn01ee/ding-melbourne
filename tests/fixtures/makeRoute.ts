import type { RouteData } from '../../src/data/types';

/**
 * Builds a schema-v2 test route with `n` stops per direction, stable ids, and
 * monotonic progress along each direction's own shape. Direction ids and stop
 * ids are unique per direction (matching the real GTFS pipeline output), so
 * tests exercise the same data shape the game ships.
 */
export function makeRoute(n = 6, id = 'tram-test'): RouteData {
  const names = Array.from({ length: n }, (_, i) => `Stop ${String.fromCharCode(65 + i)}`);

  const buildDirection = (dirIndex: number, order: number[]) => {
    const stopIds = order.map((si) => `s${si}-d${dirIndex}`);
    const shape: [number, number][] = order.map((_, i) => [144.9 + i * 0.01, -37.8 - i * 0.01]);
    return { id: `dir-${dirIndex}`, headsign: `Terminus ${dirIndex}`, stops: stopIds, shape };
  };

  const stops: RouteData['stops'] = {};
  const forwardOrder = Array.from({ length: n }, (_, i) => i);
  const reverseOrder = [...forwardOrder].reverse();

  const register = (dirIndex: number, order: number[]) => {
    order.forEach((si, pos) => {
      const name = names[si];
      stops[`s${si}-d${dirIndex}`] = {
        displayName: `${name}/Test St #${si + 1}`,
        answers: {
          easy: [name],
          standard: [`${name}/Test St`],
          driver: [`${name}/Test St #${si + 1}`],
        },
        stopNumber: String(si + 1),
        landmark: null,
        position: {
          lat: -37.8 - pos * 0.01,
          lon: 144.9 + pos * 0.01,
          progress: n > 1 ? pos / (n - 1) : 0,
        },
      };
    });
  };
  register(0, forwardOrder);
  register(1, reverseOrder);

  return {
    schemaVersion: 2,
    sourceUpdatedAt: '2026-07-10',
    route: {
      id,
      shortName: 'T',
      longName: 'Test Line',
      color: '#50A83B',
      directions: [buildDirection(0, forwardOrder), buildDirection(1, reverseOrder)],
    },
    stops,
  };
}
