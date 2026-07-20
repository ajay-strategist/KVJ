/**
 * KVJ Analytics — Responsive infrastructure (Prompt 9 §15)
 * Layer: Shared. Breakpoint + media-query hooks used by shell, tables, forms.
 * Breakpoints mirror the design system (docs/17 §21).
 */

import { useCallback, useSyncExternalStore } from 'react';

export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Subscribe to an arbitrary media query.
 * Implemented with useSyncExternalStore so the value is read synchronously from
 * matchMedia on every render (never stale on first paint) and subscription
 * churn can't trigger remount/render feedback loops.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onStoreChange);
    return () => mq.removeEventListener('change', onStoreChange);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True when viewport is at least the given breakpoint. */
export function useBreakpoint(bp: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`);
}

/** Coarse device class for layout decisions. */
export function useDevice(): 'mobile' | 'tablet' | 'desktop' {
  const isTablet = useBreakpoint('md');
  const isDesktop = useBreakpoint('lg');
  return isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';
}
