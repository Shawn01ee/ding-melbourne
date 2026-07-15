import type { GameConfig, Mode } from '../game/reducer';

/** localStorage keys are versioned for schema migration (PRD §14). */
const KEY_SETTINGS = 'ding.settings.v1';
const KEY_PERSONAL_BEST = 'ding.personalBest.v1';
const KEY_LAST_CONFIG = 'ding.lastConfig.v1';

export interface StoredSettings {
  soundOn: boolean;
  difficulty: GameConfig['difficulty'];
}

export interface PersonalBest {
  timeMs: number;
  stops: number;
  accuracy: number;
  wpm: number;
  score: number;
  at: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode); the game must still play.
  }
}

export function loadSettings(): StoredSettings | null {
  return read<StoredSettings>(KEY_SETTINGS);
}

export function saveSettings(settings: StoredSettings): void {
  write(KEY_SETTINGS, settings);
}

export function loadLastConfig(): Partial<GameConfig> | null {
  return read<Partial<GameConfig>>(KEY_LAST_CONFIG);
}

export function saveLastConfig(config: GameConfig): void {
  write(KEY_LAST_CONFIG, config);
}

export function pbKey(routeId: string, config: GameConfig): string {
  return [routeId, config.directionId, config.mode, config.difficulty, config.startStopIndex].join(':');
}

export function loadBest(key: string): PersonalBest | null {
  const all = read<Record<string, PersonalBest>>(KEY_PERSONAL_BEST) ?? {};
  return all[key] ?? null;
}

export function saveBest(key: string, best: PersonalBest): void {
  const all = read<Record<string, PersonalBest>>(KEY_PERSONAL_BEST) ?? {};
  all[key] = best;
  write(KEY_PERSONAL_BEST, all);
}

/** Full route: faster clear wins. Sprint: more stops, then higher wpm. */
export function isBetter(mode: Mode, next: PersonalBest, prev: PersonalBest | null): boolean {
  if (!prev) return true;
  if (mode === 'sprint') {
    if (next.stops !== prev.stops) return next.stops > prev.stops;
    return next.wpm > prev.wpm;
  }
  return next.timeMs < prev.timeMs;
}
