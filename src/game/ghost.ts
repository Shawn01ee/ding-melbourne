import { stopProgress } from '../data/types';
import type { GameState } from './reducer';
import { directionIndexOf } from './reducer';
import { elapsedMs } from './selectors';

/**
 * A "ghost" is your best run for a setup, recorded as map progress over time so
 * it can be replayed as a translucent tram racing beside you. No backend needed
 * — this is the local foundation of the Ghost Challenge (docs/MULTIPLAYER.md).
 */
export interface Ghost {
  totalMs: number;
  stops: number;
  /** [elapsedMs, mapProgress 0..1] samples, ascending in time. */
  samples: [number, number][];
}

/** Map progress (0..1 along the played direction) of the tram right now. */
export function mapProgressOf(state: GameState): number {
  const dir = state.route.route.directions[directionIndexOf(state)];
  const progressOf = (i: number) => stopProgress(state.route, dir.stops[i]);
  const { stopIndex } = state;
  if (stopIndex <= state.config.startStopIndex) return progressOf(state.config.startStopIndex);
  const from = progressOf(Math.max(state.config.startStopIndex, stopIndex - 1));
  const to = progressOf(stopIndex);
  const target = state.route.stops[dir.stops[stopIndex]].answers[state.config.difficulty][0];
  const typed = target.length > 0 ? Math.min(1, [...state.input].length / [...target].length) : 0;
  return from + (to - from) * typed;
}

/** Ghost map progress at elapsed time `t`, interpolated between samples. */
export function ghostProgressAt(ghost: Ghost, t: number): number {
  const s = ghost.samples;
  if (s.length === 0) return 0;
  if (t <= s[0][0]) return s[0][1];
  if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
  // Linear scan is fine: a run has a few hundred samples at most.
  for (let i = 1; i < s.length; i++) {
    if (s[i][0] >= t) {
      const [t0, p0] = s[i - 1];
      const [t1, p1] = s[i];
      const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      return p0 + (p1 - p0) * k;
    }
  }
  return s[s.length - 1][1];
}

/**
 * When did the ghost reach this map progress? The inverse of ghostProgressAt,
 * and the basis of the live gap: (ghost time here) − (my time here) is how many
 * milliseconds I am ahead (positive) or behind (negative) right now.
 */
export function ghostTimeAtProgress(ghost: Ghost, progress: number): number {
  const s = ghost.samples;
  if (s.length === 0) return 0;
  if (progress <= s[0][1]) return s[0][0];
  for (let i = 1; i < s.length; i++) {
    if (s[i][1] >= progress) {
      const [t0, p0] = s[i - 1];
      const [t1, p1] = s[i];
      const k = p1 > p0 ? (progress - p0) / (p1 - p0) : 0;
      return t0 + (t1 - t0) * k;
    }
  }
  return s[s.length - 1][0];
}

/**
 * Live gap in ms: positive means you are ahead of your ghost. Returns null
 * before the run starts or once the ghost has finished its recording.
 */
export function ghostGapMs(ghost: Ghost | null, myProgress: number, myElapsedMs: number): number | null {
  if (!ghost || ghost.samples.length < 2 || myElapsedMs <= 0) return null;
  return ghostTimeAtProgress(ghost, myProgress) - myElapsedMs;
}

/** True if `run` beats `prev` by the mode's ranking rule (or prev is absent). */
export function ghostIsBetter(mode: string, run: Ghost, prev: Ghost | null): boolean {
  if (!prev) return true;
  if (mode === 'sprint') return run.stops > prev.stops;
  return run.totalMs < prev.totalMs;
}

/** Compact recorder: keeps a sample when time or progress moved enough. */
export class GhostRecorder {
  private samples: [number, number][] = [];

  reset() {
    this.samples = [];
  }

  sample(state: GameState) {
    const t = Math.round(elapsedMs(state));
    const p = Number(mapProgressOf(state).toFixed(4));
    const last = this.samples[this.samples.length - 1];
    if (!last) {
      this.samples.push([t, p]);
      return;
    }
    if (t - last[0] >= 90 || Math.abs(p - last[1]) >= 0.004) this.samples.push([t, p]);
  }

  finish(state: GameState): Ghost {
    this.sample(state);
    return { totalMs: Math.round(elapsedMs(state)), stops: state.stopsCompleted, samples: this.samples };
  }
}
