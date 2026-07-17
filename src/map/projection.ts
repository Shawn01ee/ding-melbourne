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

export interface ProjectedPose {
  x: number;
  y: number;
  angleDeg: number;
}

interface TracedPoint {
  x: number;
  y: number;
  /** Index of this vertex in the uncleaned source shape. */
  sourceIndex: number;
  /** Arc-length fraction at this vertex before geometry cleanup. */
  sourceProgress: number;
}

const HAIRPIN_COSINE = -0.75;
const MIN_SEGMENT = 1e-7;
const MIN_RETRACE_PROGRESS = 0.002;
const MAX_RETRACE_GAP = 2.5;
const MIN_RETRACE_LENGTH = 8;
const MAX_RETRACE_AREA_RATIO = 0.012;

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

/** Remove narrow out-and-back sections while preserving real loops with area. */
function eraseRetracedLoops(points: TracedPoint[]): TracedPoint[] {
  const clean: TracedPoint[] = [];

  for (const point of points) {
    let loopStart = -1;
    for (let i = clean.length - 3; i >= 0; i--) {
      const sourceSpan = point.sourceProgress - clean[i].sourceProgress;
      if (sourceSpan < MIN_RETRACE_PROGRESS) continue;
      if (Math.hypot(point.x - clean[i].x, point.y - clean[i].y) > MAX_RETRACE_GAP) continue;

      const candidate = [...clean.slice(i), point];
      let length = 0;
      let twiceArea = 0;
      for (let j = 1; j < candidate.length; j++) {
        length += Math.hypot(
          candidate[j].x - candidate[j - 1].x,
          candidate[j].y - candidate[j - 1].y,
        );
      }
      for (let j = 0; j < candidate.length; j++) {
        const a = candidate[j];
        const b = candidate[(j + 1) % candidate.length];
        twiceArea += a.x * b.y - b.x * a.y;
      }
      const areaRatio = Math.abs(twiceArea) / 2 / Math.max(length * length, 1);
      if (length >= MIN_RETRACE_LENGTH && areaRatio <= MAX_RETRACE_AREA_RATIO) {
        loopStart = i;
        break;
      }
    }

    if (loopStart >= 0) clean.splice(loopStart);
    clean.push(point);
  }

  return clean;
}

function sanitiseGeometry(points: { x: number; y: number }[]): TracedPoint[] {
  const { lengths, total } = segmentLengths(points);
  const sourceArcs = [0];
  for (const length of lengths) sourceArcs.push(sourceArcs[sourceArcs.length - 1] + length);

  const traced = points.map((point, index) => ({
    ...point,
    sourceIndex: index,
    sourceProgress: total > 0 ? sourceArcs[index] / total : 0,
  }));
  const clean: TracedPoint[] = [];

  // Some published shapes also contain a one-vertex overshoot at a junction.
  // A real tram cannot reverse heading by more than ~139° at one vertex.
  for (const point of eraseRetracedLoops(traced)) {
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
  return createPath(sanitiseGeometry(projected));
}

/**
 * Project a cleaned path through a larger shared geographic frame.
 *
 * Cleanup is deliberately decided in the route's own fitted frame. If it ran
 * after fitting the whole Melbourne network, short retraces on compact routes
 * would shrink below the pixel thresholds and reappear in route previews.
 */
export function projectPathInFrame(
  shape: [number, number][],
  referenceShape: [number, number][],
  width: number,
  height: number,
  padding: number,
): ProjectedPath {
  const fitted = projectCoordinates(shape, shape, width, height, padding);
  const clean = sanitiseGeometry(fitted);
  const framed = projectCoordinates(shape, referenceShape, width, height, padding);
  return createPath(clean.map((point) => ({
    ...point,
    x: framed[point.sourceIndex].x,
    y: framed[point.sourceIndex].y,
  })));
}

/**
 * Sample the vehicle position at p while deriving its heading from a short
 * centred chord. SVG animateMotion chooses one side of a polyline vertex,
 * which can make the tram visibly snap or appear to turn back at tight CBD
 * corners even though its position is still advancing.
 */
export function smoothPathPose(
  path: ProjectedPath,
  p: number,
  headingWindow = 0.006,
): ProjectedPose {
  const progress = Math.min(Math.max(p, 0), 1);
  const position = path.pointAt(progress);
  const before = path.pointAt(Math.max(0, progress - headingWindow));
  const after = path.pointAt(Math.min(1, progress + headingWindow));
  const dx = after.x - before.x;
  const dy = after.y - before.y;

  return {
    x: position.x,
    y: position.y,
    angleDeg: Math.hypot(dx, dy) > MIN_SEGMENT
      ? (Math.atan2(dy, dx) * 180) / Math.PI
      : position.angleDeg,
  };
}
