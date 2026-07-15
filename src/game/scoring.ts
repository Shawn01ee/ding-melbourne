/** Scoring formulas (PRD §8). Tunable constants kept in one place. */

export const SCORE_TUNING = {
  perStop: 100,
  perStreak: 20,
  perWpm: 2,
  perError: 5,
} as const;

/** Accuracy = correctKeystrokes / max(totalKeystrokes, 1) x 100 */
export function accuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  return (correctKeystrokes / Math.max(totalKeystrokes, 1)) * 100;
}

/** WPM = (correctCharacters / 5) / elapsedMinutes */
export function wpm(correctCharacters: number, elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  if (minutes <= 0) return 0;
  return correctCharacters / 5 / minutes;
}

/** Score = stops x 100 + streakBonus + speedBonus - errorPenalty (floored at 0) */
export function score(input: { stops: number; bestStreak: number; wpm: number; errors: number }): number {
  const raw =
    input.stops * SCORE_TUNING.perStop +
    input.bestStreak * SCORE_TUNING.perStreak +
    Math.round(input.wpm) * SCORE_TUNING.perWpm -
    input.errors * SCORE_TUNING.perError;
  return Math.max(0, Math.round(raw));
}
