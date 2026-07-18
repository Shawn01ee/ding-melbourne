import { useState, type CSSProperties } from 'react';
import { inkForBackground } from '../brand';
import type { RouteSummary } from '../data/routes';
import { directionIndexOf, targetText, type GameAction, type GameState } from '../game/reducer';
import { accuracyOf, elapsedMs, formatClock, scoreOf, totalRunStops, wpmOf } from '../game/selectors';
import { RouteCanvas } from '../map/RouteCanvas';
import { isBetter, loadBest, pbKey, saveBest, type PersonalBest } from '../storage/local';
import type { ColorTheme } from '../storage/local';
import type { AuthState } from '../backend/useAuth';
import { drawResultCard } from '../share/resultCard';
import { Leaderboard } from './Leaderboard';
import { ThemeToggle } from './ThemeToggle';

interface ResultScreenProps {
  state: GameState;
  routes: RouteSummary[];
  dispatch: (action: GameAction) => void;
  theme: ColorTheme;
  onToggleTheme: () => void;
  auth: AuthState;
}

function driverRank(accuracy: number, wpm: number, completed: boolean): string {
  if (!completed) return 'LAST TRAM';
  if (accuracy >= 98 && wpm >= 70) return 'CITY FLYER';
  if (accuracy >= 95 && wpm >= 50) return 'TRAM ACE';
  if (accuracy >= 90) return 'BELL RINGER';
  return 'ROUTE LEARNER';
}

export function ResultScreen({ state, routes, dispatch, theme, onToggleTheme, auth }: ResultScreenProps) {
  // Compare-and-save synchronously once on mount so the pre-run PB is shown.
  const [{ previous, isNew, result }] = useState(() => {
    const key = pbKey(state.route.route.id, state.config);
    const run: PersonalBest = {
      timeMs: elapsedMs(state),
      stops: state.stopsCompleted,
      accuracy: accuracyOf(state),
      wpm: wpmOf(state),
      score: scoreOf(state),
      at: new Date().toISOString(),
    };
    const prev = loadBest(key);
    const better = isBetter(state.config.mode, run, prev);
    if (better) saveBest(key, run);
    return { previous: prev, isNew: better, result: run };
  });

  const sprint = state.config.mode === 'sprint';
  const completed = state.finishReason === 'completed';
  const direction = state.route.route.directions[directionIndexOf(state)];
  const target = targetText(state);
  const typedProgress = target.length > 0 ? [...state.input].length / [...target].length : 0;
  const rank = driverRank(result.accuracy, result.wpm, completed);
  const [shareLabel, setShareLabel] = useState('SHARE RESULT');

  const modeLabel =
    state.config.mode === 'sprint'
      ? '60s Sprint'
      : state.config.mode === 'section'
        ? '10-Stop Section'
        : 'Full Route';

  const shareResult = async () => {
    const text = `DING! MELBOURNE · Route ${state.route.route.shortName} · ${rank} · ${result.score} points · ${result.wpm.toFixed(1)} WPM · ${result.accuracy.toFixed(1)}% accuracy`;
    const shareUrl = location.origin + location.pathname;

    let file: File | null = null;
    try {
      const blob = await drawResultCard({
        routeShort: state.route.route.shortName,
        routeLong: state.route.route.longName,
        routeColor: state.route.route.color,
        headsign: direction.headsign,
        modeLabel,
        rank,
        outcome: completed ? 'Service complete' : "Time's up",
        isNew,
        metrics: [
          { label: sprint ? 'Stops' : 'Clear time', value: sprint ? String(result.stops) : formatClock(result.timeMs) },
          { label: 'WPM', value: result.wpm.toFixed(0) },
          { label: 'Accuracy', value: `${result.accuracy.toFixed(0)}%` },
          { label: 'Score', value: String(result.score) },
        ],
      });
      file = new File([blob], 'ding-melbourne-result.png', { type: 'image/png' });
    } catch {
      /* image generation failed — fall back to a text/link share */
    }

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'DING! MELBOURNE', text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'DING! MELBOURNE', text, url: shareUrl });
        return;
      }
      // Desktop without Web Share: download the image and copy the link.
      if (file) {
        const href = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = href;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(href);
      }
      await navigator.clipboard?.writeText(`${text} · ${shareUrl}`);
      setShareLabel(file ? 'IMAGE SAVED · LINK COPIED' : 'RESULT COPIED');
    } catch {
      // Cancelling the native share sheet should leave the result screen alone.
    }
  };

  return (
    <main
      className="screen result-screen"
      style={{ '--result-route': state.route.route.color } as CSSProperties}
    >
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="screen-theme-toggle" />
      <div className="result-map" aria-hidden="true">
        <RouteCanvas
          route={state.route}
          networkRoutes={routes}
          directionIndex={directionIndexOf(state)}
          stopIndex={state.stopIndex}
          startStopIndex={state.config.startStopIndex}
          typedProgress={completed ? 1 : typedProgress}
        />
      </div>

      <div className="tram-result-shell">
        <header className="tram-destination-deck" aria-label={`Route ${state.route.route.shortName} to ${direction.headsign}`}>
          <span className="tram-fleet-mark" aria-hidden="true">DM</span>
          <div className="tram-destination-blind">
            <small>ROUTE {state.route.route.shortName}</small>
            <strong>{direction.headsign}</strong>
            <span>{completed ? 'SERVICE COMPLETE' : 'SERVICE ENDED'}</span>
          </div>
          <span className="tram-car-number" aria-hidden="true">
            <small>CAR</small>
            {String(state.route.route.shortName).padStart(3, '0')}
          </span>
        </header>

        <div className="tram-gold-rule" aria-hidden="true" />

        <div className="tram-result-body">
          <div className="tram-cab-side tram-cab-left" aria-hidden="true">
            <div className="tram-cab-window">
              <span className="tram-window-reflection" />
              <small>DRIVER CAB</small>
            </div>
            <div className="tram-lamp-row">
              <i />
              <span>BELL</span>
              <i />
            </div>
          </div>

          <section className="result-panel" aria-labelledby="result-title">
        <p className="result-route">
          <span
            className="route-badge"
            style={{
              background: state.route.route.color,
              color: inkForBackground(state.route.route.color),
            }}
          >
            {state.route.route.shortName}
          </span>
          Journey report
        </p>

        <div className="result-rank">
          <span>Driver rank</span>
          <h1 className="result-title" id="result-title">{rank}</h1>
          {isNew && <span className="pb-badge">NEW PERSONAL BEST</span>}
        </div>

        <dl className="result-grid">
          <div>
            <dt>Score</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>WPM</dt>
            <dd>{result.wpm.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{result.accuracy.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Misses</dt>
            <dd>{state.errors}</dd>
          </div>
          <div>
            <dt>{sprint ? 'Stops' : 'Elapsed time'}</dt>
            <dd>{sprint ? `${result.stops}/${totalRunStops(state)}` : formatClock(result.timeMs)}</dd>
          </div>
          <div>
            <dt>Max combo</dt>
            <dd>{state.bestStreak}</dd>
          </div>
        </dl>

        <p className="pb-compare">
          {previous
            ? sprint
              ? `Personal best: ${previous.stops} stops (${previous.wpm.toFixed(1)} WPM)`
              : `Personal best: ${formatClock(previous.timeMs)}`
            : 'First run on this setup — benchmark set.'}
        </p>

        <div className="result-actions">
          <button
            type="button"
            className="start-button"
            autoFocus
            onClick={() => dispatch({ type: 'EXIT' })}
          >
            CHOOSE NEXT LINE
          </button>
          <button type="button" className="result-share" onClick={() => void shareResult()}>
            {shareLabel}
          </button>
          <button
            type="button"
            className="option"
            onClick={() => dispatch({ type: 'RESTART', at: Date.now() })}
          >
            RUN AGAIN
          </button>
        </div>

        <Leaderboard
          auth={auth}
          routeShort={state.route.route.shortName}
          config={state.config}
          result={{
            stops: result.stops,
            timeMs: result.timeMs,
            wpm: result.wpm,
            accuracy: result.accuracy,
            bestStreak: state.bestStreak,
            errors: state.errors,
          }}
        />
          </section>

          <div className="tram-cab-side tram-cab-right" aria-hidden="true">
            <div className="tram-cab-window tram-cab-window-route">
              <span className="tram-window-reflection" />
              <strong>{state.route.route.shortName}</strong>
              <small>DING! MELBOURNE</small>
            </div>
            <div className="tram-lamp-row">
              <i />
              <span>THANKS</span>
              <i />
            </div>
          </div>
        </div>

        <footer className="tram-apron" aria-hidden="true">
          <span className="tram-buffer" />
          <strong>DING! MELBOURNE · METROPOLITAN TRAM SERVICE</strong>
          <span className="tram-buffer" />
        </footer>
      </div>
    </main>
  );
}
