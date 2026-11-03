/**
 * KVJ Analytics — Application bootstrap (Phase-1 finalization §1)
 * Replaces the legacy main.jsx entry. Boots theme before render (no flash),
 * mounts the composed providers + router. Legacy files remain untouched for
 * later module-by-module migration.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './app/AppProviders';
import { AppRouter } from './app/router';
import { initTheme } from './shared/theme/ThemeProvider';
import { bootstrap } from './app/bootstrap';
import './shared/design-system/tokens.css';
import './app/global.css';

bootstrap(); // initialize DI registry
initTheme(); // apply persisted/system theme before first paint

// Resilient handling for Vite chunk loading failures across deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Chunk preload failed. Refreshing for latest deployment assets...', event);
  const key = 'kvj_vite_preload_retry';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
});
try {
  sessionStorage.removeItem('kvj_vite_preload_retry');
} catch (_) {}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
