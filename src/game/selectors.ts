import type { StopData } from '../data/types';
import { accuracy, score, wpm } from './scoring';
import { currentDirection, SPRINT_MS, type GameState } from './reducer';

/** Elapsed play time excluding paused spans. */
export function elapsedMs(state: GameState): number {
  if (state.startedAt === null) return 0;
  const end = state.finishedAt ?? state.pausedAt ?? state.now;
  return Math.max(0, end - state.startedAt - state.pausedTotal);
}

/** Sprint countdown remainder, clamped at 0. */
export function remainingMs(state: GameState): number {
  return Math.max(0, SPRINT_MS - elapsedMs(state));
}

export function accuracyOf(state: GameState): number {
  if (state.totalKeystrokes === 0) return 100;
  return accuracy(state.correctKeystrokes, state.totalKeystrokes);
}

export function wpmOf(state: GameState): number {
  return wpm(state.correctKeystrokes, elapsedMs(state));
}

export function scoreOf(state: GameState): number {
  return score({
    stops: state.stopsCompleted,
    bestStreak: state.bestStreak,
    wpm: wpmOf(state),
    errors: state.errors,
  });
}

/** Stops to clear in this run (start stop through terminus). */
export function totalRunStops(state: GameState): number {
  return currentDirection(state).stops.length - state.config.startStopIndex;
}

export function stopAt(state: GameState, index: number): StopData | null {
  const ids = currentDirection(state).stops;
  const id = ids[index];
  return id ? state.route.stops[id] : null;
}

export function previousStop(state: GameState): StopData | null {
  return state.stopIndex > state.config.startStopIndex ? stopAt(state, state.stopIndex - 1) : null;
}

export function currentStop(state: GameState): StopData {
  return stopAt(state, state.stopIndex)!;
}

export function nextStop(state: GameState): StopData | null {
  return stopAt(state, state.stopIndex + 1);
}

/** Compact display name: curated landmark, else the label before the road part. */
export function stopShortName(stop: StopData): string {
  return stop.landmark ?? stop.displayName.split('/')[0];
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const tenth = Math.floor((ms % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${tenth}`;
}
