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
  }

  render() {
    if (this.state.hasError) {
      return (
        <ServerError
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
