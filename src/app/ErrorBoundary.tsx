/**
 * KVJ Analytics — Global Error Boundary (Phase-1 finalization §2,11)
 * Catches render errors anywhere in the tree and shows a branded 500 screen
 * instead of a blank page. Never exposes stack traces to end users.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ServerError } from './pages/errors/ErrorPages';
import { logger } from '../shared/logging/logger';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught exception:', error, info);
    logger.error(error?.message || 'ErrorBoundary Exception', 'ErrorBoundary', info.componentStack);

    // If a deployment hash mismatch or module fetch failure occurred, automatically reload
    const msg = String(error?.message || '').toLowerCase();
    const isChunkFailure =
      error?.name === 'ChunkLoadError' ||
      msg.includes('dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('unexpected token') ||
      msg.includes('is not valid javascript') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('failed to load module script') ||
      msg.includes('load failed') ||
      msg.includes('unable to preload css') ||
      msg.includes('failed to fetch');

    if (isChunkFailure && typeof window !== 'undefined') {
      const storageKey = 'kvj_last_chunk_reload';
      const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
      const now = Date.now();
      if (now - lastReload > 4000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ServerError
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        />
      );
    }
    return this.props.children;
  }
}
