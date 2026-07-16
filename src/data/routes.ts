import type { RouteData } from './types';
import { validateRouteData } from './validate';

/**
 * Every generated route is discovered automatically and validated once at
 * module load. Invalid routes are dropped (with a console warning) rather than
 * crashing the whole app, and the picker simply won't offer them.
 */
const generatedModules = import.meta.glob('./generated/route-*.json', {
  eager: true,
  import: 'default',
});
const RAW: unknown[] = Object.values(generatedModules);

export interface AvailableRoute {
  data: RouteData;
  totalStops: number;
}

function buildRegistry(): AvailableRoute[] {
  const out: AvailableRoute[] = [];
  for (const raw of RAW) {
    const result = validateRouteData(raw);
    if (result.ok) {
      const totalStops = Math.max(...result.data.route.directions.map((direction) => direction.stops.length));
      out.push({ data: result.data, totalStops });
    } else {
      const id = (raw as RouteData)?.route?.id ?? 'unknown';
      // eslint-disable-next-line no-console
      console.warn(`Route "${id}" failed validation and was skipped:`, result.problems);
    }
  }
  out.sort((a, b) => {
    if (a.data.route.shortName === '96') return -1;
    if (b.data.route.shortName === '96') return 1;
    return Number(a.data.route.shortName) - Number(b.data.route.shortName)
      || a.data.route.shortName.localeCompare(b.data.route.shortName);
  });
  return out;
}

export const AVAILABLE_ROUTES = buildRegistry();

export function findRoute(routeId: string): RouteData | undefined {
  return AVAILABLE_ROUTES.find((r) => r.data.route.id === routeId)?.data;
}

export const DEFAULT_ROUTE = AVAILABLE_ROUTES[0]?.data;
