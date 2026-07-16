import { useEffect, useMemo, type CSSProperties, type MouseEvent } from 'react';
import type { AvailableRoute } from '../data/routes';
import type { RouteData } from '../data/types';
import { inkForBackground } from '../brand';
import { projectCoordinates } from '../map/projection';

const VIEW_W = 1200;
const VIEW_H = 700;
const PADDING = 54;

interface NetworkOverviewProps {
  routes: AvailableRoute[];
  selectedRouteId: string;
  onSelect: (route: RouteData) => void;
  onClose: () => void;
}

const points = (line: { x: number; y: number }[]) =>
  line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

export function NetworkOverview({ routes, selectedRouteId, onSelect, onClose }: NetworkOverviewProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const lines = useMemo(() => {
    const geographicFrame = routes.flatMap(({ data }) =>
      data.route.directions.flatMap((direction) => direction.shape),
    );
    return routes
      .map(({ data }) => ({
        data,
        points: projectCoordinates(
          data.route.directions[0].shape,
          geographicFrame,
          VIEW_W,
          VIEW_H,
          PADDING,
        ),
      }))
      .sort((a, b) => Number(a.data.route.id === selectedRouteId) - Number(b.data.route.id === selectedRouteId));
  }, [routes, selectedRouteId]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="network-overview-backdrop" onMouseDown={closeFromBackdrop}>
      <section
        className="network-overview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-overview-title"
      >
        <header className="network-overview-header">
          <div>
            <p>TRANSPORT VICTORIA GTFS · 10 JUL 2026</p>
            <h2 id="network-overview-title">Melbourne tram network</h2>
            <span>All {routes.length} current routes in one geographic view</span>
          </div>
          <button type="button" className="network-close" onClick={onClose} autoFocus>
            <span aria-hidden="true">×</span>
            <small>Close</small>
          </button>
        </header>

        <div className="network-overview-map">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Map showing all ${routes.length} Melbourne tram routes`}
          >
            <defs>
              <pattern id="network-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" className="network-dot" />
              </pattern>
            </defs>
            <rect width={VIEW_W} height={VIEW_H} className="network-map-paper" />
            <rect width={VIEW_W} height={VIEW_H} fill="url(#network-dots)" />
            <text x="70" y="92" className="network-map-label">MELBOURNE</text>
            <text x="1020" y="630" className="network-map-compass">N ↑</text>
            {lines.map(({ data, points: line }) => {
              const selected = data.route.id === selectedRouteId;
              return (
                <g key={data.route.id} className={selected ? 'network-line selected' : 'network-line'}>
                  <polyline className="network-line-casing" points={points(line)} />
                  <polyline
                    points={points(line)}
                    stroke={data.route.color}
                    style={{ '--network-color': data.route.color } as CSSProperties}
                  />
                  {selected && line.length > 1 && (
                    <>
                      <circle cx={line[0].x} cy={line[0].y} r="7" fill={data.route.color} />
                      <circle
                        cx={line[line.length - 1].x}
                        cy={line[line.length - 1].y}
                        r="7"
                        fill={data.route.color}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="network-map-caption">
            <strong>24 routes · one city</strong>
            <span>Schematic geographic overview — select a route below to drive it.</span>
          </div>
        </div>

        <div className="network-route-legend" aria-label="Select a route from the network map">
          {routes.map(({ data }) => {
            const selected = data.route.id === selectedRouteId;
            return (
              <button
                key={data.route.id}
                type="button"
                className={selected ? 'network-route-key selected' : 'network-route-key'}
                aria-pressed={selected}
                aria-label={`Select route ${data.route.shortName}: ${data.route.longName}`}
                onClick={() => onSelect(data)}
              >
                <span
                  style={{ background: data.route.color, color: inkForBackground(data.route.color) }}
                >
                  {data.route.shortName}
                </span>
                <small>{data.route.longName}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
