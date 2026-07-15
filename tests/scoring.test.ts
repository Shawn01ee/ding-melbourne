import { describe, expect, it } from 'vitest';
import { accuracy, score, SCORE_TUNING, wpm } from '../src/game/scoring';

describe('accuracy', () => {
  it('is correct/total x 100', () => {
    expect(accuracy(9, 10)).toBe(90);
    expect(accuracy(10, 10)).toBe(100);
  });

  it('guards division by zero with max(total, 1)', () => {
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe('wpm', () => {
  it('is (chars/5)/minutes', () => {
    expect(wpm(25, 30_000)).toBe(10); // 5 words in half a minute
    expect(wpm(50, 60_000)).toBe(10);
  });

  it('returns 0 for zero or negative elapsed time', () => {
    expect(wpm(25, 0)).toBe(0);
  });
});

describe('score', () => {
  it('combines stops, streak, speed and error penalty', () => {
    const s = score({ stops: 5, bestStreak: 3, wpm: 40, errors: 2 });
    expect(s).toBe(
      5 * SCORE_TUNING.perStop +
        3 * SCORE_TUNING.perStreak +
        40 * SCORE_TUNING.perWpm -
        2 * SCORE_TUNING.perError,
    );
  });

  it('never goes below zero', () => {
    expect(score({ stops: 0, bestStreak: 0, wpm: 0, errors: 100 })).toBe(0);
  });
});
