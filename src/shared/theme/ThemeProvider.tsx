/**
 * KVJ Analytics — Theme system (Prompt 5/Prompt 3 §3)
 * Layer: Shared. Light / Dark / System with persistence + runtime switching.
 * No page manages theme directly — everything goes through useTheme().
 * Applies data-theme on <html>; design tokens (tokens.css) react to it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eventBus } from '../../core/event-bus';

export type ThemeMode = 'light' | 'dark' | 'hud' | 'hud-light' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'hud' | 'hud-light';

/** Cycle order used by the top-bar quick toggle. */
export const THEME_CYCLE: ResolvedTheme[] = ['light', 'dark', 'hud', 'hud-light'];

/** Human labels for the theme picker. */
export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  hud: 'Cockpit Dark',
  'hud-light': 'Cockpit Light',
  system: 'System',
};

interface ThemeContextValue {
  mode: ThemeMode;          // user preference
  theme: ResolvedTheme;     // effective theme after resolving 'system'
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;       // cycles Light → Dark → Cockpit
}

const STORAGE_KEY = 'kvj.theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}
function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode; // 'light' | 'dark' | 'hud' apply directly
}

/** Boot-time application of the stored theme (call before React renders to avoid flash). */
export function initTheme(): void {
  const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system';
  document.documentElement.setAttribute('data-theme', resolve(stored));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system');
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(mode));

  const apply = useCallback((next: ThemeMode) => {
    const resolved = resolve(next);
    document.documentElement.setAttribute('data-theme', resolved);
    setTheme(resolved);
    eventBus.emit('theme.changed', { theme: resolved as any });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    apply(next);
  }, [apply]);

  // Quick toggle cycles through the three concrete themes (System stays a
  // deliberate choice made in Settings).
  const toggle = useCallback(() => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setMode(next);
  }, [theme, setMode]);

  // React to OS theme changes while in 'system' mode.
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode, apply]);

  const value = useMemo(() => ({ mode, theme, setMode, toggle }), [mode, theme, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
