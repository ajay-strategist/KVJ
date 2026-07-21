/**
 * KVJ Analytics — Feature flags (Prompt 4 §16 Configuration)
 * Layer: Config. Enables safe rollout of modules/capabilities.
 * Phase 1: static defaults. Phase 2: overridden from Organization Settings (Supabase).
 */

export const featureFlags = {
  // Phase gating — modules light up as they are built.
  modules: {
    employee: true,
    attendance: true,   // Phase 2
    leave: true,        // Phase 2
    training: true,     // Phase 3
    project: true,      // Phase 4
    finance: true,      // Phase 5
    communication: true,// Phase 6
    analytics: true,    // Phase 7
  },
  // Platform capabilities
  platform: {
    commandPalette: true,
    darkMode: true,
    dashboardBuilder: false, // drag/drop layout editing (infra ready, UI later)
    globalSearch: true,      // infrastructure only in Phase 1
  },
  /**
   * Page-level gating (finer than `modules`). Confirmed scope: keep Chat and
   * Announcements; hide the analytics suite, the finance extras and the extra
   * communication pages. Hidden = removed from nav, code retained so any of
   * these can be switched back on with a single flag.
   */
  pages: {
    // Communication — keep these two
    chat: true,
    announcements: true,
    // Communication — hidden
    emailCenter: false,
    reminders: false,
    // Analytics suite — hidden
    executiveConsole: false,
    reportBuilder: false,
    kpiRegistry: false,
    powerBiGateway: false,
    // Finance extras — hidden (Expenses & Travel stays)
    procurement: false,
    assets: false,
    budgets: false,
    payroll: false,
  },
  // Integrations
  integrations: {
    supabase: false, // master switch — must be on for ANY module to use Supabase
    googleDrive: false,
    powerBi: false,
  },

  /**
   * Per-module Supabase cutover. A module may only be switched on once its
   * tables actually exist in the database, otherwise every query fails with
   * "table not found". This lets us migrate module-by-module instead of
   * flipping the whole app at once.
   *
   * Covered by supabase/migrations today: employee, attendance, leave.
   * The rest still need their schema written.
   */
  supabaseModules: {
    employee: false,
    attendance: false,
    leave: false,
    training: false,
    project: false,
    finance: false,
    communication: false,
    analytics: false,
  },
} as const;

export type FeatureFlags = typeof featureFlags;

/** Narrow helper used by nav/route guards. */
export function isModuleEnabled(key: keyof FeatureFlags['modules']): boolean {
  return featureFlags.modules[key];
}

/** Page-level gate used by the nav engine. */
export function isPageEnabled(key: keyof FeatureFlags['pages']): boolean {
  return featureFlags.pages[key];
}

/**
 * True when a module should resolve its Supabase repositories instead of the
 * mock ones. Requires BOTH the master integration switch and that module's
 * own cutover flag, so a half-migrated database can never take the app down.
 */
export function usesSupabase(key: keyof FeatureFlags['supabaseModules']): boolean {
  return featureFlags.integrations.supabase && featureFlags.supabaseModules[key];
}
