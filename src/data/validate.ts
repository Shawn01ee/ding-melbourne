import type { RouteData } from './types';
import { stopProgress } from './types';

export type ValidationResult =
  | { ok: true; data: RouteData }
  | { ok: false; problems: string[] };

/**
 * Runtime validation of a generated route JSON (PRD §10 + AC-09).
 * Any failure must surface a clear data-error UI, never a silent crash.
 */
export function validateRouteData(raw: unknown): ValidationResult {
  const problems: string[] = [];
  const data = raw as RouteData;

  if (!data || typeof data !== 'object') {
    return { ok: false, problems: ['route data is not an object'] };
  }
  if (typeof data.schemaVersion !== 'number') problems.push('schemaVersion missing');
  if (!data.route || typeof data.route !== 'object') {
    return { ok: false, problems: [...problems, 'route missing'] };
  }
  if (!data.stops || typeof data.stops !== 'object') {
    return { ok: false, problems: [...problems, 'stops dictionary missing'] };
  }

  const dirs = data.route.directions;
  if (!Array.isArray(dirs) || dirs.length < 2) {
    problems.push('route needs at least 2 directions');
  } else {
    for (const dir of dirs) {
      if (!Array.isArray(dir.stops) || dir.stops.length < 2) {
        problems.push(`direction "${dir.id}" needs at least 2 stops`);
        continue;
      }
      for (const stopId of dir.stops) {
        if (!data.stops[stopId]) problems.push(`direction "${dir.id}" references unknown stop "${stopId}"`);
      }
      if (!Array.isArray(dir.shape) || dir.shape.length < 2) {
        problems.push(`direction "${dir.id}" shape needs at least 2 points`);
      } else {
        for (const [lon, lat] of dir.shape) {
          if (typeof lon !== 'number' || typeof lat !== 'number' || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
            problems.push(`direction "${dir.id}" has an out-of-range shape coordinate`);
            break;
          }
        }
      }
    }

    // progress must be strictly increasing along each direction (0..1)
    for (const dir of dirs) {
      if (!Array.isArray(dir.stops)) continue;
      let prev = -Infinity;
      for (const stopId of dir.stops) {
        const stop = data.stops[stopId];
        if (!stop) continue;
        const p = stopProgress(data, stopId);
        if (typeof p !== 'number' || p < 0 || p > 1) {
          problems.push(`stop "${stopId}" progress out of range`);
        } else if (p <= prev) {
          problems.push(`direction "${dir.id}" progress not increasing at stop "${stopId}"`);
        }
        prev = p;
      }
    }
  }

  for (const [id, stop] of Object.entries(data.stops)) {
    if (!stop.displayName) problems.push(`stop "${id}" missing displayName`);
    const answers = stop.answers;
    if (!answers) {
      problems.push(`stop "${id}" missing answers`);
      continue;
    }
    for (const level of ['easy', 'standard', 'driver'] as const) {
      if (!Array.isArray(answers[level]) || answers[level].length === 0 || answers[level].some((a) => !a)) {
        problems.push(`stop "${id}" has empty ${level} answers`);
      }
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, data };
}
