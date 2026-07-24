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
    // Absorbed into Batches → Training Details (students, session attendance and
    // assessments live inside a training, not as separate top-level pages).
    studentLifecycle: false,
    sessionAttendance: false,
    assessments: false,
    // Absorbed into Projects & Tasks (two tabs).
    clientsMaster: false,
    projectCatalog: false,
    resourceScheduler: false,
    taskBoard: false,
    timesheets: false,
  },
  // Integrations
  integrations: {
    supabase: true, // master switch — set to true for live Supabase integration
    googleDrive: false,
    powerBi: false,
  },

  supabaseModules: {
    employee: true,   // Table public.employees
    attendance: true, // Table public.attendance_records
    leave: true,      // Table public.leave_records
    training: true,   // Table public.courses, batches, student_records, etc.
    project: true,    // Table public.projects, tasks, milestones, etc.
    finance: true,    // Table public.expense_claims, budgets, assets, etc.
    communication: true, // Table public.chat_channels, chat_messages, announcements
    analytics: true,  // Table public.kpi_definitions, saved_reports
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

export function isSupabaseConfigured(): boolean {
  const metaEnv = (import.meta as { env?: Record<string, string> }).env ?? {};
  const url = metaEnv.VITE_SUPABASE_URL || '';
  const key = metaEnv.VITE_SUPABASE_ANON_KEY || '';
  return !!url && url !== 'https://mock-project.supabase.co' && !url.includes('mock-project') && !!key && key !== 'mock-anon-key';
}

/**
 * True when a module should resolve its Supabase repositories instead of the
 * mock ones. Requires BOTH the master integration switch, valid configuration, and that module's
 * own cutover flag, so a half-migrated database can never take the app down.
 */
export function usesSupabase(key: keyof FeatureFlags['supabaseModules']): boolean {
  return featureFlags.integrations.supabase && featureFlags.supabaseModules[key] && isSupabaseConfigured();
}
