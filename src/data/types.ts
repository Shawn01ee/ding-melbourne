/** Internal game data contract (PRD §10). Generated per-route JSON, never raw GTFS. */

export interface RouteData {
  schemaVersion: number;
  sourceUpdatedAt: string;
  note?: string;
  route: RouteInfo;
  stops: Record<string, StopData>;
}

export interface RouteInfo {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  directions: RouteDirection[];
}

export interface RouteDirection {
  id: string;
  headsign: string;
  /** Ordered stop ids, first = origin terminus for this direction. */
  stops: string[];
  /** [lon, lat] polyline in travel order for this direction. */
  shape: [number, number][];
}

export interface StopData {
  /** Official label, shown in HUD/lists. Never the typing target directly. */
  displayName: string;
  /** Accepted answers per difficulty. answers[difficulty][0] is the canonical display target. */
  answers: {
    easy: string[];
    standard: string[];
    driver: string[];
  };
  stopNumber: string | null;
  landmark: string | null;
  /**
   * Schema v2: stop ids are unique per direction (real GTFS gives each
   * direction its own platform stops), and progress is the arc-length
   * fraction (0..1) along the shape of the direction that lists this stop.
   */
  position: { lat: number; lon: number; progress: number };
}

export type Difficulty = 'easy' | 'standard' | 'driver';

/** Progress of a stop along its own direction's rendered path. */
export function stopProgress(route: RouteData, stopId: string): number {
  return route.stops[stopId].position.progress;
}
