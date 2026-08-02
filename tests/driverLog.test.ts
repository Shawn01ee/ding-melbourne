import { describe, expect, it } from 'vitest';
import {
  directionsCompleted,
  emptyStats,
  formatDrivingTime,
  isFullLineRun,
  linesCompleted,
  recordRun,
  routeBestTime,
  routeBestWpm,
  type RouteLog,
  type RunSnapshot,
} from '../src/game/driverLog';

const base: RunSnapshot = {
  routeShort: '96',
  directionId: 'to-east-brunswick',
  mode: 'full-route',
  startStopIndex: 0,
  completed: true,
  stops: 38,
  timeMs: 240_000,
  wpm: 52.4,
  errors: 3,
  bestStreak: 120,
  at: '2026-07-25T10:00:00.000Z',
};

describe('isFullLineRun', () => {
  it('requires full-route mode, completion, and boarding at the first stop', () => {
    expect(isFullLineRun(base)).toBe(true);
    expect(isFullLineRun({ ...base, mode: 'section' })).toBe(false);
    expect(isFullLineRun({ ...base, mode: 'sprint' })).toBe(false);
    expect(isFullLineRun({ ...base, completed: false })).toBe(false);
    expect(isFullLineRun({ ...base, startStopIndex: 3 })).toBe(false);
  });
});

describe('recordRun', () => {
  it('accumulates lifetime totals and tracks bests', () => {
    let { stats, log } = recordRun(emptyStats(), {}, base);
    ({ stats, log } = recordRun(stats, log, {
      ...base,
      at: '2026-07-25T11:00:00.000Z',
      stops: 10,
      timeMs: 60_000,
      wpm: 61.2,
      errors: 1,
      bestStreak: 80,
      mode: 'section',
    }));

    expect(stats.runs).toBe(2);
    expect(stats.stopsCleared).toBe(48);
    expect(stats.timeMs).toBe(300_000);
    expect(stats.errors).toBe(4);
    expect(stats.bestWpm).toBeCloseTo(61.2);
    expect(stats.bestCombo).toBe(120);
    expect(stats.firstAt).toBe(base.at);
    expect(stats.lastAt).toBe('2026-07-25T11:00:00.000Z');
    expect(log['96'].runs).toBe(2);
  });

  it('marks fullLine only for end-to-end full-route completions and keeps the fastest', () => {
    let { log } = recordRun(emptyStats(), {}, { ...base, timeMs: 250_000 });
    ({ log } = recordRun(emptyStats(), log, { ...base, timeMs: 230_000 }));
    ({ log } = recordRun(emptyStats(), log, { ...base, mode: 'section', timeMs: 50_000 }));

    const dir = log['96'].directions['to-east-brunswick'];
    expect(dir.fullLine).toBe(true);
    expect(dir.bestTimeMs).toBe(230_000); // section run must not lower it
    expect(dir.runs).toBe(3);
  });

  it('keeps a section-only route visible but not completed', () => {
    const { log } = recordRun(emptyStats(), {}, { ...base, mode: 'section' });
    expect(log['96'].runs).toBe(1);
    expect(directionsCompleted(log['96'])).toBe(0);
    expect(linesCompleted(log)).toBe(0);
  });
});

describe('collection helpers', () => {
  const log: RouteLog = {
    '96': {
      runs: 4,
      directions: {
        a: { runs: 2, fullLine: true, bestTimeMs: 200_000, bestWpm: 55 },
        b: { runs: 2, fullLine: true, bestTimeMs: 210_000, bestWpm: 61 },
      },
    },
    '11': {
      runs: 1,
      directions: { a: { runs: 1, fullLine: false, bestTimeMs: null, bestWpm: 40 } },
    },
  };

  it('counts lines and directions completed', () => {
    expect(linesCompleted(log)).toBe(1);
    expect(directionsCompleted(log['96'])).toBe(2);
    expect(directionsCompleted(log['11'])).toBe(0);
    expect(directionsCompleted(undefined)).toBe(0);
  });

  it('reports route bests', () => {
    expect(routeBestTime(log['96'])).toBe(200_000);
    expect(routeBestTime(log['11'])).toBeNull();
    expect(routeBestWpm(log['96'])).toBe(61);
    expect(routeBestWpm(undefined)).toBe(0);
  });
});

describe('formatDrivingTime', () => {
  it('scales units with magnitude', () => {
    expect(formatDrivingTime(48_000)).toBe('48s');
    expect(formatDrivingTime(12 * 60_000 + 5_000)).toBe('12m 5s');
    expect(formatDrivingTime(3 * 3_600_000 + 24 * 60_000)).toBe('3h 24m');
  });
});
