import rawIndex from './generated/index.json';
import type { RouteData } from './types';
import { validateRouteData } from './validate';

export interface RouteSummary {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  totalStops: number;
  directionCount: number;
  /** Simplified first-direction geometry for the network overview and ghost map. */
  overviewShape: [number, number][];
}

interface RouteIndex {
  schemaVersion: number;
  sourceUpdatedAt: string;
  routes: RouteSummary[];
}

const index = rawIndex as RouteIndex;
const generatedModules = import.meta.glob('./generated/route-*.json', {
  import: 'default',
});
const routeCache = new Map<string, Promise<RouteData>>();

function sortRoutes(routes: RouteSummary[]): RouteSummary[] {
  return [...routes].sort(
    (a, b) => Number(a.shortName) - Number(b.shortName) || a.shortName.localeCompare(b.shortName),
  );
}

export const ROUTE_SOURCE_UPDATED_AT = index.sourceUpdatedAt;
export const AVAILABLE_ROUTES = sortRoutes(index.routes);
export const DEFAULT_ROUTE = AVAILABLE_ROUTES[0];

/** Load and validate one playable route only when the player asks for it. */
export function loadRoute(routeId: string): Promise<RouteData> {
  const cached = routeCache.get(routeId);
  if (cached) return cached;

  const summary = AVAILABLE_ROUTES.find((route) => route.id === routeId);
  if (!summary) return Promise.reject(new Error(`Unknown route "${routeId}".`));
  const loader = generatedModules[`./generated/route-${summary.shortName}.json`];
  if (!loader) return Promise.reject(new Error(`Missing data file for Route ${summary.shortName}.`));

  const pending = loader().then((raw) => {
    const result = validateRouteData(raw);
    if (!result.ok) {
      throw new Error(`Route ${summary.shortName} failed validation: ${result.problems.join('; ')}`);
    }
    return result.data;
  });
  routeCache.set(routeId, pending);
  pending.catch(() => routeCache.delete(routeId));
  return pending;
}
