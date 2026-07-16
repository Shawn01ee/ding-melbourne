import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { approachCue, errorTick, keyTick, stopArrivalCue } from '../audio/bell';
import { ConfigScreen } from '../components/ConfigScreen';
import { CountdownScreen } from '../components/CountdownScreen';
import { Hud } from '../components/Hud';
import { ResultScreen } from '../components/ResultScreen';
import { infoPageFromHash, ServiceInfo, type InfoPageId } from '../components/ServiceInfo';
import { StopConsole } from '../components/StopConsole';
import { loadRoute, type RouteSummary } from '../data/routes';
import type { RouteData } from '../data/types';
import { directionIndexOf, initialState, reducer, targetText } from '../game/reducer';
import { RouteCanvas } from '../map/RouteCanvas';
import { loadLastConfig, loadSettings, loadTheme, saveTheme } from '../storage/local';
import { appViewport, stableKeyboardHeight, type AppViewport } from './visualViewport';

export function Game({ routes, initialRoute }: { routes: RouteSummary[]; initialRoute: RouteData }) {
  const [theme, setTheme] = useState(loadTheme);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPageId | null>(() => infoPageFromHash(window.location.hash));
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null);
  const [routeLoadError, setRouteLoadError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(
    reducer,
    initialRoute,
    (route) => {
      const saved = { ...loadSettings(), ...loadLastConfig() };
      const validDirection = route.route.directions.some((d) => d.id === saved.directionId);
      if (!validDirection) delete saved.directionId;
      return initialState(route, saved);
    },
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const baselineViewportHeightRef = useRef(
    window.visualViewport?.height ?? window.innerHeight,
  );
  const keyboardSessionHeightRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<AppViewport>(() => {
    const visual = window.visualViewport;
    return appViewport(
      baselineViewportHeightRef.current,
      visual?.height ?? window.innerHeight,
      visual?.width ?? window.innerWidth,
      visual?.offsetTop ?? 0,
      false,
    );
  });
  const route = state.route;
  const networkRoutes = useMemo(() => routes, [routes]);

  const inGame = state.phase === 'typing' || state.phase === 'paused';
  const target = targetText(state);
  const typedProgress = target.length > 0 ? [...state.input].length / [...target].length : 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  // The on-screen keyboard usually shrinks only the visual viewport, leaving
  // 100dvh/layout viewport content hidden behind it. Keep the live game sized
  // to what is actually visible and expose a keyboard-open layout hook.
  useEffect(() => {
    const root = document.documentElement;
    const visual = window.visualViewport;
    let frame = 0;
    let orientationTimer = 0;

    const typingInputFocused = () =>
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.classList.contains('ghost-input');

    const sync = () => {
      frame = 0;
      const height = visual?.height ?? window.innerHeight;
      const width = visual?.width ?? window.innerWidth;
      const offsetTop = visual?.offsetTop ?? 0;
      const focused = typingInputFocused();
      if (!focused) {
        baselineViewportHeightRef.current = Math.max(
          baselineViewportHeightRef.current,
          height + offsetTop,
        );
      }
      const measured = appViewport(
        baselineViewportHeightRef.current,
        height,
        width,
        offsetTop,
        focused,
      );
      keyboardSessionHeightRef.current = stableKeyboardHeight(
        keyboardSessionHeightRef.current,
        measured,
      );
      const next = keyboardSessionHeightRef.current === null
        ? measured
        : { ...measured, height: keyboardSessionHeightRef.current };
      root.style.setProperty('--visual-viewport-height', `${next.height}px`);
      root.style.setProperty('--visual-viewport-width', `${next.width}px`);
      root.style.setProperty('--visual-viewport-offset-top', `${next.offsetTop}px`);
      root.style.setProperty('--keyboard-inset', `${next.keyboardInset}px`);
      root.classList.toggle('keyboard-open', next.keyboardOpen);
      // Safari can pan the document late in its keyboard animation, even when
      // focus({ preventScroll }) was used. The compact mobile cockpit already
      // keeps the field visible, so any residual page scroll is unwanted.
      if (focused && window.innerWidth <= 700 && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      setViewport((current) =>
        current.height === next.height &&
        current.width === next.width &&
        current.offsetTop === next.offsetTop &&
        current.keyboardInset === next.keyboardInset &&
        current.keyboardOpen === next.keyboardOpen
          ? current
          : next,
      );
    };

    const scheduleSync = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    const resetAfterOrientation = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        // Do not learn the keyboard-reduced viewport as the new baseline.
        // Once the typing field loses focus, sync() safely refreshes it.
        if (!typingInputFocused()) {
          baselineViewportHeightRef.current = visual?.height ?? window.innerHeight;
        }
        scheduleSync();
      }, 250);
    };

    sync();
    visual?.addEventListener('resize', scheduleSync);
    visual?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('orientationchange', resetAfterOrientation);
    document.addEventListener('focusin', scheduleSync);
    document.addEventListener('focusout', scheduleSync);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(orientationTimer);
      visual?.removeEventListener('resize', scheduleSync);
      visual?.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', resetAfterOrientation);
      document.removeEventListener('focusin', scheduleSync);
      document.removeEventListener('focusout', scheduleSync);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-width');
      root.style.removeProperty('--visual-viewport-offset-top');
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);

  useEffect(() => {
    const syncInfoPage = () => setInfoPage(infoPageFromHash(window.location.hash));
    window.addEventListener('hashchange', syncInfoPage);
    window.addEventListener('popstate', syncInfoPage);
    return () => {
      window.removeEventListener('hashchange', syncInfoPage);
      window.removeEventListener('popstate', syncInfoPage);
    };
  }, []);

  const toggleTheme = () => setTheme((current) => current === 'day' ? 'night' : 'day');

  const openInfo = (page: InfoPageId) => {
    window.history.pushState(null, '', `#/${page}`);
    setInfoPage(page);
    window.scrollTo(0, 0);
  };

  const closeInfo = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setInfoPage(null);
    window.scrollTo(0, 0);
  };

  const selectRoute = async (summary: RouteSummary) => {
    if (summary.id === route.route.id) return true;
    setLoadingRouteId(summary.id);
    setRouteLoadError(null);
    try {
      const selected = await loadRoute(summary.id);
      dispatch({ type: 'SELECT_ROUTE', route: selected });
      return true;
    } catch (error) {
      setRouteLoadError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setLoadingRouteId(null);
    }
  };

  // Concise, browser-readable state for visual regression and accessibility
  // tooling. The SVG uses a follow camera, so route order is more useful than
  // raw screen coordinates here.
  useEffect(() => {
    const testWindow = window as Window & { render_game_to_text?: () => string };
    testWindow.render_game_to_text = () => {
      const direction = route.route.directions[directionIndexOf(state)];
      const stopId = direction.stops[state.stopIndex];
      const stop = route.stops[stopId];
      return JSON.stringify({
        phase: state.phase,
        route: route.route.shortName,
        headsign: direction.headsign,
        mode: state.config.mode,
        difficulty: state.config.difficulty,
        theme,
        networkOverviewOpen: state.phase === 'config' && networkOpen,
        informationPage: state.phase === 'config' ? infoPage : null,
        networkRouteCount: networkRoutes.length,
        loadingRoute: loadingRouteId,
        stopIndex: state.stopIndex,
        stopCount: direction.stops.length,
        currentStop: stop?.displayName ?? null,
        target,
        input: state.input,
        typedProgress: Number(typedProgress.toFixed(3)),
        stopsCompleted: state.stopsCompleted,
        combo: state.streak,
        bestCombo: state.bestStreak,
        errors: state.errors,
        keyboardOpen: viewport.keyboardOpen,
        visualViewportHeight: viewport.height,
        keyboardInset: viewport.keyboardInset,
        note: 'Each correct character raises combo and moves the tram. A miss resets combo but does not stick; a completed stop opens the next target immediately.',
      });
    };
    return () => {
      delete testWindow.render_game_to_text;
    };
  }, [infoPage, loadingRouteId, networkOpen, networkRoutes.length, route, state, theme, viewport]);

  // Clock tick while a run is live.
  useEffect(() => {
    if (!inGame || state.phase === 'paused') return;
    const timer = setInterval(() => dispatch({ type: 'TICK', at: Date.now() }), 200);
    return () => clearInterval(timer);
  }, [inGame, state.phase]);

  // Auto-pause when the tab hides (PRD §6).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: 'PAUSE', at: Date.now() });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A completed stop gets its own arrival response. Progression is never
  // delayed by audio or map animation, so fast typists can keep typing.
  const prevStopsRef = useRef(state.stopsCompleted);
  useEffect(() => {
    const added = state.stopsCompleted - prevStopsRef.current;
    prevStopsRef.current = state.stopsCompleted;
    if (added > 0) {
      stopArrivalCue(state.config.soundOn, state.phase === 'finished', state.stopsCompleted);
    }
  }, [state.stopsCompleted, state.config.soundOn, state.phase]);

  // Per-keystroke ticks: light click for a correct key, low thud for an error.
  const prevKeysRef = useRef(state.totalKeystrokes);
  const prevErrorsRef = useRef(state.errors);
  const prevKeyAtRef = useRef(state.now);
  const prevProgressRef = useRef(typedProgress);
  const prevStopIndexRef = useRef(state.stopIndex);
  useEffect(() => {
    const addedKeys = state.totalKeystrokes - prevKeysRef.current;
    const addedErrors = state.errors - prevErrorsRef.current;
    prevKeysRef.current = state.totalKeystrokes;
    prevErrorsRef.current = state.errors;
    if (addedKeys <= 0) {
      if (addedKeys < 0) {
        prevKeyAtRef.current = state.now;
        prevProgressRef.current = typedProgress;
        prevStopIndexRef.current = state.stopIndex;
      }
      return;
    }

    const cadenceMs = Math.max(24, state.now - prevKeyAtRef.current);
    const sameStop = prevStopIndexRef.current === state.stopIndex;
    const crossedApproach = sameStop && prevProgressRef.current < 0.7 && typedProgress >= 0.7;

    if (addedErrors > 0) errorTick(state.config.soundOn);
    else {
      keyTick(state.config.soundOn, state.streak, typedProgress, cadenceMs);
      if (crossedApproach) approachCue(state.config.soundOn, state.stopIndex);
    }

    prevKeyAtRef.current = state.now;
    prevProgressRef.current = typedProgress;
    prevStopIndexRef.current = state.stopIndex;
  }, [
    state.totalKeystrokes,
    state.errors,
    state.config.soundOn,
    state.streak,
    state.now,
    state.stopIndex,
    typedProgress,
  ]);

  // Clicking empty space restores input focus; control buttons are exempt (PRD §6).
  const restoreFocus = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('button, select, a, input, option')) return;
    containerRef.current
      ?.querySelector<HTMLInputElement>('.ghost-input')
      ?.focus({ preventScroll: true });
  };

  if (state.phase === 'config' && infoPage)
    return (
      <ServiceInfo
        page={infoPage}
        theme={theme}
        onNavigate={openInfo}
        onClose={closeInfo}
        onToggleTheme={toggleTheme}
      />
    );
  if (state.phase === 'config')
    return (
      <ConfigScreen
        routes={routes}
        route={route}
        state={state}
        dispatch={dispatch}
        theme={theme}
        networkOpen={networkOpen}
        loadingRouteId={loadingRouteId}
        routeLoadError={routeLoadError}
        onSelectRoute={selectRoute}
        onToggleTheme={toggleTheme}
        onOpenNetwork={() => setNetworkOpen(true)}
        onCloseNetwork={() => setNetworkOpen(false)}
        onOpenInfo={openInfo}
      />
    );
  if (state.phase === 'countdown')
    return <CountdownScreen state={state} dispatch={dispatch} theme={theme} onToggleTheme={toggleTheme} />;
  if (state.phase === 'finished')
    return (
      <ResultScreen
        key={state.finishedAt ?? 0}
        state={state}
        routes={networkRoutes}
        dispatch={dispatch}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );

  return (
    <div className="screen game-screen" ref={containerRef} onMouseDown={restoreFocus}>
      <Hud state={state} dispatch={dispatch} theme={theme} onToggleTheme={toggleTheme} />
      <div className="map-area">
        <RouteCanvas
          route={route}
          networkRoutes={networkRoutes}
          directionIndex={directionIndexOf(state)}
          stopIndex={state.stopIndex}
          startStopIndex={state.config.startStopIndex}
          typedProgress={typedProgress}
        />
      </div>
      <StopConsole state={state} dispatch={dispatch} />

      {state.phase === 'paused' && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="pause-card">
            <h2>Paused</h2>
            <button
              type="button"
              className="start-button"
              autoFocus
              onClick={() => dispatch({ type: 'RESUME', at: Date.now() })}
            >
              RESUME
            </button>
            <button
              type="button"
              className="option"
              onClick={() => dispatch({ type: 'RESTART', at: Date.now() })}
            >
              Restart run
            </button>
            <button type="button" className="option" onClick={() => dispatch({ type: 'EXIT' })}>
              Exit to setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
