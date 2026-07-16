import { useEffect, useState } from 'react';
import { DataErrorScreen } from '../components/DataErrorScreen';
import { TramLogo } from '../components/TramLogo';
import { AVAILABLE_ROUTES, DEFAULT_ROUTE, loadRoute } from '../data/routes';
import type { RouteData } from '../data/types';
import { loadLastRouteId } from '../storage/local';
import { Game } from './Game';

export default function App() {
  const [initialRoute, setInitialRoute] = useState<RouteData | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    const preferredId = loadLastRouteId();
    const preferred = AVAILABLE_ROUTES.find((route) => route.id === preferredId) ?? DEFAULT_ROUTE;
    if (!preferred) return;
    loadRoute(preferred.id).then(setInitialRoute).catch((error: unknown) => {
      setProblems([error instanceof Error ? error.message : String(error)]);
    });
  }, []);

  if (AVAILABLE_ROUTES.length === 0) {
    return <DataErrorScreen problems={['No route summaries were generated.']} />;
  }
  if (problems.length > 0) return <DataErrorScreen problems={problems} />;
  if (!initialRoute) {
    return (
      <main className="screen route-loading-screen" aria-live="polite">
        <TramLogo />
        <p className="brand">DING! MELBOURNE</p>
        <span>Preparing the tram network…</span>
      </main>
    );
  }
  return <Game routes={AVAILABLE_ROUTES} initialRoute={initialRoute} />;
}
