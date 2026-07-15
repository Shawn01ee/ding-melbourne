import type { Difficulty } from '../data/types';

/**
 * Input normalization (PRD §8).
 * Global St<->Street substitution is forbidden (would corrupt "St Kilda");
 * leniency beyond punctuation/case comes only from curated per-stop aliases.
 */

const CURLY_APOSTROPHES = /[‘’ʼ]/g;
/** Punctuation treated as optional on easy/standard. */
const OPTIONAL_PUNCTUATION = /[/#'.,\-()&]/g;

/** NFKC -> trim -> lowercase -> collapse whitespace. Applied at every difficulty. */
export function normalizeBase(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Canonical comparison form for a full string at a given difficulty. */
export function normalizeForCompare(s: string, difficulty: Difficulty): string {
  const unified = s.replace(CURLY_APOSTROPHES, "'");
  if (difficulty === 'driver') return normalizeBase(unified);
  return normalizeBase(unified.replace(OPTIONAL_PUNCTUATION, ' '));
}

/** True when input matches any curated answer for the difficulty. */
export function isAnswerMatch(input: string, answers: string[], difficulty: Difficulty): boolean {
  const candidate = normalizeForCompare(input, difficulty);
  if (candidate.length === 0) return false;
  return answers.some((a) => normalizeForCompare(a, difficulty) === candidate);
}

/** Per-character fold used for live keystroke feedback. */
export function foldChar(c: string, difficulty: Difficulty): string {
  let out = c.normalize('NFKC').toLowerCase().replace(CURLY_APOSTROPHES, "'");
  if (difficulty !== 'driver') out = out.replace(OPTIONAL_PUNCTUATION, ' ');
  return out;
}

export type CharStatus = 'correct' | 'wrong' | 'pending';

/** Position-by-position status of typed input against the display target. */
export function charStatuses(input: string, target: string, difficulty: Difficulty): CharStatus[] {
  const targetChars = [...target];
  const inputChars = [...input];
  return targetChars.map((tc, i) => {
    if (i >= inputChars.length) return 'pending';
    return foldChar(inputChars[i], difficulty) === foldChar(tc, difficulty) ? 'correct' : 'wrong';
  });
}
