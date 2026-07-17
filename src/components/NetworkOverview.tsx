import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { RouteSummary } from '../data/routes';
import type { RouteData } from '../data/types';
import { inkForBackground } from '../brand';
import { projectCoordinates, projectPathInFrame, smoothPathPose } from '../map/projection';

const VIEW_W = 1200;
const VIEW_H = 700;
const PADDING = 48;
const PREVIEW_DURATION_MS = 14_000;

type GeoPoint = [number, number];
type ViewMode = 'network' | 'route';

interface NetworkOverviewProps {
  routes: RouteSummary[];
  selectedRoute: RouteData;
  loadingRouteId: string | null;
  onSelect: (route: RouteSummary) => Promise<boolean>;
  onClose: () => void;
}

const WATER = [
  [144.79, -38.02], [145.29, -38.02], [145.29, -37.94], [145.08, -37.94],
  [145.035, -37.915], [145.005, -37.89], [144.982, -37.866], [144.955, -37.845],
  [144.925, -37.842], [144.895, -37.858], [144.84, -37.875], [144.79, -37.88],
] satisfies GeoPoint[];

const RIVERS = [
  [[144.84, -37.805], [144.89, -37.814], [144.925, -37.822], [144.95, -37.824], [144.975, -37.818], [145.005, -37.816], [145.04, -37.802], [145.08, -37.792], [145.12, -37.797], [145.17, -37.78], [145.24, -37.765]],
  [[144.875, -37.735], [144.884, -37.765], [144.892, -37.792], [144.91, -37.81], [144.925, -37.822]],
  [[145.03, -37.66], [145.018, -37.70], [145.021, -37.735], [145.01, -37.775], [145.005, -37.816]],
] satisfies GeoPoint[][];

const PARKS = [
  [[144.954, -37.778], [144.976, -37.778], [144.978, -37.79], [144.952, -37.791]],
  [[144.966, -37.842], [144.985, -37.842], [144.988, -37.858], [144.965, -37.858]],
  [[145.02, -37.825], [145.045, -37.824], [145.047, -37.842], [145.023, -37.845]],
  [[145.14, -37.805], [145.175, -37.801], [145.18, -37.827], [145.145, -37.83]],
] satisfies GeoPoint[][];

const CBD_BLOCKS = [
  [[144.95, -37.826], [144.982, -37.826]],
  [[144.95, -37.82], [144.982, -37.82]],
  [[144.95, -37.814], [144.982, -37.814]],
  [[144.95, -37.808], [144.982, -37.808]],
  [[144.954, -37.829], [144.954, -37.804]],
  [[144.962, -37.829], [144.962, -37.804]],
  [[144.97, -37.829], [144.97, -37.804]],
  [[144.978, -37.829], [144.978, -37.804]],
] satisfies GeoPoint[][];

const PLACE_LABELS = [
  ['AIRPORT WEST', 144.88, -37.72], ['COBURG', 144.965, -37.735],
  ['PRESTON', 145.025, -37.735], ['BUNDOORA', 145.085, -37.69],
  ['FOOTSCRAY', 144.895, -37.80], ['DOCKLANDS', 144.918, -37.824],
  ['MELBOURNE CBD', 144.968, -37.815], ['RICHMOND', 145.03, -37.825],
  ['KEW', 145.055, -37.795], ['BOX HILL', 145.12, -37.82],
  ['ST KILDA', 144.98, -37.87], ['MALVERN', 145.04, -37.86],
  ['GLEN IRIS', 145.075, -37.855], ['VERMONT SOUTH', 145.18, -37.855],
] satisfies [string, number, number][];

const points = (line: { x: number; y: number }[]) =>
  line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

const pathData = (line: { x: number; y: number }[], close = false) =>
  line.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ') + (close ? ' Z' : '');

const terminalName = (name: string) => name.split('/')[0].replace(/\s+#\d+$/, '').trim();

export function NetworkOverview({ routes, selectedRoute, loadingRouteId, onSelect, onClose }: NetworkOverviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('network');
  const movingTramRef = useRef<SVGGElement>(null);
  const previewFrameRef = useRef(0);
  const selectedRouteId = selectedRoute.route.id;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const geographicFrame = useMemo(() => routes.flatMap((route) => route.overviewShape), [routes]);

  const project = (shape: GeoPoint[]) => projectCoordinates(shape, geographicFrame, VIEW_W, VIEW_H, PADDING);

  const lines = useMemo(() => routes
    .map((summary) => ({
      summary,
      points: projectPathInFrame(
        summary.overviewShape,
        geographicFrame,
        VIEW_W,
        VIEW_H,
        PADDING,
      ).points,
    }))
    .sort((a, b) => Number(a.summary.id === selectedRouteId) - Number(b.summary.id === selectedRouteId)),
  // The shared frame is derived from routes and changes with the same dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [routes, selectedRouteId, geographicFrame]);

  const selectedLine = lines.find(({ summary }) => summary.id === selectedRouteId) ?? lines[0];
  const selectedDirection = selectedRoute.route.directions[0];
  const selectedFocusPath = useMemo(() => projectPathInFrame(
    selectedDirection.shape,
    geographicFrame,
    VIEW_W,
    VIEW_H,
    PADDING,
  ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [selectedDirection, geographicFrame]);
  const selectedFocusPoints = selectedFocusPath.points;
  const initialTramPose = smoothPathPose(selectedFocusPath, 0);

  // Drive the preview with one monotonic progress value. Native SVG
  // animateMotion can select the wrong tangent at a polyline corner and can
  // restart independently of React; controlling both position and heading
  // here prevents the visible forward-then-backward jump on complex routes.
  useEffect(() => {
    cancelAnimationFrame(previewFrameRef.current);
    if (viewMode !== 'route') return;

    const tram = movingTramRef.current;
    if (!tram) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startedAt = performance.now();

    const renderPose = (progress: number) => {
      const pose = smoothPathPose(selectedFocusPath, progress);
      tram.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.angleDeg})`);
      tram.dataset.previewProgress = progress.toFixed(6);
    };

    if (reducedMotion) {
      renderPose(1);
      return;
    }

    renderPose(0);
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / PREVIEW_DURATION_MS));
      renderPose(progress);
      if (progress < 1) previewFrameRef.current = requestAnimationFrame(step);
    };
    previewFrameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(previewFrameRef.current);
  }, [selectedFocusPath, selectedRouteId, viewMode]);
  const selectedStops = useMemo(() => {
    const coordinates = selectedDirection.stops.map((stopId) => {
      const stop = selectedRoute.stops[stopId];
      return [stop.position.lon, stop.position.lat] as GeoPoint;
    });
    const projected = project(coordinates);
    return selectedDirection.stops.map((stopId, index) => ({
      stop: selectedRoute.stops[stopId],
      point: projected[index],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDirection, selectedRoute, geographicFrame]);

  const mapContext = useMemo(() => ({
    water: project(WATER),
    rivers: RIVERS.map(project),
    parks: PARKS.map(project),
    cbd: CBD_BLOCKS.map(project),
    labels: PLACE_LABELS.map(([label, lon, lat]) => ({ label, point: project([[lon, lat]])[0] })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [geographicFrame]);

  const focusViewBox = useMemo(() => {
    if (viewMode === 'network') return `0 0 ${VIEW_W} ${VIEW_H}`;
    const xs = selectedFocusPoints.map((point) => point.x);
    const ys = selectedFocusPoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, 270);
    const height = Math.max(maxY - minY, 230);
    const padX = width * 0.16;
    const padY = height * 0.2;
    return `${(minX - padX).toFixed(1)} ${(minY - padY).toFixed(1)} ${(width + padX * 2).toFixed(1)} ${(height + padY * 2).toFixed(1)}`;
  }, [selectedFocusPoints, viewMode]);

  const firstStop = selectedStops[0];
  const lastStop = selectedStops[selectedStops.length - 1];
  const terminalLabel = (entry: typeof firstStop) => {
    const label = terminalName(entry.stop.displayName);
    const width = Math.min(Math.max(label.length * 7 + 24, 112), 238);
    const opensLeft = entry.point.x > VIEW_W / 2;
    return { label, width, x: opensLeft ? -width - 10 : 10, textX: opensLeft ? -width : 20 };
  };
  const firstLabel = terminalLabel(firstStop);
  const lastLabel = terminalLabel(lastStop);
  const selectForPreview = async (summary: RouteSummary) => {
    if (await onSelect(summary)) setViewMode('route');
  };

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
        data-view-mode={viewMode}
      >
        <header className="network-overview-header">
          <div>
            <p>TRANSPORT VICTORIA GTFS · 10 JUL 2026</p>
            <h2 id="network-overview-title">Melbourne tram network</h2>
            <span>Explore all {routes.length} current routes across the city</span>
          </div>
          <button type="button" className="network-close" onClick={onClose} autoFocus>
            <span aria-hidden="true">×</span>
            <small>Close</small>
          </button>
        </header>

        <div className={`network-overview-map ${viewMode === 'route' ? 'route-focus' : ''}`}>
          <svg
            viewBox={focusViewBox}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            style={{ '--network-color': selectedLine.summary.color } as CSSProperties}
            aria-label={`${viewMode === 'route' ? `Focused map of route ${selectedLine.summary.shortName}` : `Map showing all ${routes.length} Melbourne tram routes`}`}
          >
            <defs>
              <pattern id="network-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" className="network-dot" />
              </pattern>
              <filter id="network-tram-shadow" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.28" />
              </filter>
            </defs>
            <rect x="-300" y="-300" width="1800" height="1300" className="network-map-paper" />
            <rect x="-300" y="-300" width="1800" height="1300" fill="url(#network-dots)" />

            <g className="network-geography" aria-hidden="true">
              <path d={pathData(mapContext.water, true)} className="network-water" />
              {mapContext.parks.map((park, index) => <path key={`park-${index}`} d={pathData(park, true)} className="network-park" />)}
              {mapContext.cbd.map((street, index) => <path key={`street-${index}`} d={pathData(street)} className="network-cbd-street" />)}
              {mapContext.rivers.map((river, index) => <path key={`river-${index}`} d={pathData(river)} className="network-river" />)}
            </g>

            {lines.map(({ summary, points: line }) => {
              const selected = summary.id === selectedRouteId;
              const renderedLine = viewMode === 'route' && selected ? selectedFocusPoints : line;
              return (
                <g
                  key={summary.id}
                  className={selected ? 'network-line selected' : 'network-line'}
                  data-route-id={summary.id}
                >
                  {(viewMode === 'network' || selected) && (
                    <title>Route {summary.shortName} · {summary.longName}</title>
                  )}
                  <polyline className="network-line-hit" points={points(renderedLine)} onClick={() => void selectForPreview(summary)} />
                  <polyline className="network-line-casing" points={points(renderedLine)} />
                  <polyline
                    className="network-line-color"
                    points={points(renderedLine)}
                    stroke={summary.color}
                    style={{ '--network-color': summary.color } as CSSProperties}
                    onClick={() => void selectForPreview(summary)}
                  />
                </g>
              );
            })}

            {/* Place names sit ON TOP of the route tangle so the dense CBD stays
                readable; the city label gets a paper pill for extra contrast. */}
            <g className="network-labels" aria-hidden="true">
              {mapContext.labels.map(({ label, point }) => {
                if (label === 'MELBOURNE CBD') {
                  const w = 150;
                  return (
                    <g key={label}>
                      <rect
                        className="network-city-pill"
                        x={point.x - w / 2}
                        y={point.y - 15}
                        width={w}
                        height={23}
                        rx={8}
                      />
                      <text x={point.x} y={point.y} className="network-place-label city">{label}</text>
                    </g>
                  );
                }
                return (
                  <text key={label} x={point.x} y={point.y} className="network-place-label">{label}</text>
                );
              })}
              <text x="1040" y="636" className="network-map-compass">N ↑</text>
              <text x="935" y="675" className="network-water-label">PORT PHILLIP BAY</text>
              <text x="745" y="390" className="network-river-label">YARRA RIVER</text>
            </g>

            {viewMode === 'route' && (
              <g className="network-selected-stops" aria-hidden="true">
                {selectedStops.map(({ stop, point }, index) => (
                  <circle key={`${stop.stopNumber ?? index}-${index}`} cx={point.x} cy={point.y} r={index === 0 || index === selectedStops.length - 1 ? 6 : 2.8} />
                ))}
                <g
                  ref={movingTramRef}
                  className="network-moving-tram"
                  filter="url(#network-tram-shadow)"
                  transform={`translate(${initialTramPose.x} ${initialTramPose.y}) rotate(${initialTramPose.angleDeg})`}
                  data-preview-progress="0.000000"
                >
                  <rect x="-13" y="-7" width="26" height="14" rx="5" />
                  <rect x="-7" y="-4" width="5" height="5" rx="1" className="network-tram-window" />
                  <rect x="2" y="-4" width="5" height="5" rx="1" className="network-tram-window" />
                  <circle cx="-7" cy="7" r="2" /><circle cx="7" cy="7" r="2" />
                </g>
                <g className="network-terminal-label" transform={`translate(${firstStop.point.x} ${firstStop.point.y})`}>
                  <rect x={firstLabel.x} y="-40" width={firstLabel.width} height="27" rx="10" />
                  <text x={firstLabel.textX} y="-22">{firstLabel.label}</text>
                </g>
                <g className="network-terminal-label end" transform={`translate(${lastStop.point.x} ${lastStop.point.y})`}>
                  <rect x={lastLabel.x} y="-40" width={lastLabel.width} height="27" rx="10" />
                  <text x={lastLabel.textX} y="-22">{lastLabel.label}</text>
                </g>
              </g>
            )}
          </svg>

          <div className="network-map-switch" role="group" aria-label="Map view">
            <button type="button" className={viewMode === 'network' ? 'active' : ''} onClick={() => setViewMode('network')}>All lines</button>
            <button type="button" className={viewMode === 'route' ? 'active' : ''} onClick={() => setViewMode('route')}>Route focus</button>
          </div>

          <aside className="network-route-inspector" style={{ '--network-color': selectedLine.summary.color } as CSSProperties}>
            <span className="network-inspector-badge" style={{ background: selectedLine.summary.color, color: inkForBackground(selectedLine.summary.color) }}>
              {loadingRouteId ? '…' : selectedLine.summary.shortName}
            </span>
            <span className="network-inspector-copy">
              <small>{viewMode === 'network' ? 'SELECTED ROUTE' : `${selectedStops.length} STOPS · LIVE PREVIEW`}</small>
              <strong>{loadingRouteId ? 'Loading route data…' : selectedLine.summary.longName}</strong>
            </span>
            <button type="button" className="network-drive" onClick={onClose} disabled={loadingRouteId !== null}>Drive this line <span aria-hidden="true">→</span></button>
          </aside>
        </div>

        <div className="network-route-legend" aria-label="Select a route from the network map">
          {routes.map((summary) => {
            const selected = summary.id === selectedRouteId;
            const loading = loadingRouteId === summary.id;
            return (
              <button
                key={summary.id}
                type="button"
                className={selected ? 'network-route-key selected' : 'network-route-key'}
                aria-pressed={selected}
                aria-label={`Preview route ${summary.shortName}: ${summary.longName}`}
                aria-busy={loading}
                disabled={loadingRouteId !== null}
                onClick={() => void selectForPreview(summary)}
              >
                <span style={{ background: summary.color, color: inkForBackground(summary.color) }}>
                  {loading ? '…' : summary.shortName}
                </span>
                <small>{summary.longName}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
