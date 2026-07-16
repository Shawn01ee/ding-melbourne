import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_ROUTES,
  DEFAULT_ROUTE,
  ROUTE_SOURCE_UPDATED_AT,
  loadRoute,
} from '../src/data/routes';
import { initialState, targetText } from '../src/game/reducer';

const CURRENT_TRAM_ROUTES = [
  '1', '3', '5', '6', '11', '12', '16', '19', '30', '35', '48', '57',
  '58', '59', '64', '67', '70', '72', '75', '78', '82', '86', '96', '109',
];

describe('generated Melbourne tram registry', () => {
  it('contains the complete 2026-07-10 official route set', () => {
    const actual = AVAILABLE_ROUTES.map(({ shortName }) => shortName);
    expect(actual).toEqual(CURRENT_TRAM_ROUTES);
  });

  it('starts first visits at Route 1 and supports the one-way City Circle', async () => {
    expect(DEFAULT_ROUTE?.shortName).toBe('1');
    const cityCircle = AVAILABLE_ROUTES.find(({ shortName }) => shortName === '35');
    expect(cityCircle?.directionCount).toBe(1);
    expect((await loadRoute(cityCircle!.id)).route.directions).toHaveLength(1);
  });

  it('uses the latest source date for every generated line', () => {
    expect(ROUTE_SOURCE_UPDATED_AT).toBe('2026-07-10');
    expect(AVAILABLE_ROUTES.every(({ overviewShape }) => overviewShape.length <= 64)).toBe(true);
  });

  it('distinguishes Route 1 consecutive Arts Precinct stops in Standard mode', async () => {
    const route = await loadRoute('tram-1');

    for (const direction of route.route.directions) {
      const indices = direction.stops
        .map((stopId, index) => ({ stop: route.stops[stopId], index }))
        .filter(({ stop }) => stop.answers.easy[0] === 'Arts Precinct')
        .map(({ index }) => index);
      const targets = indices.map((stopIndex) => targetText({
        ...initialState(route, {
          directionId: direction.id,
          startStopIndex: stopIndex,
          difficulty: 'standard',
        }),
        stopIndex,
      }));

      expect(targets).toHaveLength(2);
      expect(new Set(targets)).toEqual(new Set([
        'Arts Precinct Sturt St',
        'Arts Precinct St Kilda Rd',
      ]));
    }
  });
});
