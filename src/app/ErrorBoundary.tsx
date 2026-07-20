/**
 * KVJ Analytics — Global Error Boundary (Phase-1 finalization §2,11)
 * Catches render errors anywhere in the tree and shows a branded 500 screen
 * instead of a blank page. Never exposes stack traces to end users.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ServerError } from './pages/errors/ErrorPages';
import { logger } from '../shared/logging/logger';

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Centralized logging (Prompt 11). Phase 2: forwards to an external provider.
    logger.error(error.message, 'ErrorBoundary', info.componentStack);
  }

  render() {
    if (this.state.hasError) return <ServerError onRetry={() => this.setState({ hasError: false })} />;
    return this.props.children;
  }
}
