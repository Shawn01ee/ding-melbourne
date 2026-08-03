import { registerSW } from 'virtual:pwa-register';

/**
 * Keep installed players on the current build.
 *
 * The service worker precaches index.html, so a normal reload can keep serving
 * the previous bundle until the worker itself updates. Without this, a shipped
 * fix can stay invisible to anyone who has already opened the game. We check
 * for a new worker on load, on a timer, and whenever the tab regains focus,
 * then reload once the new worker takes control.
 */
export function startServiceWorkerUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      // Hourly is plenty for a game session; focus covers the common case of
      // returning to an installed app that has been open for days.
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });
}
