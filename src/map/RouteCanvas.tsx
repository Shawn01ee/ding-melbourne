import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteData } from '../data/types';
import { stopProgress } from '../data/types';
import { projectCoordinates, projectPath } from './projection';

const VIEW_W = 1000;
const VIEW_H = 640;
const PADDING = 70;
const FOLLOW_MS = 180;

// Following-camera tuning: aim to keep roughly this many stops across the
// viewport so long routes (70+ stops) stay legible instead of collapsing.
const TARGET_STOPS_ACROSS = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const LABEL_RADIUS = 1; // name only the immediate previous/next stop; others are dots

interface RouteCanvasProps {
  route: RouteData;
  networkRoutes?: RouteData[];
  directionIndex: number;
  stopIndex: number;
  startStopIndex: number;
  /** Accepted-character progress toward the current stop, from 0 to 1. */
  typedProgress: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Keep the live stop label on the lower normal of the rail, not on the rail itself. */
function currentLabelOffset(angleDeg: number): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  let x = -Math.sin(angle) * 58;
  let y = Math.cos(angle) * 58;
  if (y < 0) {
    x *= -1;
    y *= -1;
  }
  return { x, y: Math.max(34, y) };
}

export function RouteCanvas({
  route,
  networkRoutes = [],
  directionIndex,
  stopIndex,
  startStopIndex,
  typedProgress,
}: RouteCanvasProps) {
  const direction = route.route.directions[directionIndex];
  const reducedMotion = usePrefersReducedMotion();
  const activeStop = route.stops[direction.stops[stopIndex]];
  const activeName = activeStop.landmark ?? activeStop.displayName.split('/')[0];

  const path = useMemo(() => projectPath(direction.shape, VIEW_W, VIEW_H, PADDING), [direction]);
  const ghostPaths = useMemo(
    () =>
      networkRoutes
        .filter((candidate) => candidate.route.id !== route.route.id)
        .map((candidate) =>
          projectCoordinates(
            candidate.route.directions[0].shape,
            direction.shape,
            VIEW_W,
            VIEW_H,
            PADDING,
          ),
        ),
    [direction, networkRoutes, route.route.id],
  );

  // Projected world points for every stop, plus a stable zoom derived from
  // the median gap between consecutive stops (so ~TARGET_STOPS_ACROSS fit).
  const { stopPoints, zoom } = useMemo(() => {
    const pts = direction.stops.map((id) => path.pointAt(stopProgress(route, id)));
    const gaps: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      gaps.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const gap = median(gaps) || VIEW_W;
    const halfSpan = (gap * TARGET_STOPS_ACROSS) / 2;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, VIEW_W / 2 / Math.max(halfSpan, 1)));
    return { stopPoints: pts, zoom: z };
  }, [direction, path, route]);

  const progressOf = (index: number) => stopProgress(route, direction.stops[index]);
  // The first prompt is typed at the boarding stop. From then on, accepted
  // characters physically pull the tram from the previous stop to the current
  // target. Wrong keys leave this value unchanged and never block the input.
  const fromIndex = Math.max(startStopIndex, stopIndex - 1);
  const fromProgress = progressOf(fromIndex);
  const toProgress = progressOf(stopIndex);
  const desiredProgress =
    stopIndex === startStopIndex
      ? toProgress
      : fromProgress + (toProgress - fromProgress) * Math.min(1, Math.max(0, typedProgress));

  const [tramProgress, setTramProgress] = useState(desiredProgress);
  const tramProgressRef = useRef(desiredProgress);
  const rafRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = tramProgressRef.current;
    const to = desiredProgress;
    if (reducedMotion || Math.abs(to - from) < 0.000001) {
      tramProgressRef.current = to;
      setTramProgress(to);
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / FOLLOW_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      const value = from + (to - from) * eased;
      tramProgressRef.current = value;
      setTramProgress(value);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [desiredProgress, reducedMotion]);

  const tram = path.pointAt(tramProgress);
  const labelOffset = currentLabelOffset(tram.angleDeg);
  const completed = path.pointsUpTo(tramProgress);
  const color = route.route.color;

  // Follow camera: scale world by `zoom`, translate so the tram sits slightly
  // above centre, leaving breathing room for the overlaid driving console.
  // Inverse factor k keeps dot/label/tram sizes constant on screen at any zoom.
  const s = zoom;
  const k = 1 / s;
  const tx = VIEW_W / 2 - s * tram.x;
  const ty = VIEW_H * 0.43 - s * tram.y;

  const toPolyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg
      className="route-canvas"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Route ${route.route.shortName} map, tram heading to ${direction.headsign}`}
    >
      <defs>
        <pattern id="map-grid" width="38" height="38" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="map-grid-dot" />
        </pattern>
        <filter id="tram-shadow" x="-70%" y="-100%" width="240%" height="300%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#17211d" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect className="map-backdrop" width={VIEW_W} height={VIEW_H} />
      <rect className="map-grid" width={VIEW_W} height={VIEW_H} fill="url(#map-grid)" />
      <text className="map-side-caption" x="28" y="350" transform="rotate(-90 28 350)" aria-hidden="true">
        DING! MELBOURNE · ROUTE {route.route.shortName} · {direction.headsign}
      </text>
      <text
        className="map-watermark"
        x={VIEW_W / 2}
        y={165}
        textAnchor="middle"
        textLength={activeName.length > 18 ? 780 : undefined}
        lengthAdjust={activeName.length > 18 ? 'spacingAndGlyphs' : undefined}
        aria-hidden="true"
      >
        {activeName}
      </text>

      <g transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`}>
        <g className="ghost-network" aria-hidden="true">
          {ghostPaths.map((points, index) => (
            <polyline
              key={index}
              points={toPolyline(points)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <polyline
          className="rail rail-casing"
          points={toPolyline(path.points)}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          className="rail rail-base"
          points={toPolyline(path.points)}
          stroke={color}
          strokeOpacity={0.18}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          className="rail rail-done"
          points={toPolyline(completed)}
          stroke={color}
          vectorEffect="non-scaling-stroke"
        />

        {/* Dots pass: every stop, drawn under the tram. */}
        {direction.stops.map((stopId, i) => {
          const p = stopPoints[i];
          const isCurrent = i === stopIndex;
          const status = i < stopIndex ? 'past' : isCurrent ? 'current' : 'future';
          return (
            <g key={stopId} className={`stop stop-${status}`}>
              {isCurrent && (
                <circle className="stop-pulse" cx={p.x} cy={p.y} r={16 * k} vectorEffect="non-scaling-stroke" />
              )}
              <circle cx={p.x} cy={p.y} r={(isCurrent ? 8 : 5) * k} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}

        <g
          className="tram"
          filter="url(#tram-shadow)"
          transform={`translate(${tram.x} ${tram.y}) scale(${(k * 1.28).toFixed(4)}) rotate(${tram.angleDeg})`}
        >
          <rect x={-30} y={-14} width={60} height={28} rx={11} fill="#FFFFFF" />
          {/* Melbourne-livery-inspired (not a replica): off-white body,
              green end caps, chartreuse doors, charcoal windows */}
          <rect x={-26} y={-11} width={52} height={22} rx={8} fill="#F7F8F2" />
          <rect x={-26} y={-11} width={11} height={22} rx={8} fill="#50A83B" />
          <rect x={-20} y={-11} width={5} height={22} fill="#50A83B" />
          <rect x={15} y={-11} width={11} height={22} rx={8} fill="#50A83B" />
          <rect x={15} y={-11} width={5} height={22} fill="#50A83B" />
          <rect x={-13} y={-11} width={7} height={22} fill="#C3D82E" />
          <rect x={3} y={-11} width={7} height={22} fill="#C3D82E" />
          <rect x={-24} y={-6} width={5} height={7} rx={1.5} fill="#17211D" />
          <rect x={-4} y={-6} width={6} height={8} rx={1.5} fill="#17211D" />
          {/* cab window with a little face so the tram reads as a character */}
          <rect x={17} y={-7} width={7.5} height={10} rx={2} fill="#F6F5EF" />
          <circle cx={19.2} cy={-3.2} r={1.3} fill="#17211D" />
          <circle cx={22.4} cy={-3.2} r={1.3} fill="#17211D" />
          <path d="M19 0.4 Q20.8 2.4 22.6 0.4" fill="none" stroke="#17211D" strokeWidth={1.3} strokeLinecap="round" />
          <circle cx={24.6} cy={7} r={1.7} fill="#FFE28A" stroke="#17211D" strokeWidth={0.8} />
          <rect x={-26} y={-11} width={52} height={22} rx={8} fill="none" stroke="#17211D" strokeWidth={2} />
          <line x1={-4} y1={-11} x2={-4} y2={-17} stroke="#17211D" strokeWidth={2} />
          <line x1={-11} y1={-17} x2={3} y2={-17} stroke="#17211D" strokeWidth={2} />
        </g>

        <g
          className="current-map-label"
          transform={`translate(${tram.x} ${tram.y}) scale(${k.toFixed(4)})`}
          aria-hidden="true"
        >
          <text x={labelOffset.x} y={labelOffset.y} textAnchor="middle">{activeName}</text>
          {activeStop.stopNumber && (
            <text
              className="current-map-number"
              x={labelOffset.x}
              y={labelOffset.y + 18}
              textAnchor="middle"
            >
              #{activeStop.stopNumber}
            </text>
          )}
        </g>

        {/* Labels pass: keep only the next stop visible. The current stop has a
            dedicated label under the tram; including the previous label here
            causes collisions on tightly spaced CBD/platform stops. */}
        {direction.stops.map((stopId, i) => {
          if (i <= stopIndex || i - stopIndex > LABEL_RADIUS) return null;
          const p = stopPoints[i];
          const stop = route.stops[stopId];
          const status = 'future';
          return (
            <g key={stopId} className={`stop stop-${status}`}>
              <text
                x={p.x}
                y={p.y - 18 * k}
                textAnchor="middle"
                style={{ fontSize: `${15 * k}px` }}
                vectorEffect="non-scaling-stroke"
              >
                {stop.landmark ?? stop.displayName.split('/')[0]}
              </text>
              {stop.stopNumber && (
                <text
                  className="stop-num"
                  x={p.x}
                  y={p.y - 5 * k}
                  textAnchor="middle"
                  style={{ fontSize: `${11 * k}px` }}
                >
                  #{stop.stopNumber}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
