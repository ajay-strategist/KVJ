/**
 * KVJ Analytics — Theme system
 * Layer: Shared. Light / Dark / System + Scheduled Festive Themes (Christmas, New Year, Easter, Onam).
 * Applies data-theme on <html>; design tokens (tokens.css) react to it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { eventBus } from '../../core/event-bus';
import {
  type SeasonalThemeId,
  type SeasonalThemeConfig,
  DEFAULT_SEASONAL_THEMES,
  loadSeasonalSettings,
  saveSeasonalSettings,
  evaluateAutoSeasonalTheme,
  isSeasonalThemeActive,
  isSeasonalThemeAvailable,
} from './seasonal-themes';

export type ThemeMode = 'light' | 'dark' | 'system' | SeasonalThemeId;
export type ResolvedTheme = 'light' | 'dark' | SeasonalThemeId;

/** Base cycle order used by the sidebar quick toggle. */
export const THEME_CYCLE: ResolvedTheme[] = ['light', 'dark'];

/** Human labels for the theme picker. */
export const THEME_LABELS: Record<ThemeMode, string> = {
  light: '☀️ Light',
  dark: '🌙 Dark',
  system: '🖥️ System Mode',
  christmas: '🎄 Christmas',
  'christmas-dark': '🎄 Christmas Dark',
  'new-year': '🎆 New Year',
  newyear: '🎆 New Year',
  easter: '🐣 Easter',
  onam: '🌼 Onam',
  'onam-dark': '🌼 Onam Dark',
};

const STORAGE_KEY = 'kvj.theme';

/** Migrate any legacy/removed theme value to a supported one. */
function normalizeStoredMode(raw: string | null): ThemeMode {
  if (raw === 'dark' || raw === 'hud') return 'dark';
  if (raw === 'light' || raw === 'hud-light') return 'light';
  if (raw === 'system') return 'system';
  if (
    raw === 'christmas' ||
    raw === 'christmas-dark' ||
    raw === 'new-year' ||
    raw === 'newyear' ||
    raw === 'easter' ||
    raw === 'onam' ||
    raw === 'onam-dark'
  ) {
    return raw as SeasonalThemeId;
  }
  return 'light';
}

export interface ThemeContextValue {
  mode: ThemeMode;          // user preference
  theme: ResolvedTheme;     // effective theme after resolving 'system'
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;       // quick toggle
  seasonalSettings: Record<SeasonalThemeId, SeasonalThemeConfig>;
  activeSeasonalThemes: SeasonalThemeConfig[];
  availableSeasonalThemes: SeasonalThemeConfig[];
  updateSeasonalSettings: (settings: Record<SeasonalThemeId, SeasonalThemeConfig>, actorId?: string) => Promise<boolean>;
  broadcastSeasonalTheme: (themeId: SeasonalThemeId, actorId?: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode; // 'light' | 'dark' | 'christmas' | 'newyear' | 'easter' | 'onam'
}

/** Boot-time application of the stored theme (call before React renders to avoid flash). */
export function initTheme(): void {
  const stored = normalizeStoredMode(localStorage.getItem(STORAGE_KEY));
  const res = resolve(stored);
  document.documentElement.setAttribute('data-theme', res);
  document.documentElement.dataset.theme = res;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => normalizeStoredMode(localStorage.getItem(STORAGE_KEY)));
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(mode));
  const [seasonalSettings, setSeasonalSettings] = useState<Record<SeasonalThemeId, SeasonalThemeConfig>>(DEFAULT_SEASONAL_THEMES);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const apply = useCallback((next: ThemeMode) => {
    const resolved = resolve(next);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.dataset.theme = resolved;
    setTheme(resolved);
    eventBus.emit('theme.changed', { theme: resolved as any });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    apply(next);
  }, [apply]);

  // Load seasonal settings on mount
  useEffect(() => {
    let mounted = true;
    loadSeasonalSettings().then((settings) => {
      if (mounted) {
        setSeasonalSettings(settings);
        evaluateAutoSeasonalTheme(modeRef.current, settings, setMode);
      }
    });

    const off = eventBus.on('seasonal_themes.changed' as any, (updatedSettings: any) => {
      if (mounted && updatedSettings) {
        setSeasonalSettings(updatedSettings);
        evaluateAutoSeasonalTheme(modeRef.current, updatedSettings, setMode);
      }
    });

    return () => {
      mounted = false;
      off();
    };
  }, [setMode]);

  // Active seasonal themes that are currently enabled AND within date schedule
  const activeSeasonalThemes = useMemo(() => {
    const now = new Date();
    return Object.values(seasonalSettings).filter((cfg) => isSeasonalThemeActive(cfg, now));
  }, [seasonalSettings]);

  // Available seasonal themes: enabled by admin and not expired (can be selected & previewed in Settings)
  const availableSeasonalThemes = useMemo(() => {
    const now = new Date();
    return Object.values(seasonalSettings).filter((cfg) => isSeasonalThemeAvailable(cfg, now));
  }, [seasonalSettings]);

  // Quick toggle cycles through light, dark, and any available seasonal themes
  const toggle = useCallback(() => {
    const cycle = ['light', 'dark', ...availableSeasonalThemes.map((st) => st.id)];
    const currentIndex = cycle.indexOf(theme);
    const next = (currentIndex !== -1 && currentIndex + 1 < cycle.length)
      ? cycle[currentIndex + 1]
      : cycle[0];
    setMode(next as ThemeMode);
  }, [theme, availableSeasonalThemes, setMode]);

  // React to OS theme changes while in 'system' mode.
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode, apply]);

  // Admin action: update settings
  const updateSeasonalSettings = useCallback(async (
    newSettings: Record<SeasonalThemeId, SeasonalThemeConfig>,
    actorId?: string
  ): Promise<boolean> => {
    const success = await saveSeasonalSettings(newSettings, actorId);
    if (success) {
      setSeasonalSettings(newSettings);
      evaluateAutoSeasonalTheme(modeRef.current, newSettings, setMode);
    }
    return success;
  }, [setMode]);

  // Admin action: broadcast/force-activate a theme for all users
  const broadcastSeasonalTheme = useCallback(async (
    themeId: SeasonalThemeId,
    actorId?: string
  ): Promise<boolean> => {
    const updated = { ...seasonalSettings };
    const currentCfg = updated[themeId];
    if (currentCfg) {
      const now = new Date();
      updated[themeId] = {
        ...currentCfg,
        enabled: true,
        broadcastId: `${themeId}-${Date.now()}`,
        // If today is outside the range, expand it to include today so it activates
        startDate: currentCfg.startDate || now.toISOString().slice(0, 10),
      };
      return updateSeasonalSettings(updated, actorId);
    }
    return false;
  }, [seasonalSettings, updateSeasonalSettings]);

  const value = useMemo(() => ({
    mode,
    theme,
    setMode,
    toggle,
    seasonalSettings,
    activeSeasonalThemes,
    availableSeasonalThemes,
    updateSeasonalSettings,
    broadcastSeasonalTheme,
  }), [mode, theme, setMode, toggle, seasonalSettings, activeSeasonalThemes, availableSeasonalThemes, updateSeasonalSettings, broadcastSeasonalTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
