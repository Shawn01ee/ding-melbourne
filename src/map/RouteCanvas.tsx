import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteData } from '../data/types';
import { stopProgress } from '../data/types';
import type { GameAction, Phase } from '../game/reducer';
import { projectPath } from './projection';

const VIEW_W = 1000;
const VIEW_H = 640;
const PADDING = 70;
const MOVE_MS = 500;
const REDUCED_MOVE_MS = 180;

// Following-camera tuning: aim to keep roughly this many stops across the
// viewport so long routes (70+ stops) stay legible instead of collapsing.
const TARGET_STOPS_ACROSS = 5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const LABEL_RADIUS = 2; // label stops within this many indices of the current one

interface RouteCanvasProps {
  route: RouteData;
  directionIndex: number;
  stopIndex: number;
  phase: Phase;
  dispatch: (action: GameAction) => void;
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

export function RouteCanvas({ route, directionIndex, stopIndex, phase, dispatch }: RouteCanvasProps) {
  const direction = route.route.directions[directionIndex];
  const reducedMotion = usePrefersReducedMotion();

  const path = useMemo(() => projectPath(direction.shape, VIEW_W, VIEW_H, PADDING), [direction]);

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
  const [tramProgress, setTramProgress] = useState(progressOf(stopIndex));
  const rafRef = useRef(0);

  useEffect(() => {
    if (phase !== 'moving') {
      setTramProgress(progressOf(stopIndex));
      return;
    }
    const from = progressOf(stopIndex);
    const to = progressOf(Math.min(stopIndex + 1, direction.stops.length - 1));
    const duration = reducedMotion ? REDUCED_MOVE_MS : MOVE_MS;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = reducedMotion ? (k < 1 ? 0 : 1) : 1 - Math.pow(1 - k, 3);
      setTramProgress(from + (to - from) * eased);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        dispatch({ type: 'MOVE_DONE', at: Date.now() });
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stopIndex, directionIndex, reducedMotion]);

  const tram = path.pointAt(tramProgress);
  const completed = path.pointsUpTo(tramProgress);
  const color = route.route.color;

  // Follow camera: scale world by `zoom`, translate so the tram sits at centre.
  // Inverse factor k keeps dot/label/tram sizes constant on screen at any zoom.
  const s = zoom;
  const k = 1 / s;
  const tx = VIEW_W / 2 - s * tram.x;
  const ty = VIEW_H / 2 - s * tram.y;

  const toPolyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg
      className={`route-canvas${reducedMotion && phase === 'moving' ? ' crossfading' : ''}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`Route ${route.route.shortName} map, tram heading to ${direction.headsign}`}
    >
      <g transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`}>
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

        {direction.stops.map((stopId, i) => {
          const p = stopPoints[i];
          const stop = route.stops[stopId];
          const status = i < stopIndex ? 'past' : i === stopIndex ? 'current' : 'future';
          const showLabel = Math.abs(i - stopIndex) <= LABEL_RADIUS;
          const labelLeft = i % 2 === 0;
          const offset = (status === 'current' ? 30 : 15) * k;
          const labelX = labelLeft ? p.x - offset : p.x + offset;
          const anchor = labelLeft ? 'end' : 'start';
          return (
            <g key={stopId} className={`stop stop-${status}`}>
              {status === 'current' && (
                <circle className="stop-pulse" cx={p.x} cy={p.y} r={16 * k} vectorEffect="non-scaling-stroke" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={(status === 'current' ? 8 : 5) * k}
                vectorEffect="non-scaling-stroke"
              />
              {showLabel && (
                <>
                  <text
                    x={labelX}
                    y={p.y + 2 * k}
                    textAnchor={anchor}
                    style={{ fontSize: `${16 * k}px` }}
                    vectorEffect="non-scaling-stroke"
                  >
                    {stop.landmark ?? stop.displayName.split('/')[0]}
                  </text>
                  {stop.stopNumber && (
                    <text
                      className="stop-num"
                      x={labelX}
                      y={p.y + 17 * k}
                      textAnchor={anchor}
                      style={{ fontSize: `${12 * k}px` }}
                    >
                      #{stop.stopNumber}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

        <g
          className="tram"
          transform={`translate(${tram.x} ${tram.y}) scale(${k.toFixed(4)}) rotate(${tram.angleDeg})`}
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
      </g>
    </svg>
  );
}
