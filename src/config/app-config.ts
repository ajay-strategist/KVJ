/**
 * KVJ Analytics — Application & branding configuration
 * Layer: Config (Prompt 4 §16). Phase 1: static defaults here.
 * Phase 2: sourced from Organization Settings (Supabase) so admins edit without code.
 *
 * Branding tokens here drive the design system (docs/17-design-system.md §19),
 * so re-branding is a config change, never a code change.
 */

export const appConfig = {
  app: {
    name: 'KVJ Analytics',                 // CONFIRM display name
    shortName: 'KVJ',
    version: '0.1.0-foundation',
    environment: (import.meta as { env?: Record<string, string> }).env?.MODE ?? 'development',
  },

  branding: {
    // Default preset = "KVJ Modern" (design system §19). "KVJ Classic" preserves
    // the existing navy/blue identity — swap by changing these tokens only.
    preset: 'kvj-modern' as 'kvj-modern' | 'kvj-classic',
    primary: '#2563EB',                    // CONFIRM primary brand colour (Blue-600 default)
    secondary: '#8B5CF6',                  // CONFIRM secondary (Purple)
    logoLight: '/logo.png',
    logoDark: '/logo.png',                 // CONFIRM dark-variant logo
    fontUi: "'Inter', sans-serif",
    fontReport: "'Fraunces', serif",       // CONFIRM report display font
  },

  locale: {
    dateFormat: 'DD MMM YYYY',             // user-overridable (User Preferences)
    timeFormat: '12h',                     // '12h' | '24h'
    timezone: 'Asia/Kolkata',              // CONFIRM default org timezone
    firstDayOfWeek: 1,                     // Monday
  },

  organization: {
    financialYearStartMonth: 4,            // CONFIRM (India FY = April)
    // Departments/designations/locations become editable settings in Phase 2.
  },

  integrations: {
    driveRootFolder: 'KVJ Analytics',      // auto-created folder tree (Prompt 4 §9)
    driveSubfolders: [
      'Employees', 'Students', 'Projects', 'Trainings',
      'Expense Receipts', 'Reports', 'Marketing', 'Temporary Uploads',
    ],
    powerBiEnabled: false,                 // Phase 2
    supabaseEnabled: false,                // Phase 2 (mock services until then)
  },
} as const;

export type AppConfig = typeof appConfig;
