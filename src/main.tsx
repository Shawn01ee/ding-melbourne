import { createRoot } from 'react-dom/client';
import App from './app/App';
import { startServiceWorkerUpdates } from './app/swUpdate';
// Self-hosted Public Sans (variable, weights 100-900). Bundled + precached by
// the service worker, so typography is identical across OSes and works offline.
import '@fontsource-variable/public-sans/wght.css';
import './styles/global.css';
import './styles/theme.css';
import './styles/info.css';

startServiceWorkerUpdates();

createRoot(document.getElementById('root')!).render(<App />);
