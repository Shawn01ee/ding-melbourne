import { DataErrorScreen } from '../components/DataErrorScreen';
import routeJson from '../data/generated/route-96.json';
import { validateRouteData } from '../data/validate';
import { Game } from './Game';

// Validated once at module load; AC-09 demands a visible error, never a silent crash.
const validation = validateRouteData(routeJson);

export default function App() {
  if (!validation.ok) return <DataErrorScreen problems={validation.problems} />;
  return <Game route={validation.data} />;
}
