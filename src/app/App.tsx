import { DataErrorScreen } from '../components/DataErrorScreen';
import { AVAILABLE_ROUTES } from '../data/routes';
import { Game } from './Game';

export default function App() {
  // No route survived validation — surface it, never fail silently (AC-09).
  if (AVAILABLE_ROUTES.length === 0) {
    return <DataErrorScreen problems={['No playable routes: every generated route JSON failed validation.']} />;
  }
  return <Game routes={AVAILABLE_ROUTES} />;
}
