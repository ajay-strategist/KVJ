# KVJ Analytics — Implementation Log & Program Tracker

Single source of truth for the build program defined by **Prompts 5–12** (treated as one SRS). Tracks phases, confirmed decisions, per-increment progress, and open items awaiting KVJ confirmation. Updated every increment.

## Confirmed decisions (locked)

| Decision | Choice | Source |
|---|---|---|
| Production datastore | Supabase / PostgreSQL (Phase 2) | Prompt 4 |
| Build phasing | Mock services + dummy data first → Supabase swap behind same interfaces | Prompt 4/12 |
| Auth platform | Custom auth now; Supabase Auth future (behind interface) | Prompt 4 |
| Language | **TypeScript** | Prompt-5 decision round |
| Codebase | **Transform existing repo in place** (additive, non-destructive; existing app keeps running) | Prompt-5 decision round |
| Business rules | **Build configurable engines with documented defaults**, confirm later | Prompt-5 decision round |
| Sequence | **Foundation first, then module-by-module** | Prompt-5 decision round + Prompt 12 phases |

## Phase map (Prompt 12 SRS → phases)

| Phase | Scope | Prompt(s) | Status |
|---|---|---|---|
| **1** | Application Foundation (folder structure, design system, theme, permission engine, shared core, navigation, auth, dashboard framework) | 5, 3, 4 | **In progress** |
| 2 | Core Platform (employees, attendance, work sessions, leave, calendar, notifications, activity feed) | 5 | Pending |
| 3 | Training Platform (training, students, attendance, assessments, eligibility, voucher, exam, certificate, alumni) | 6 | Pending |
| 4 | Project Platform (projects, tasks, work sessions, productivity, resource planning, collaboration) | 7 | Pending |
| 5 | Financial Platform (expenses, payroll prep, assets, procurement, vendors, budgets) | 8 | Pending |
| 6 | Communication Platform (chat, email, notifications, report distribution, reminders) | 9 | Pending |
| 7 | Analytics Platform (KPI engine, dashboards, report builder, executive reports, Power BI) | 10 | Pending |
| 8 | Optimization (performance, security, logging, monitoring, testing, docs) | 11 | Pending |

Each phase is independently testable; the next does not start until the previous is stable (Prompt 12 rule). A regression pass over prior modules follows every module (Prompt 12 regression rule).

## Progress log

### Increment 1 — Foundation core (this increment)
Non-destructive TypeScript foundation added under `src/` alongside the existing app (`allowJs` keeps JS + TS coexisting; existing pages untouched and still runnable).

Files created:
- `tsconfig.json` — TS config with path aliases (`@core`, `@config`, `@shared`, `@modules`), `allowJs`, strict.
- `src/core/types.ts` — universal entity contract: `UUID`, `AuditFields`, `Entity`, `Actor`, `QuerySpec`, `Page<T>`, `GeoPoint`, `DateRange`.
- `src/core/result.ts` — `AppError` + `ErrorCode` + `Result<T>` (centralized error contract; standard API envelope).
- `src/core/repository.ts` — `IRepository<T>` + `MemoryRepository<T>` (Phase-1 mock backing with soft-delete, audit, filter/search/sort/paginate).
- `src/core/registry.ts` — DI container (the mock↔Supabase swap seam).
- `src/config/business-rules.ts` — ⚠️ all placeholder business-rule defaults in one file (see open items).
- `src/config/app-config.ts` — app + branding + locale + integration config.
- `src/shared/permissions/roles.ts` — 12 default roles (data-driven, custom roles need no code).
- `src/shared/permissions/permissions.ts` — resource×action permission model + role matrix.
- `src/shared/permissions/permission-engine.ts` — `can/canAny/canAll/assertCan` (used by API, route guards, `<Can>`).
- `src/shared/design-system/tokens.css` — semantic light/dark tokens implementing design system doc 17.

### Increment 2 — Application framework (this increment)
Complete reusable Phase-1 framework added (relative imports so it runs under Vite without extra config; all files **type-check clean under strict TS — 0 errors**). No business modules.

- **Infra:** `core/event-bus.ts` (typed pub/sub), `shared/api-client/api-client.ts` (interceptors, retry, cancel, auth inject, error-normalize), `config/feature-flags.ts`.
- **Theme:** `shared/theme/ThemeProvider.tsx` — light/dark/system, persistence, runtime switch, `initTheme()` boot, `useTheme()`.
- **Auth:** `modules/auth/auth.service.ts` (`IAuthService` + `MockAuthService`: seeded users, remember-me, lockout, mock reset, session expiry) + `modules/auth/AuthProvider.tsx` (`useAuth`).
- **Authorization UI:** `shared/permissions/react.tsx` — `usePermissions`, `<Can>`, `<Authorize>`, `<ProtectedRoute>`.
- **Notifications:** `shared/notifications/NotificationProvider.tsx` — toasts + in-app store (badge, unread, grouping, priority) + mock service.
- **Dialogs/Modals:** `shared/feedback/DialogProvider.tsx` — promise-based confirm/delete/approve/success/error manager.
- **Command palette / search infra:** `shared/search/CommandPaletteProvider.tsx` — ⌘K, provider registry, recent (no business search logic).
- **UI kit:** `shared/ui/ui.css` + `components.tsx` (Button, IconButton, Card, Panel, Badge, StatusChip, Avatar, PageHeader, SectionHeader, StatCard, EmptyState, Skeleton, SearchInput, QuickActionCard, Timeline, ActivityCard) + `DataTable.tsx` (sticky header, sort, pagination, selection, skeleton, empty, mobile card fallback).
- **Forms:** `shared/forms/form.tsx` — dependency-free validation + TextField/TextArea/Select/Checkbox/Switch, error summary.
- **Navigation:** `shared/navigation/navigation.ts` — permission+flag-filtered nav tree, favorites/pinned/recent prefs.
- **Shell:** `shared/layout/AppShell.tsx` — collapsible sidebar, top bar (search/theme/notifications/profile), breadcrumbs, responsive (desktop/tablet/mobile drawer).
- **Workspace:** `shared/workspace/WorkspaceShell.tsx` — generic Employee/Supervisor/Manager/CEO layout (regions; widgets injected later).
- **Dashboard infra:** `shared/dashboard/dashboard.tsx` — widget registry + role-based grid + persisted layout (no business widgets).
- **Responsive:** `shared/hooks/responsive.ts` — `useMediaQuery`/`useBreakpoint`/`useDevice`.
- **Providers:** `app/AppProviders.tsx` — composed Theme→Auth→Notifications→Dialog→CommandPalette hierarchy.

Verification: `tsc --noEmit` against the full `src` tree with real React 19 / react-router 7 / lucide types → **0 errors**.

### Increment 3 — Runnable application integration (this increment)
The framework is now a **fully runnable app**, entirely mock-driven. Bootstrap replaced (legacy `main.jsx`/`App.jsx` preserved, no longer the entry). **Whole `src` tree type-checks clean under strict TS — 0 errors.**

- **DevX:** `tsconfig.json` path aliases mirrored in `vite.config.js`; `typescript` + `prettier` added to devDeps; `typecheck`/`format` scripts; `.prettierrc.json`.
- **Entry:** `index.html` → `/src/main.tsx`; `main.tsx` boots theme pre-paint, mounts `BrowserRouter` → `AppProviders` → `AppRouter`; `app/global.css` base.
- **Providers:** added `shared/config/ConfigProvider.tsx` (`useConfig`) into the composed hierarchy.
- **Router:** `app/router.tsx` — public + `<ProtectedRoute>` + permission-guarded routes, `lazy()` code-splitting, `Suspense` loading, `ErrorBoundary`, 404/403 pages.
- **Login:** `pages/auth/LoginPage.tsx` — premium login + forgot + reset views, remember-me, theme toggle, responsive, **6 demo-role quick logins** (role-switching demo); plus `SessionExpired` / `LockedAccount` screens.
- **Workspaces:** `pages/workspaces/WorkspacePages.tsx` — My Day (employee) + Supervisor/Manager/CEO demos on `WorkspaceShell`; `DashboardPage` renders the widget registry by role.
- **Dashboard demo:** `app/widgets/demo-widgets.tsx` — KPI row, dependency-free Bar/Line charts, activity, timeline, calendar widgets, registered into the registry.
- **Showcase:** `pages/ShowcasePage.tsx` — permanent reference for every reusable component.
- **Mock engine:** `shared/mock/factories.ts` — deterministic factories (employees, projects, students, tasks, activity, calendar, chart series). No component hardcodes data.
- **Command palette nav:** `app/CommandRegistrar.tsx` — permission-filtered navigation commands (⌘K).
- **Errors:** `pages/errors/ErrorPages.tsx` — 404/403/500/Offline + route loading skeleton.

**How to run:** `npm install` then `npm run dev`. Type-check: `npm run typecheck`. Demo logins (password `demo1234`, or one-click buttons): admin@ / ceo@ / ops@ / lead@ / supervisor@ / employee@ `kvj.test`.

Verification: `tsc --noEmit -p tsconfig.json` over full `src` → **0 errors**.

---

## Phase 1 — Final Architectural Review (required by the finalization prompt)

**Technical debt (intentional, tracked):**
- Legacy MERN app (`src/pages/*.jsx`, `src/components/*.jsx`, `App.jsx`, `main.jsx`, `server/`) still present — **by design** (preserve working code; migrate module-by-module). It's dormant, not the entry. To be retired as each Phase-2+ module reaches parity.
- Business-rule values are placeholders in `config/business-rules.ts` pending KVJ confirmation (does not block framework).
- `typescript` must be installed (`npm install`) for `npm run typecheck`; Vite runs the TS via esbuild regardless.

**Duplicated code:** none material. Styling centralised in `tokens.css` + `ui.css`; data via mock factories; a few small inline-style helpers repeat across pages (acceptable; could fold into UI kit later).

**Incomplete infrastructure (deferred, non-blocking):**
- Dashboard **drag-and-drop / resize editor** — registry + persistence ready; the editor UI is behind the `dashboardBuilder` flag (Prompt allowed "future dashboard builder").
- Notification **drawer** UI (store + badge + toasts done; slide-out drawer panel pending).
- Command palette shows navigation only (business search providers arrive with modules — as instructed).
- Real Supabase/Google adapters (Phase 2).

**Missing reusable components (to add early in Phase 2, low effort):**
- Tabs, Accordion, generic Drawer/BottomSheet, Tooltip, Pagination-as-component.
- Advanced form inputs: SearchableSelect/MultiSelect, DatePicker, TimePicker, DateRangePicker, FileUpload (native inputs used for now).

**Quality gates (Phase-1 §12) — status:** No duplicate components ✓ · No direct fetch/axios in components (all via ApiClient) ✓ · No page bypasses providers (all under `AppProviders`) ✓ · permissions via central engine ✓ · theme via provider only ✓ · config centralised ✓ · strict TS clean ✓.

**Verdict:** Phase 1 foundation is complete and stable. Cleared to begin **Phase 2 — Attendance & Employee Platform** (add the Tabs/Drawer/advanced-input primitives as the first small task of Phase 2).

### Next (Phase 2)
Employee module → Attendance (clock in/out, work-type, geolocation) → Work Sessions + Breaks → Leave → Calendar, all mock-backed behind the service/repository seam, then Supabase in Phase 2 cutover.

## Open items awaiting KVJ confirmation

These do not block foundation work; they gate the *final* logic of specific modules. All placeholder defaults live in `src/config/business-rules.ts`.

1. **Attendance policy** — working days/hours, late grace, half/full-day thresholds.
2. **Leave** — approval chain (default Employee→Manager→HR) and annual entitlements per type.
3. **Training eligibility** — min attendance % (default 75), min assessment % (default 40), final-exam requirement.
4. **Voucher** — allocation rule (default 1/eligible student) and expiry.
5. **Referral** — reward % of course fee (default 10) and stages.
6. **Finance** — currency, km reimbursement rates, per-diem, expense approval chain (default Manager→Finance), GST default.
7. **Task/Project** — task approval chain (Manager step optional?), project-health thresholds.
8. **Branding** — confirm primary colour (default Blue-600) and report display font.

## Notes & guardrails
- Type-checking requires `typescript` as a dev dependency (`npm i -D typescript`); Vite runs the `.ts` files via esbuild without it. To be added with the build tooling in the next increment.
- Nothing in the existing running app was modified or removed this increment (Prompt 12 "preserve working functionality").
- No business number is hardcoded outside `business-rules.ts`.
