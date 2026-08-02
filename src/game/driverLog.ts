import type { Mode } from './reducer';

/**
 * Driver's Log: the solo progression layer. Every finished run feeds two
 * localStorage records — lifetime totals and a per-route collection — so the
 * 24-line network becomes something to conquer without any backend.
 * Pure functions only; persistence lives in storage/local.ts.
 */

export interface LifetimeStats {
  runs: number;
  stopsCleared: number;
  timeMs: number;
  errors: number;
  bestWpm: number;
  bestCombo: number;
  firstAt: string | null;
  lastAt: string | null;
}

export interface DirectionLog {
  runs: number;
  /** True once the full line was driven end to end (full-route from stop 1). */
  fullLine: boolean;
  /** Fastest full-line clear, ms. */
  bestTimeMs: number | null;
  bestWpm: number;
}

export interface RouteLogEntry {
  runs: number;
  directions: Record<string, DirectionLog>;
}

export type RouteLog = Record<string, RouteLogEntry>;

export interface RunSnapshot {
  routeShort: string;
  directionId: string;
  mode: Mode;
  startStopIndex: number;
  /** finishReason === 'completed' (sprint time-up runs still count as runs). */
  completed: boolean;
  stops: number;
  timeMs: number;
  wpm: number;
  errors: number;
  bestStreak: number;
  at: string;
}

export function emptyStats(): LifetimeStats {
  return {
    runs: 0,
    stopsCleared: 0,
    timeMs: 0,
    errors: 0,
    bestWpm: 0,
    bestCombo: 0,
    firstAt: null,
    lastAt: null,
  };
}

/** A full line means the whole published direction, boarded at the first stop. */
export function isFullLineRun(snap: RunSnapshot): boolean {
  return snap.mode === 'full-route' && snap.completed && snap.startStopIndex === 0;
}

export function recordRun(
  stats: LifetimeStats,
  log: RouteLog,
  snap: RunSnapshot,
): { stats: LifetimeStats; log: RouteLog } {
  const nextStats: LifetimeStats = {
    runs: stats.runs + 1,
    stopsCleared: stats.stopsCleared + Math.max(0, snap.stops),
    timeMs: stats.timeMs + Math.max(0, snap.timeMs),
    errors: stats.errors + Math.max(0, snap.errors),
    bestWpm: Math.max(stats.bestWpm, snap.wpm),
    bestCombo: Math.max(stats.bestCombo, snap.bestStreak),
    firstAt: stats.firstAt ?? snap.at,
    lastAt: snap.at,
  };

  const route: RouteLogEntry = log[snap.routeShort] ?? { runs: 0, directions: {} };
  const dir: DirectionLog = route.directions[snap.directionId] ?? {
    runs: 0,
    fullLine: false,
    bestTimeMs: null,
    bestWpm: 0,
  };

  const fullLine = isFullLineRun(snap);
  const nextDir: DirectionLog = {
    runs: dir.runs + 1,
    fullLine: dir.fullLine || fullLine,
    bestTimeMs: fullLine
      ? Math.min(dir.bestTimeMs ?? Number.POSITIVE_INFINITY, snap.timeMs)
      : dir.bestTimeMs,
    bestWpm: Math.max(dir.bestWpm, snap.wpm),
  };

  const nextLog: RouteLog = {
    ...log,
    [snap.routeShort]: {
      runs: route.runs + 1,
      directions: { ...route.directions, [snap.directionId]: nextDir },
    },
  };

  return { stats: nextStats, log: nextLog };
}

/** Routes with at least one direction driven end to end. */
export function linesCompleted(log: RouteLog): number {
  return Object.values(log).filter((route) =>
    Object.values(route.directions).some((dir) => dir.fullLine),
  ).length;
}

/** Directions driven end to end for one route (for x/y pips in the log). */
export function directionsCompleted(entry: RouteLogEntry | undefined): number {
  if (!entry) return 0;
  return Object.values(entry.directions).filter((dir) => dir.fullLine).length;
}

/** Best full-line time across directions, or null if the line isn't finished. */
export function routeBestTime(entry: RouteLogEntry | undefined): number | null {
  if (!entry) return null;
  const times = Object.values(entry.directions)
    .map((dir) => dir.bestTimeMs)
    .filter((t): t is number => t !== null);
  return times.length > 0 ? Math.min(...times) : null;
}

export function routeBestWpm(entry: RouteLogEntry | undefined): number {
  if (!entry) return 0;
  return Math.max(0, ...Object.values(entry.directions).map((dir) => dir.bestWpm));
}

/** Compact "3h 24m" / "12m" / "48s" for lifetime driving time. */
export function formatDrivingTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
