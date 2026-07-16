/**
 * Projects a [lon, lat] polyline into SVG space and answers
 * "where is progress p (0..1 of arc length) on that path?".
 * Equirectangular with cos(midLat) x-scaling — plenty for a schematic map.
 */

export interface ProjectedPath {
  points: { x: number; y: number }[];
  /** Map source-shape arc progress onto the sanitised rendered path. */
  remapProgress(p: number): number;
  /** Point + tangent angle (degrees) at arc-length fraction p. */
  pointAt(p: number): { x: number; y: number; angleDeg: number };
  /** Projected points from the start up to fraction p (for the completed overlay). */
  pointsUpTo(p: number): { x: number; y: number }[];
}

interface TracedPoint {
  x: number;
  y: number;
  /** Arc-length fraction at this vertex before geometry cleanup. */
  sourceProgress: number;
}

const HAIRPIN_COSINE = -0.75;
const MIN_SEGMENT = 1e-7;

function segmentLengths(points: { x: number; y: number }[]): { lengths: number[]; total: number } {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(length);
    total += length;
  }
  return { lengths, total };
}

/**
 * Remove single-vertex reversals from published shapes.
 *
 * Some GTFS polylines contain tiny overshoot-and-return spikes at junctions.
 * They are valid ordered coordinates but make a vehicle visibly reverse along
 * an otherwise forward trip. Real tram curves cannot change heading by more
 * than ~139° at one vertex, so erase only those near-U-turn middle points.
 */
function sanitiseHairpins(points: { x: number; y: number }[]): TracedPoint[] {
  const { lengths, total } = segmentLengths(points);
  const sourceArcs = [0];
  for (const length of lengths) sourceArcs.push(sourceArcs[sourceArcs.length - 1] + length);

  const traced = points.map((point, index) => ({
    ...point,
    sourceProgress: total > 0 ? sourceArcs[index] / total : 0,
  }));
  const clean: TracedPoint[] = [];

  for (const point of traced) {
    const previous = clean[clean.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < MIN_SEGMENT) continue;
    clean.push(point);

    while (clean.length >= 3) {
      const a = clean[clean.length - 3];
      const b = clean[clean.length - 2];
      const c = clean[clean.length - 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;
      const ab = Math.hypot(abx, aby);
      const bc = Math.hypot(bcx, bcy);
      if (ab < MIN_SEGMENT || bc < MIN_SEGMENT) {
        clean.splice(clean.length - 2, 1);
        continue;
      }
      const cosine = (abx * bcx + aby * bcy) / (ab * bc);
      if (cosine > HAIRPIN_COSINE) break;
      clean.splice(clean.length - 2, 1);
    }
  }

  return clean.length >= 2 ? clean : traced.slice(0, 2);
}

function createPath(points: TracedPoint[]): ProjectedPath {
  const { lengths, total } = segmentLengths(points);
  const arcs = [0];
  for (const length of lengths) arcs.push(arcs[arcs.length - 1] + length);
  const publicPoints = points.map(({ x, y }) => ({ x, y }));

  function locate(p: number): { seg: number; t: number } {
    const targetLen = Math.min(Math.max(p, 0), 1) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (arcs[i + 1] >= targetLen || i === lengths.length - 1) {
        const t = lengths[i] > 0 ? (targetLen - arcs[i]) / lengths[i] : 0;
        return { seg: i, t: Math.min(Math.max(t, 0), 1) };
      }
    }
    return { seg: 0, t: 0 };
  }

  return {
    points: publicPoints,
    remapProgress(p: number) {
      const source = Math.min(Math.max(p, 0), 1);
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (b.sourceProgress >= source || i === points.length - 2) {
          const sourceSpan = b.sourceProgress - a.sourceProgress;
          const t = sourceSpan > 0 ? (source - a.sourceProgress) / sourceSpan : 0;
          const mappedArc = arcs[i] + lengths[i] * Math.min(Math.max(t, 0), 1);
          return total > 0 ? mappedArc / total : 0;
        }
      }
      return 1;
    },
    pointAt(p: number) {
      const { seg, t } = locate(p);
      const a = points[seg];
      const b = points[seg + 1] ?? a;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
    },
    pointsUpTo(p: number) {
      const { seg, t } = locate(p);
      const upTo = publicPoints.slice(0, seg + 1);
      const a = points[seg];
      const b = points[seg + 1] ?? a;
      upTo.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return upTo;
    },
  };
}

/** Project any shape through the geographic frame established by a reference shape. */
export function projectCoordinates(
  shape: [number, number][],
  referenceShape: [number, number][],
  width: number,
  height: number,
  padding: number,
): { x: number; y: number }[] {
  const lats = referenceShape.map(([, lat]) => lat);
  const lons = referenceShape.map(([lon]) => lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((maxLon - minLon) * kx, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return shape.map(([lon, lat]) => ({
    x: offsetX + (lon - minLon) * kx * scale,
    y: offsetY + (maxLat - lat) * scale,
  }));
}

export function projectPath(
  shape: [number, number][],
  width: number,
  height: number,
  padding: number,
): ProjectedPath {
  const projected = projectCoordinates(shape, shape, width, height, padding);
  return createPath(sanitiseHairpins(projected));
}
