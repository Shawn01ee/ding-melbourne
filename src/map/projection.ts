/**
 * Projects a [lon, lat] polyline into SVG space and answers
 * "where is progress p (0..1 of arc length) on that path?".
 * Equirectangular with cos(midLat) x-scaling — plenty for a schematic map.
 */

export interface ProjectedPath {
  points: { x: number; y: number }[];
  /** Point + tangent angle (degrees) at arc-length fraction p. */
  pointAt(p: number): { x: number; y: number; angleDeg: number };
  /** Projected points from the start up to fraction p (for the completed overlay). */
  pointsUpTo(p: number): { x: number; y: number }[];
}

export function projectPath(
  shape: [number, number][],
  width: number,
  height: number,
  padding: number,
): ProjectedPath {
  const lats = shape.map(([, lat]) => lat);
  const lons = shape.map(([lon]) => lon);
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

  const points = shape.map(([lon, lat]) => ({
    x: offsetX + (lon - minLon) * kx * scale,
    y: offsetY + (maxLat - lat) * scale,
  }));

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segmentLengths.push(d);
    total += d;
  }

  function locate(p: number): { seg: number; t: number } {
    const targetLen = Math.min(Math.max(p, 0), 1) * total;
    let acc = 0;
    for (let i = 0; i < segmentLengths.length; i++) {
      if (acc + segmentLengths[i] >= targetLen || i === segmentLengths.length - 1) {
        const t = segmentLengths[i] > 0 ? (targetLen - acc) / segmentLengths[i] : 0;
        return { seg: i, t: Math.min(Math.max(t, 0), 1) };
      }
      acc += segmentLengths[i];
    }
    return { seg: 0, t: 0 };
  }

  return {
    points,
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
      const upTo = points.slice(0, seg + 1);
      const a = points[seg];
      const b = points[seg + 1] ?? a;
      upTo.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return upTo;
    },
  };
}
