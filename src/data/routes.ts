import type { RouteData } from './types';
import { validateRouteData } from './validate';
import route1 from './generated/route-1.json';
import route58 from './generated/route-58.json';
import route86 from './generated/route-86.json';
import route96 from './generated/route-96.json';
import route109 from './generated/route-109.json';

/**
 * Registry of playable routes. Each generated JSON is validated once at module
 * load; invalid routes are dropped (with a console warning) rather than
 * crashing the whole app, and the picker simply won't offer them.
 * Display order here is the order shown in the route picker.
 */
const RAW: unknown[] = [route96, route86, route109, route58, route1];

export interface AvailableRoute {
  data: RouteData;
  totalStops: number;
}

function buildRegistry(): AvailableRoute[] {
  const out: AvailableRoute[] = [];
  for (const raw of RAW) {
    const result = validateRouteData(raw);
    if (result.ok) {
      const totalStops = result.data.route.directions[0].stops.length;
      out.push({ data: result.data, totalStops });
    } else {
      const id = (raw as RouteData)?.route?.id ?? 'unknown';
      // eslint-disable-next-line no-console
      console.warn(`Route "${id}" failed validation and was skipped:`, result.problems);
    }
  }
  return out;
}

export const AVAILABLE_ROUTES = buildRegistry();

export function findRoute(routeId: string): RouteData | undefined {
  return AVAILABLE_ROUTES.find((r) => r.data.route.id === routeId)?.data;
}

export const DEFAULT_ROUTE = AVAILABLE_ROUTES[0]?.data;
