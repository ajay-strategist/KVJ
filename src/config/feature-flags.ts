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
  // Integrations
  integrations: {
    supabase: false, // Phase 2
    googleDrive: false,
    powerBi: false,
  },
} as const;

export type FeatureFlags = typeof featureFlags;

/** Narrow helper used by nav/route guards. */
export function isModuleEnabled(key: keyof FeatureFlags['modules']): boolean {
  return featureFlags.modules[key];
}
