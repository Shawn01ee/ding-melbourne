import { describe, expect, it } from 'vitest';
import { AVAILABLE_ROUTES, DEFAULT_ROUTE } from '../src/data/routes';

const CURRENT_TRAM_ROUTES = [
  '1', '3', '5', '6', '11', '12', '16', '19', '30', '35', '48', '57',
  '58', '59', '64', '67', '70', '72', '75', '78', '82', '86', '96', '109',
];

describe('generated Melbourne tram registry', () => {
  it('contains the complete 2026-07-10 official route set', () => {
    const actual = AVAILABLE_ROUTES.map(({ data }) => data.route.shortName).sort((a, b) => Number(a) - Number(b));
    expect(actual).toEqual(CURRENT_TRAM_ROUTES);
  });

  it('keeps Route 96 as the first-visit default and supports the one-way City Circle', () => {
    expect(DEFAULT_ROUTE?.route.shortName).toBe('96');
    const cityCircle = AVAILABLE_ROUTES.find(({ data }) => data.route.shortName === '35');
    expect(cityCircle?.data.route.directions).toHaveLength(1);
  });

  it('uses the latest source date for every generated line', () => {
    expect(new Set(AVAILABLE_ROUTES.map(({ data }) => data.sourceUpdatedAt))).toEqual(new Set(['2026-07-10']));
  });
});
