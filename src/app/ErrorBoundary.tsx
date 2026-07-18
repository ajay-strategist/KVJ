/**
 * KVJ Analytics — Global Error Boundary (Phase-1 finalization §2,11)
 * Catches render errors anywhere in the tree and shows a branded 500 screen
 * instead of a blank page. Never exposes stack traces to end users.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ServerError } from './pages/errors/ErrorPages';

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for centralized logging (Prompt 11). Kept console-only in Phase 1.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return <ServerError onRetry={() => this.setState({ hasError: false })} />;
    return this.props.children;
  }
}
