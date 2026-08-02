import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inkForBackground } from '../brand';
import type { RouteSummary } from '../data/routes';
import {
  directionsCompleted,
  emptyStats,
  formatDrivingTime,
  linesCompleted,
  routeBestTime,
  routeBestWpm,
  type LifetimeStats,
  type RouteLog,
} from '../game/driverLog';
import { formatClock } from '../game/selectors';
import { loadRouteLogRaw, loadStatsRaw } from '../storage/local';
import { useModalLifecycle } from './useModalLifecycle';

interface DriverLogProps {
  routes: RouteSummary[];
  onClose: () => void;
}

/** Solo progression: lifetime driving totals and the 24-line collection. */
export function DriverLog({ routes, onClose }: DriverLogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalLifecycle(dialogRef, closeRef, onClose);

  // Read once on open: the log only changes when a run finishes.
  const [{ stats, log }] = useState(() => ({
    stats: loadStatsRaw<LifetimeStats>() ?? emptyStats(),
    log: loadRouteLogRaw<RouteLog>() ?? {},
  }));

  const done = linesCompleted(log);
  const pct = routes.length > 0 ? Math.round((done / routes.length) * 100) : 0;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal-card driver-log"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-log-title"
      >
        <button ref={closeRef} type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="modal-eyebrow">Driver’s log</p>
        <h2 id="driver-log-title">Your service record</h2>

        <div className="log-progress">
          <div className="log-progress-head">
            <strong>{done}/{routes.length}</strong>
            <span>lines driven end to end</span>
          </div>
          <div className="log-progress-track" role="img" aria-label={`${pct}% of lines completed`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>

        <dl className="log-stats">
          <div><dt>Runs</dt><dd>{stats.runs}</dd></div>
          <div><dt>Stops cleared</dt><dd>{stats.stopsCleared.toLocaleString()}</dd></div>
          <div><dt>Time driving</dt><dd>{formatDrivingTime(stats.timeMs)}</dd></div>
          <div><dt>Best WPM</dt><dd>{stats.bestWpm.toFixed(0)}</dd></div>
          <div><dt>Best combo</dt><dd>{stats.bestCombo}</dd></div>
          <div><dt>Total misses</dt><dd>{stats.errors.toLocaleString()}</dd></div>
        </dl>

        {stats.runs === 0 ? (
          <p className="log-empty">No runs recorded yet — finish a line and it appears here.</p>
        ) : (
          <ul className="log-lines">
            {routes.map((summary) => {
              const entry = log[summary.shortName];
              const dirs = directionsCompleted(entry);
              const best = routeBestTime(entry);
              const wpm = routeBestWpm(entry);
              const complete = dirs > 0;
              return (
                <li key={summary.id} className={complete ? 'log-line done' : 'log-line'}>
                  <span
                    className="route-badge"
                    style={{ background: summary.color, color: inkForBackground(summary.color) }}
                  >
                    {summary.shortName}
                  </span>
                  <span className="log-line-text">
                    <span className="log-line-name">{summary.longName}</span>
                    <span className="log-line-meta">
                      {entry ? `${entry.runs} run${entry.runs > 1 ? 's' : ''}` : 'Not driven yet'}
                      {best !== null && ` · best ${formatClock(best)}`}
                      {!best && wpm > 0 && ` · ${wpm.toFixed(0)} wpm`}
                    </span>
                  </span>
                  <span className="log-line-pips" aria-label={`${dirs} of ${summary.directionCount} directions completed`}>
                    {Array.from({ length: summary.directionCount }, (_, i) => (
                      <i key={i} className={i < dirs ? 'pip on' : 'pip'} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
