import { describe, expect, it } from 'vitest';
import { INFO_NAV_ITEMS, infoPageFromHash } from '../src/components/ServiceInfo';

describe('passenger information navigation', () => {
  it('maps supported hashes and rejects unknown documents', () => {
    expect(infoPageFromHash('#/play')).toBe('play');
    expect(infoPageFromHash('#data')).toBe('data');
    expect(infoPageFromHash('#/leaderboard')).toBeNull();
    expect(infoPageFromHash('')).toBeNull();
  });

  it('keeps a unique, complete service menu', () => {
    expect(INFO_NAV_ITEMS).toHaveLength(8);
    expect(new Set(INFO_NAV_ITEMS.map((item) => item.id)).size).toBe(INFO_NAV_ITEMS.length);
    expect(INFO_NAV_ITEMS.map((item) => item.id)).toEqual([
      'play',
      'guide',
      'faq',
      'about',
      'accessibility',
      'privacy',
      'terms',
      'data',
    ]);
  });
});
