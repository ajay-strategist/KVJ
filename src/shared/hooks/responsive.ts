/**
 * KVJ Analytics — Responsive infrastructure (Prompt 9 §15)
 * Layer: Shared. Breakpoint + media-query hooks used by shell, tables, forms.
 * Breakpoints mirror the design system (docs/17 §21).
 */

import { useEffect, useState } from 'react';

export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/** Subscribe to an arbitrary media query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
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
