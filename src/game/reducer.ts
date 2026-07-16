import type { Difficulty, RouteData } from '../data/types';
import { foldChar, isAnswerMatch } from './normalize';

/**
 * Deterministic game state machine (PRD §6).
 * CONFIG -> COUNTDOWN -> TYPING ... -> FINISHED
 * Completing a stop advances the logical game immediately; map motion is a
 * renderer concern and never locks input. PAUSED wraps the live typing phase.
 * All timestamps arrive via actions,
 * never Date.now() inside the reducer, so every transition is testable.
 */

export type Phase = 'config' | 'countdown' | 'typing' | 'finished' | 'paused';
export type Mode = 'full-route' | 'section' | 'sprint';
export type FinishReason = 'completed' | 'time-up';

export const SPRINT_MS = 60_000;
/** Stops to clear in a Section run (PRD "10개 정류장 구간"). */
export const SECTION_LENGTH = 10;

export interface GameConfig {
  directionId: string;
  startStopIndex: number;
  mode: Mode;
  difficulty: Difficulty;
  soundOn: boolean;
}

export interface GameState {
  route: RouteData;
  phase: Phase;
  config: GameConfig;
  /** Index into the current direction's stop list; the stop being typed. */
  stopIndex: number;
  input: string;
  totalKeystrokes: number;
  correctKeystrokes: number;
  errors: number;
  /** Consecutive accepted characters; crosses stop boundaries, breaks on a miss/backspace. */
  streak: number;
  /** Highest character combo reached during this run. */
  bestStreak: number;
  /** True once any keystroke for the current stop was wrong. */
  stopHadError: boolean;
  stopsCompleted: number;
  startedAt: number | null;
  finishedAt: number | null;
  pausedAt: number | null;
  pausedTotal: number;
  now: number;
  finishReason: FinishReason | null;
  pausedFrom: Phase | null;
  /** Restart uses a shortened countdown (fast-reset principle, PRD §4). */
  quickRestart: boolean;
}

export type GameAction =
  | { type: 'SELECT_ROUTE'; route: RouteData }
  | { type: 'CONFIGURE'; patch: Partial<GameConfig> }
  | { type: 'START'; at: number }
  | { type: 'COUNTDOWN_DONE'; at: number }
  | { type: 'INPUT'; value: string; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'PAUSE'; at: number }
  | { type: 'RESUME'; at: number }
  | { type: 'INVALID_ACTION' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'RESTART'; at: number }
  | { type: 'EXIT' };

export function initialState(route: RouteData, config?: Partial<GameConfig>): GameState {
  return {
    route,
    phase: 'config',
    config: {
      directionId: route.route.directions[0].id,
      startStopIndex: 0,
      mode: 'full-route',
      difficulty: 'standard',
      soundOn: true,
      ...config,
    },
    stopIndex: 0,
    input: '',
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    errors: 0,
    streak: 0,
    bestStreak: 0,
    stopHadError: false,
    stopsCompleted: 0,
    startedAt: null,
    finishedAt: null,
    pausedAt: null,
    pausedTotal: 0,
    now: 0,
    finishReason: null,
    pausedFrom: null,
    quickRestart: false,
  };
}

export function directionIndexOf(state: GameState): number {
  const i = state.route.route.directions.findIndex((d) => d.id === state.config.directionId);
  return i >= 0 ? i : 0;
}

export function currentDirection(state: GameState) {
  return state.route.route.directions[directionIndexOf(state)];
}

export function currentStopId(state: GameState): string {
  return currentDirection(state).stops[state.stopIndex];
}

export function targetText(state: GameState): string {
  const stop = state.route.stops[currentStopId(state)];
  // Keep the generated GTFS answer tiers backwards-compatible while exposing
  // two clear player-facing levels: short stop name or full intersection.
  const answerTier = state.config.difficulty === 'standard' ? 'easy' : 'standard';
  return stop.answers[answerTier][0];
}

function activeElapsed(state: GameState, at: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, at - state.startedAt - state.pausedTotal);
}

function finish(state: GameState, reason: FinishReason, at: number): GameState {
  // On time-up, pin finishedAt so elapsed reads exactly SPRINT_MS.
  const finishedAt =
    reason === 'time-up' && state.startedAt !== null
      ? state.startedAt + state.pausedTotal + SPRINT_MS
      : at;
  return { ...state, phase: 'finished', finishedAt, finishReason: reason, now: at };
}

function timeUpIfDue(state: GameState, at: number): GameState | null {
  if (state.config.mode !== 'sprint') return null;
  if (state.phase !== 'typing') return null;
  if (activeElapsed(state, at) >= SPRINT_MS) return finish(state, 'time-up', at);
  return null;
}

/** Stops the current run must clear before FINISHED (terminus, or a section cap). */
export function runStopCount(state: GameState): number {
  const remaining = currentDirection(state).stops.length - state.config.startStopIndex;
  if (state.config.mode === 'section') return Math.min(SECTION_LENGTH, remaining);
  return remaining;
}

/** Stop index (inclusive) at which a Full Route / Section run finishes. */
function lastRunStopIndex(state: GameState): number {
  return state.config.startStopIndex + runStopCount(state) - 1;
}

function resetRun(state: GameState): GameState {
  return {
    ...state,
    stopIndex: state.config.startStopIndex,
    input: '',
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    errors: 0,
    streak: 0,
    bestStreak: 0,
    stopHadError: false,
    stopsCompleted: 0,
    startedAt: null,
    finishedAt: null,
    pausedAt: null,
    pausedTotal: 0,
    finishReason: null,
    pausedFrom: null,
  };
}

/** Applies a completed hop: advance to the next stop and reopen typing. */
function advanceStop(state: GameState, at: number): GameState {
  return {
    ...state,
    phase: 'typing',
    stopIndex: state.stopIndex + 1,
    input: '',
    stopHadError: false,
    now: at,
  };
}

/** Records a cleared stop and opens the next target without waiting on motion. */
function completeStop(state: GameState, at: number): GameState {
  const completed: GameState = {
    ...state,
    stopsCompleted: state.stopsCompleted + 1,
    now: at,
  };
  if (state.stopIndex >= lastRunStopIndex(state)) return finish(completed, 'completed', at);
  return advanceStop(completed, at);
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_ROUTE': {
      if (state.phase !== 'config') return state;
      if (action.route.route.id === state.route.route.id) return state;
      // New route: reset direction/start stop, keep mode/difficulty/sound.
      return {
        ...state,
        route: action.route,
        config: {
          ...state.config,
          directionId: action.route.route.directions[0].id,
          startStopIndex: 0,
        },
        stopIndex: 0,
      };
    }

    case 'CONFIGURE': {
      if (state.phase !== 'config') return state;
      const config = { ...state.config, ...action.patch };
      // Changing direction invalidates the chosen start stop.
      if (action.patch.directionId && action.patch.directionId !== state.config.directionId) {
        config.startStopIndex = 0;
      }
      return { ...state, config };
    }

    case 'START': {
      if (state.phase !== 'config') return state;
      return { ...resetRun(state), phase: 'countdown', quickRestart: false, now: action.at };
    }

    case 'COUNTDOWN_DONE': {
      if (state.phase !== 'countdown') return state;
      return { ...state, phase: 'typing', startedAt: action.at, now: action.at };
    }

    case 'INPUT': {
      if (state.phase !== 'typing') return state;
      const dueBefore = timeUpIfDue(state, action.at);
      if (dueBefore) return dueBefore;

      const target = targetText(state);
      const targetChars = [...target];
      const prevChars = [...state.input];
      const nextChars = [...action.value];

      // Backspace/editing a correct prefix is allowed without rewriting history,
      // but it breaks the live combo so characters cannot be farmed repeatedly.
      if (
        nextChars.length < prevChars.length &&
        nextChars.every((char, index) => char === prevChars[index])
      ) {
        return { ...state, input: action.value, streak: 0, now: action.at };
      }

      const appendedToCurrent =
        nextChars.length >= prevChars.length &&
        prevChars.every((char, index) => char === nextChars[index]);
      if (!appendedToCurrent) return state;

      let { totalKeystrokes, correctKeystrokes, errors, stopHadError, streak, bestStreak } = state;
      const acceptedChars = [...prevChars];
      if (nextChars.length > prevChars.length) {
        for (let i = prevChars.length; i < nextChars.length; i++) {
          totalKeystrokes += 1;
          const expected = targetChars[acceptedChars.length];
          if (
            expected !== undefined &&
            foldChar(nextChars[i], state.config.difficulty) === foldChar(expected, state.config.difficulty)
          ) {
            correctKeystrokes += 1;
            acceptedChars.push(nextChars[i]);
            streak += 1;
            bestStreak = Math.max(bestStreak, streak);
          } else {
            errors += 1;
            stopHadError = true;
            streak = 0;
          }
        }
      }

      // Wrong keys are deliberately not stored. The cursor stays on the same
      // character, so the player can continue without reaching for Backspace.
      const input = acceptedChars.join('');
      const complete = isAnswerMatch(input, [target], state.config.difficulty);
      const nextState: GameState = {
        ...state,
        input,
        totalKeystrokes,
        correctKeystrokes,
        errors,
        stopHadError,
        streak,
        bestStreak,
        now: action.at,
      };
      return complete ? completeStop(nextState, action.at) : nextState;
    }

    case 'TICK': {
      if (state.phase === 'finished' || state.phase === 'config' || state.phase === 'paused') return state;
      const due = timeUpIfDue(state, action.at);
      if (due) return due;
      return { ...state, now: action.at };
    }

    case 'PAUSE': {
      if (state.phase !== 'typing') return state;
      return {
        ...state,
        phase: 'paused',
        pausedFrom: 'typing',
        pausedAt: action.at,
        now: action.at,
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused') return state;
      const pausedTotal = state.pausedTotal + (state.pausedAt !== null ? action.at - state.pausedAt : 0);
      return {
        ...state,
        phase: state.pausedFrom ?? 'typing',
        pausedFrom: null,
        pausedAt: null,
        pausedTotal,
        now: action.at,
      };
    }

    case 'INVALID_ACTION': {
      if (state.phase !== 'typing') return state;
      // e.g. paste attempt: one invalid keystroke (PRD §8).
      return {
        ...state,
        totalKeystrokes: state.totalKeystrokes + 1,
        errors: state.errors + 1,
        stopHadError: true,
        streak: 0,
      };
    }

    case 'TOGGLE_SOUND': {
      // Allowed in any phase (PRD §6 focus-rule exception buttons).
      return { ...state, config: { ...state.config, soundOn: !state.config.soundOn } };
    }

    case 'RESTART': {
      if (state.phase !== 'finished' && state.phase !== 'paused') return state;
      return { ...resetRun(state), phase: 'countdown', quickRestart: true, now: action.at };
    }

    case 'EXIT': {
      return { ...resetRun(state), phase: 'config', quickRestart: false };
    }

    default:
      return state;
  }
}
