import { supabase } from '../integration/supabase';
import { eventBus } from '../../core/event-bus';

export type SeasonalThemeId = 'christmas' | 'christmas-dark' | 'new-year' | 'newyear' | 'easter' | 'onam' | 'onam-dark';

/**
 * Computes the celebration year dynamically:
 * If the date is in late autumn/winter (November or December), the upcoming celebration year is next year (e.g. Nov/Dec 2026 -> 2027).
 * If in January through October, it is the current calendar year (e.g. Jan 2027 -> 2027).
 */
export function getCelebrationYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0 is January, 10 is November, 11 is December
  return month >= 10 ? date.getFullYear() + 1 : date.getFullYear();
}

export interface SeasonalThemeConfig {
  id: SeasonalThemeId;
  name: string;
  icon: string;
  enabled: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  description: string;
  accentColor: string;
  broadcastId: string; // unique ID bumped on admin broadcast to auto-apply once to users
}

export const DEFAULT_SEASONAL_THEMES: Record<SeasonalThemeId, SeasonalThemeConfig> = {
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    icon: '🎄',
    enabled: true,
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    description: 'Festive Red & Snow with frosted glass, crystalline surfaces & candlelight gold',
    accentColor: '#DC2626',
    broadcastId: 'xmas-2026-v2',
  },
  'christmas-dark': {
    id: 'christmas-dark',
    name: 'Christmas Dark',
    icon: '🎄',
    enabled: true,
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    description: 'Festive Midnight Obsidian & Velvet Crimson with cozy cabin, lit tree & glowing lantern',
    accentColor: '#DC2626',
    broadcastId: 'xmas-dark-2026-v2',
  },
  'new-year': {
    id: 'new-year',
    name: 'New Year',
    icon: '🎆',
    enabled: true,
    startDate: '2026-12-28',
    endDate: '2027-01-10',
    description: 'Champagne Gold & Midnight Obsidian with celestial starlight sparkle',
    accentColor: '#D6B56D',
    broadcastId: 'ny-2027-v2',
  },
  newyear: {
    id: 'newyear',
    name: 'New Year',
    icon: '🎆',
    enabled: true,
    startDate: '2026-12-28',
    endDate: '2027-01-10',
    description: 'Champagne Gold & Midnight Obsidian with celestial starlight sparkle',
    accentColor: '#D6B56D',
    broadcastId: 'ny-2027-v2',
  },
  easter: {
    id: 'easter',
    name: 'Easter',
    icon: '🐣',
    enabled: true,
    startDate: '2027-03-25',
    endDate: '2027-04-15',
    description: 'Spring Lilac & Meadow Mint with fresh pastel floral renewal',
    accentColor: '#7C3AED',
    broadcastId: 'easter-2027-v2',
  },
  onam: {
    id: 'onam',
    name: 'Onam',
    icon: '🌼',
    enabled: true,
    startDate: '2027-08-25',
    endDate: '2027-09-15',
    description: 'Kerala Kasavu Gold & Marigold Saffron with Vallamkali, Pookalam & Nilavilakku',
    accentColor: '#B8860B',
    broadcastId: 'onam-2027-v2',
  },
  'onam-dark': {
    id: 'onam-dark',
    name: 'Onam Dark',
    icon: '🌼',
    enabled: true,
    startDate: '2027-08-25',
    endDate: '2027-09-15',
    description: 'Midnight Kasavu & Backwaters with illuminated Pookalam, Nilavilakku & Vallamkali',
    accentColor: '#D48806',
    broadcastId: 'onam-dark-2027-v1',
  },
};

const SYSTEM_SETTINGS_KEY = 'seasonal_theme_settings';
const LOCAL_CACHE_KEY = 'kvj.seasonal_theme_settings';
const BROADCAST_APPLIED_KEY = 'kvj.theme.broadcast_applied';

/**
 * Checks whether a given seasonal theme is currently active by date schedule.
 */
export function isSeasonalThemeActive(config: SeasonalThemeConfig, targetDate: Date = new Date()): boolean {
  if (!config.enabled) return false;
  if (!config.startDate || !config.endDate) return config.enabled;

  const todayStr = targetDate.toISOString().slice(0, 10);
  return todayStr >= config.startDate && todayStr <= config.endDate;
}

/**
 * Checks if a seasonal theme is available to select/show:
 * It must be enabled by Admin and currently active by date schedule (startDate <= today <= endDate).
 * If anything is not active, it is not available.
 */
export function isSeasonalThemeAvailable(config: SeasonalThemeConfig, targetDate: Date = new Date()): boolean {
  return isSeasonalThemeActive(config, targetDate);
}

/**
 * Loads seasonal theme settings from Supabase (or localStorage fallback).
 */
export async function loadSeasonalSettings(): Promise<Record<SeasonalThemeId, SeasonalThemeConfig>> {
  try {
    const { data, error } = await supabase
      .from('flwdsk_system_settings')
      .select('value')
      .eq('key', SYSTEM_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      const merged = { ...DEFAULT_SEASONAL_THEMES, ...parsed };
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load seasonal theme settings from Supabase, using cache/defaults:', e);
  }

  // Fallback to local cache
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      return { ...DEFAULT_SEASONAL_THEMES, ...JSON.parse(cached) };
    }
  } catch (_) {
    // Ignore cache parse errors
  }

  return DEFAULT_SEASONAL_THEMES;
}

/**
 * Saves seasonal theme settings to Supabase and updates local cache.
 */
export async function saveSeasonalSettings(
  settings: Record<SeasonalThemeId, SeasonalThemeConfig>,
  actorId?: string
): Promise<boolean> {
  // Update local cache immediately
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(settings));

  try {
    const { error } = await supabase
      .from('flwdsk_system_settings')
      .upsert({
        key: SYSTEM_SETTINGS_KEY,
        value: settings,
        updated_at: new Date().toISOString(),
        updated_by: actorId || null,
      });

    if (error) {
      console.warn('Failed to save seasonal settings to Supabase:', error.message);
      return false;
    }

    eventBus.emit('seasonal_themes.changed' as any, settings as any);
    return true;
  } catch (e) {
    console.error('Error saving seasonal theme settings:', e);
    return false;
  }
}

/**
 * Automatically applies scheduled or broadcast seasonal theme once.
 * Respects user's manual preference after broadcast has been applied.
 * Also reverts users to 'light' if their current theme was turned off or expired.
 */
export function evaluateAutoSeasonalTheme(
  currentMode: string,
  settings: Record<SeasonalThemeId, SeasonalThemeConfig>,
  setMode: (mode: any) => void
): void {
  const today = new Date();
  const appliedBroadcasts: string[] = (() => {
    try {
      const raw = localStorage.getItem(BROADCAST_APPLIED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  // 1. Check if current theme is not active (disabled, before start date, or past end date)
  if (['christmas', 'new-year', 'newyear', 'easter', 'onam'].includes(currentMode)) {
    const config = settings[currentMode as SeasonalThemeId];
    const isActive = config ? isSeasonalThemeActive(config, today) : false;

    if (!isActive) {
      console.info(`Seasonal theme '${currentMode}' is not currently active. Reverting to light theme.`);
      setMode('light');
      return;
    }
  }

  // 2. Check if there is an active scheduled theme that hasn't been auto-applied yet
  for (const themeId of Object.keys(settings) as SeasonalThemeId[]) {
    const config = settings[themeId];
    if (isSeasonalThemeActive(config, today)) {
      const broadcastToken = `${themeId}:${config.broadcastId || config.startDate}`;
      if (!appliedBroadcasts.includes(broadcastToken)) {
        // Auto-switch everyone to the festive theme once
        console.info(`Auto-applying scheduled seasonal theme: ${config.name} (${broadcastToken})`);
        setMode(themeId);
        appliedBroadcasts.push(broadcastToken);
        localStorage.setItem(BROADCAST_APPLIED_KEY, JSON.stringify(appliedBroadcasts));
        break;
      }
    }
  }
}
