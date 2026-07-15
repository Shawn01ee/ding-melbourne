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
   * progress is the arc-length fraction (0..1) along directions[0]'s shape.
   * For directions[1] use 1 - progress (see stopProgress()).
   */
  position: { lat: number; lon: number; progress: number };
}

export type Difficulty = 'easy' | 'standard' | 'driver';

/** Direction-aware progress along the rendered path. */
export function stopProgress(route: RouteData, directionIndex: number, stopId: string): number {
  const p = route.stops[stopId].position.progress;
  return directionIndex === 0 ? p : 1 - p;
}
