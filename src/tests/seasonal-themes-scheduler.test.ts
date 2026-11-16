import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSeasonalThemeActive,
  evaluateAutoSeasonalTheme,
  getCelebrationYear,
  DEFAULT_SEASONAL_THEMES,
  type SeasonalThemeConfig,
  type SeasonalThemeId,
} from '../shared/theme/seasonal-themes';

describe('Seasonal Theme Scheduler & Auto-Broadcast Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('determines active status based on date schedule and enabled flag', () => {
    const config: SeasonalThemeConfig = {
      id: 'christmas',
      name: 'Christmas',
      icon: '🎄',
      enabled: true,
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      description: 'Festive theme',
      accentColor: '#16a34a',
      broadcastId: 'xmas-v1',
    };

    // Before start date
    expect(isSeasonalThemeActive(config, new Date('2026-11-20'))).toBe(false);

    // On start date
    expect(isSeasonalThemeActive(config, new Date('2026-12-01'))).toBe(true);

    // Inside range
    expect(isSeasonalThemeActive(config, new Date('2026-12-25'))).toBe(true);

    // On end date
    expect(isSeasonalThemeActive(config, new Date('2026-12-31'))).toBe(true);

    // After end date
    expect(isSeasonalThemeActive(config, new Date('2027-01-01'))).toBe(false);

    // If disabled by Admin, returns false even within date range
    expect(isSeasonalThemeActive({ ...config, enabled: false }, new Date('2026-12-25'))).toBe(false);
  });

  it('auto-applies active scheduled theme for everyone on initial rollout', () => {
    const setMode = vi.fn();
    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      christmas: {
        ...DEFAULT_SEASONAL_THEMES.christmas,
        enabled: true,
        startDate: '2026-11-01',
        endDate: '2026-12-31',
        broadcastId: 'xmas-broadcast-1',
      },
    };

    // Today is inside the scheduled range
    evaluateAutoSeasonalTheme('light', mockSettings, setMode);

    // Should switch to christmas
    expect(setMode).toHaveBeenCalledWith('christmas');
    // Should record broadcast token in localStorage
    const applied = JSON.parse(localStorage.getItem('kvj.theme.broadcast_applied') || '[]');
    expect(applied).toContain('christmas:xmas-broadcast-1');
  });

  it('does NOT override user choice if user manually switched away after broadcast applied', () => {
    const setMode = vi.fn();
    // Simulate that the broadcast was already applied
    localStorage.setItem(
      'kvj.theme.broadcast_applied',
      JSON.stringify(['christmas:xmas-broadcast-1'])
    );

    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      christmas: {
        ...DEFAULT_SEASONAL_THEMES.christmas,
        enabled: true,
        startDate: '2026-11-01',
        endDate: '2026-12-31',
        broadcastId: 'xmas-broadcast-1',
      },
    };

    // User chose dark mode
    evaluateAutoSeasonalTheme('dark', mockSettings, setMode);

    // Should NOT call setMode again because user already received broadcast and chose dark
    expect(setMode).not.toHaveBeenCalled();
  });

  it('reverts user to light mode if current seasonal theme has expired or been disabled by admin', () => {
    const setMode = vi.fn();
    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      christmas: {
        ...DEFAULT_SEASONAL_THEMES.christmas,
        enabled: false, // Admin turned it off
        startDate: '2026-11-01',
        endDate: '2026-12-31',
      },
    };

    // User had christmas theme active
    evaluateAutoSeasonalTheme('christmas', mockSettings, setMode);

    // Should automatically revert user to light mode
    expect(setMode).toHaveBeenCalledWith('light');
  });

  it('reverts user to light mode if current date is past the theme end date or before start date', () => {
    const setMode = vi.fn();
    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      onam: {
        ...DEFAULT_SEASONAL_THEMES.onam,
        enabled: true,
        startDate: '2026-08-20',
        endDate: '2026-09-15', // Past date
      },
      'new-year': {
        ...DEFAULT_SEASONAL_THEMES['new-year'],
        enabled: true,
        startDate: '2026-12-28', // Future date
        endDate: '2027-01-10',
      },
    };

    // User had onam theme active, but today is past Sept 15
    evaluateAutoSeasonalTheme('onam', mockSettings, setMode);
    expect(setMode).toHaveBeenCalledWith('light');

    setMode.mockClear();

    // User had new-year theme active, but today is before Dec 28
    evaluateAutoSeasonalTheme('new-year', mockSettings, setMode);
    expect(setMode).toHaveBeenCalledWith('light');
  });

  it('supports new-year theme rollout and resolution', () => {
    const setMode = vi.fn();
    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      'new-year': {
        ...DEFAULT_SEASONAL_THEMES['new-year'],
        enabled: true,
        startDate: '2026-11-01',
        endDate: '2027-01-15',
        broadcastId: 'ny-broadcast-1',
      },
    };

    evaluateAutoSeasonalTheme('light', mockSettings, setMode);
    expect(setMode).toHaveBeenCalledWith('new-year');
  });

  it('supports christmas-dark theme configuration and rollout', () => {
    const setMode = vi.fn();
    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      'christmas-dark': {
        ...DEFAULT_SEASONAL_THEMES['christmas-dark'],
        enabled: true,
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        broadcastId: 'xmas-dark-broadcast-1',
      },
    };

    expect(DEFAULT_SEASONAL_THEMES['christmas-dark']).toBeDefined();
    expect(DEFAULT_SEASONAL_THEMES['christmas-dark'].name).toBe('Christmas Dark');
    expect(isSeasonalThemeActive(mockSettings['christmas-dark'], new Date('2026-12-25'))).toBe(true);
    expect(isSeasonalThemeActive(mockSettings['christmas-dark'], new Date('2027-01-05'))).toBe(false);
  });

  it('supports onam and onam-dark theme configuration and active resolution', () => {
    expect(DEFAULT_SEASONAL_THEMES['onam']).toBeDefined();
    expect(DEFAULT_SEASONAL_THEMES['onam-dark']).toBeDefined();
    expect(DEFAULT_SEASONAL_THEMES['onam'].name).toBe('Onam');
    expect(DEFAULT_SEASONAL_THEMES['onam-dark'].name).toBe('Onam Dark');

    const mockSettings: Record<SeasonalThemeId, SeasonalThemeConfig> = {
      ...DEFAULT_SEASONAL_THEMES,
      'onam-dark': {
        ...DEFAULT_SEASONAL_THEMES['onam-dark'],
        enabled: true,
        startDate: '2026-08-20',
        endDate: '2026-09-15',
        broadcastId: 'onam-dark-broadcast-1',
      },
    };

    expect(isSeasonalThemeActive(mockSettings['onam-dark'], new Date('2026-08-28'))).toBe(true);
    expect(isSeasonalThemeActive(mockSettings['onam-dark'], new Date('2026-10-01'))).toBe(false);
  });

  it('automatically computes the dynamic celebration year based on current date', () => {
    // In late November 2026 -> Celebration year is 2027
    expect(getCelebrationYear(new Date('2026-11-15'))).toBe(2027);

    // In late December 2026 -> Celebration year is 2027
    expect(getCelebrationYear(new Date('2026-12-31'))).toBe(2027);

    // In early January 2027 -> Celebration year is 2027
    expect(getCelebrationYear(new Date('2027-01-01'))).toBe(2027);

    // In late December 2027 -> Celebration year automatically updates to 2028
    expect(getCelebrationYear(new Date('2027-12-29'))).toBe(2028);

    // In early January 2028 -> Celebration year is 2028
    expect(getCelebrationYear(new Date('2028-01-05'))).toBe(2028);
  });
});
