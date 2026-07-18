# KVJ Analytics — Architecture Specification

**Version:** 1.0 (proposal for approval)
**Scope:** Prompt 4 — the technical foundation every module must follow.
**Status:** Specification only. **No business modules, database tables, or APIs have been implemented, and no application code has been modified.** This document defines contracts, structure, and strategy; module implementation begins only after approval.

## Decisions resolved by Prompt 4 (previously open in reports 02/16/Assessment)

| Decision | Resolution |
|---|---|
| Production datastore | **Supabase (PostgreSQL)** — Phase 2 |
| Build phasing | **Phase 1 mock services + dummy data → Phase 2 Supabase**, swapping only Service/Repository implementations; UI unchanged |
| Auth platform | **Custom auth now; Supabase Auth is "future"** — auth stays behind an interface so it can be swapped later |
| File binaries | **Google Drive**; Supabase stores metadata only |
| Coupling | **Clean Architecture + event-driven** where practical |

## Two open foundational choices (recommend, awaiting confirmation — not business rules)

1. **Language: TypeScript (strongly recommended)** for the new architecture. The current app is plain JS/JSX; typed contracts are what make the layer boundaries and the Phase-1→Phase-2 swap safe. *Fallback:* JS + JSDoc types. Interface sketches below use TS syntax illustratively.
2. **Monorepo layout** (`apps/web`, `apps/api`, `packages/shared`) vs two folders. Recommended: lightweight workspaces monorepo for shared types. Either works with the structure below.

---

## Contents
1. [Folder Structure](#1-folder-structure) · 2. [Module Structure](#2-module-structure) · 3. [Service Layer](#3-service-layer) · 4. [Repository Layer](#4-repository-layer) · 5. [API Layer](#5-api-layer) · 6. [Database Strategy](#6-database-strategy) · 7. [Supabase Strategy](#7-supabase-strategy) · 8. [Google Integration Strategy](#8-google-integration-strategy) · 9. [File Storage Strategy](#9-file-storage-strategy) · 10. [Report Engine](#10-report-engine-architecture) · 11. [Certificate Engine](#11-certificate-engine-architecture) · 12. [Workflow Engine](#12-workflow-engine-architecture) · 13. [Notification Architecture](#13-notification-architecture) · 14. [Event Architecture](#14-event-architecture) · 15. [Audit Architecture](#15-audit-architecture) · 16. [Configuration Management](#16-configuration-management) · 17. [Security Architecture](#17-security-architecture) · 18. [Performance Strategy](#18-performance-strategy) · 19. [Scalability Strategy](#19-scalability-strategy) · 20. [Migration Strategy](#20-migration-strategy)

---

## 0. The layered model (how a request flows)

```
Presentation (React pages/components — design system)     ← never touches DB/HTTP directly
   │  calls hooks →
Application (module hooks, view-models, query cache, optimistic UI)
   │  calls →
Business Logic (Services — rules, orchestration, events)  ← the only place business rules live
   │  calls →
Repository (CRUD/search/paginate — datastore-agnostic interface)
   │  implemented by →
Integration (Supabase / Google Drive / Gmail / Sheets / PowerBI adapters)
   │  talks to →
Database / External systems (Postgres, Drive, …)
```

**Golden rule:** dependencies point **downward only**. UI depends on Application; Application on Business; Business on Repository *interfaces* (not implementations). Repository/Integration implementations are injected. This is what lets Phase-1 mocks and Phase-2 Supabase coexist behind the same contracts.

---

## 1. Folder Structure

```
kvj-platform/
├─ apps/
│  ├─ web/                         # React SPA (Presentation + Application)
│  │  ├─ app/                      # bootstrap, providers, router, workspace shells
│  │  ├─ workspaces/               # employee | supervisor | manager | ceo
│  │  ├─ modules/                  # feature modules (see §2)
│  │  ├─ shared/                   # shared front-end modules (see below)
│  │  └─ styles/                   # design tokens, theme
│  └─ api/                         # Express (Business + Repository + Integration)
│     ├─ modules/                  # mirror of feature modules (server side)
│     ├─ platform/                 # cross-cutting: error, logging, auth, rbac, validation
│     ├─ integration/             # drive, gmail, sheets, powerbi, supabase adapters
│     ├─ engines/                  # report, certificate, workflow, notification, template
│     ├─ events/                   # event bus + handlers
│     └─ jobs/                     # scheduler + jobs (distributed-ready)
├─ packages/
│  └─ shared/                      # DTOs, types, validation schemas, constants (used by web + api)
├─ supabase/                       # migrations, RLS policies, seed (Phase 2)
└─ docs/                           # this documentation set
```

### Shared front-end modules (`apps/web/shared/`)
`design-system` (tokens, primitives, theme, motion) · `ui` (composed components) · `icons` · `charts` · `forms` · `tables` · `api-client` · `auth` · `notifications` · `storage` · `config` · `validation` · `export` · `print` · `permissions` · `utils`.

Each shared module has a single public entry (`index.ts`) — modules import from the entry, never deep-reach into internals.

---

## 2. Module Structure

Every feature is a **self-contained module** with an identical internal shape, on both web and api sides.

**Module list (v1):** `auth`, `employee`, `attendance`, `training`, `student`, `project`, `task`, `expense`, `leave`, `payroll`, `communication`, `report`, `analytics`, `settings`, `notification`.

### Web module
```
modules/attendance/
├─ components/      # module-specific UI (compose shared design system)
├─ pages/           # route screens
├─ hooks/           # useAttendance(), useClock() — Application layer
├─ services/        # client-side service facade → api-client (NO fetch/axios inline)
├─ types/           # module DTOs (or re-export from packages/shared)
├─ validation/      # zod schemas (shared with api)
├─ constants/
├─ utils/
├─ routes.ts        # module route table (lazy-loaded)
├─ state.ts         # local module state (if any beyond query cache)
└─ index.ts         # public surface
```

### API module
```
api/modules/attendance/
├─ routes.ts        # express router (thin)
├─ controller.ts    # HTTP adapter: validate → call service → shape response
├─ service.ts       # BUSINESS LOGIC + emits events (implements IAttendanceService)
├─ repository.ts    # IAttendanceRepository impl (Phase 2 Supabase) / mock (Phase 1)
├─ dto.ts           # request/response contracts
├─ validation.ts    # zod (shared with web)
├─ events.ts        # event names + payload types this module publishes
└─ index.ts
```

**Independence + communication:** modules never import another module's internals. Cross-module needs go through **shared services** (e.g. NotificationService) or **domain events** (§14). This keeps modules replaceable and testable in isolation.

---

## 3. Service Layer

Business logic lives **only** in services. Services are defined as **interfaces** (contracts) with swappable implementations (mock ↔ real).

```ts
// contract — stable across phases
interface IAttendanceService {
  clockIn(userId: UUID, geo?: GeoPoint): Promise<AttendanceDTO>;
  clockOut(userId: UUID): Promise<AttendanceDTO>;
  startBreak(userId: UUID): Promise<AttendanceDTO>;
  endBreak(userId: UUID): Promise<AttendanceDTO>;
  getForUser(userId: UUID, range: DateRange, page: PageReq): Promise<Page<AttendanceDTO>>;
  correct(id: UUID, patch: AttendanceCorrection, actor: Actor): Promise<AttendanceDTO>; // audited
}
```

- Services depend on **repository interfaces + integration interfaces**, never on concrete datastores.
- Services **emit domain events** after state changes (§14) rather than calling other modules directly.
- Services are **reusable** and **stateless** (no request/HTTP knowledge — that's the controller's job).
- **Domain (engine) services** are shared platform services: `ReportService`, `CertificateService`, `NotificationService`, `CommunicationService`, `TemplateService`, `WorkflowService`, `DriveService`, `SheetsService`, `PowerBIService`, `AuditService`, `StorageService`.

**Dependency injection:** a lightweight container/registry wires interfaces → implementations at boot. Phase 1 registers mock impls; Phase 2 registers Supabase/Google impls. **No other code changes.**

---

## 4. Repository Layer

Repositories do **data access only** — no business rules. A generic base contract plus per-entity extensions:

```ts
interface IRepository<T, TCreate, TUpdate> {
  create(data: TCreate, actor: Actor): Promise<T>;
  findById(id: UUID): Promise<T | null>;
  findMany(query: QuerySpec): Promise<Page<T>>;   // filter, sort, paginate, search
  update(id: UUID, patch: TUpdate, actor: Actor): Promise<T>;
  softDelete(id: UUID, actor: Actor): Promise<void>;  // sets deleted_at + deleted_by
}
interface IAttendanceRepository extends IRepository<Attendance, AttendanceCreate, AttendanceUpdate> {
  findOpenSession(userId: UUID): Promise<Attendance | null>;
}
```

- `QuerySpec` standardizes **filtering, sorting, pagination, full-text search** across all repos.
- **Phase 1:** `MockAttendanceRepository` backed by in-memory/JSON dummy data.
- **Phase 2:** `SupabaseAttendanceRepository` using the Supabase client. Swapping the registration is the entire change — business logic untouched.
- Repositories enforce **audit/soft-delete fields** (§6) uniformly (via a base implementation), so no module forgets them.

---

## 5. API Layer

**No component calls `fetch`/`axios` directly.** All traffic flows through a centralized **API client** (web) and a consistent controller/response contract (api).

### Web API client (`shared/api-client`)
A single configured client (axios instance or fetch wrapper) exposing typed methods used by module services. Responsibilities:
`auth header/cookie injection` · `request/response interceptors` · `retry with backoff (idempotent GETs)` · `response caching / dedupe (via query layer)` · `token refresh` (Phase 2) · `centralized error normalization` · `logging/telemetry` · `timeout` · `request cancellation`.

```ts
// module service uses the client — never raw axios
class AttendanceApi {
  constructor(private http: ApiClient) {}
  clockIn(geo?: GeoPoint) { return this.http.post<AttendanceDTO>('/v1/attendance/clock-in', { geo }); }
}
```

### API server contract
- **Versioned** routes under `/api/v1/<module>`.
- **Standard envelope:** `{ ok: true, data, meta } | { ok: false, error: { code, message, details?, traceId } }`.
- **Pipeline per request:** `validate (zod) → authenticate → authorize (RBAC/permissions) → controller → service → repository`, wrapped by the **central error handler** (§ Error Handling) and **request logger**.
- **Never** leak stack traces; production errors return safe `code`/`message` + `traceId` for correlation.

---

## 6. Database Strategy

Target: **PostgreSQL via Supabase.** Universal conventions on **every** table:

| Field | Type | Purpose |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | UUID primary key |
| `status` | `text`/enum | entity status |
| `created_at` | `timestamptz` default now() | audit |
| `updated_at` | `timestamptz` (trigger) | audit |
| `created_by` | `uuid` FK→users | audit |
| `updated_by` | `uuid` FK→users | audit |
| `deleted_at` | `timestamptz` null | **soft delete** |
| `deleted_by` | `uuid` null | soft delete actor |

Principles: **real foreign keys** with sensible `on delete` behavior; **normalize** (3NF) by default, **denormalize only for measured performance**; **indexes** on FKs and hot filter columns (from report 10: attendance user+date, task assignee/team/status/due, leave user+status, timesheet user+date, message channel, expense user+status); enums via lookup tables or Postgres enums; `updated_at` maintained by trigger; soft-deleted rows excluded by default via repository filters / views.

**Data-model fixes carried from the assessment:** `project.client_id` becomes a real FK to `clients` (not a string); task status/priority reference a config/lookup table (no drifting hardcoded enums); expense legacy fields consolidated. An **ER model** will accompany the Phase-2 migration (extends [report 05](05-database.md)).

---

## 7. Supabase Strategy

Supabase is the **production database + storage-metadata + (future) auth/realtime/edge**. Kept modular behind interfaces so nothing above the Repository layer knows it's Supabase.

- **Database:** Postgres schema per §6; migrations in `/supabase/migrations` (versioned, reviewable); seed scripts for reference data.
- **Row-Level Security (RLS):** policies enforce tenant/role/ownership scoping at the DB as defense-in-depth (complementing app-layer RBAC). Managers see their team; employees see their own rows; admins broad.
- **Storage metadata:** Supabase holds file **metadata** (id, Drive file id, url, owner, permissions, upload date, entity ref) — **never binaries** (§9).
- **Auth (future):** custom JWT now; when adopting Supabase Auth, only the `IAuthService`/`IAuthRepository` implementations change. Plan for mapping existing users + `auth.users`.
- **Realtime/Edge (future):** realtime channels can later back live tables/notifications; edge functions can host scheduled syncs/webhooks. Architecture leaves seams (event bus, job scheduler) so these drop in without redesign.
- **Access:** the api server uses the service-role key server-side only; the web app never talks to Supabase directly (all through the api), preserving the layer boundary.

---

## 8. Google Integration Strategy

All Google access sits in the **Integration layer** behind interfaces (`IDriveService`, `IGmailService`, `ISheetsService`), each with retry/backoff and per-provider config. Reuses the existing working Drive/Gmail/Calendar plumbing (reports 12).

### 8.1 Google Forms → Sheets → App → Supabase → Power BI (no manual sync)
```
Google Form  →  Google Sheet  →  Sync Service (scheduled + manual)
             →  validation + duplicate prevention  →  Supabase (upsert)
             →  domain events  →  Analytics/Power BI dataset refresh
```
- **Existing Google Forms remain.** A **SheetsSyncService** reads the linked sheet, validates rows against zod schemas, prevents duplicates (natural-key + hash), and **upserts** into Supabase.
- **Sync triggers:** scheduled (cron/edge) + manual ("Sync now") + optional Apps Script/webhook push.
- **Bidirectional where needed:** import (Sheet→app) and export (app→Sheet) both supported; validation on both directions.

### 8.2 Power BI
`PowerBIService` exposes the cleaned Supabase model to Power BI (dataset/dataflow) with scheduled/incremental refresh (see [report 13](13-powerbi-readiness.md)). In-app **consulting reports** (design system §18) are separate from Power BI embeds — both supported, distinct surfaces.

---

## 9. File Storage Strategy

**Binaries live in Google Drive; Supabase stores metadata only. Never store files in the database.**

- **Metadata table** `files`: `id, entity_type, entity_id, drive_file_id, url, name, mime, size, owner_id, permissions, uploaded_at, folder_path` + audit/soft-delete.
- **Upload flow:** client → api (`StorageService`) → Drive upload (via `DriveService`) → persist metadata in Supabase → return reference. The DB holds only the reference.
- **Automated Drive folder tree** (created on demand, idempotent):
```
KVJ Analytics/
├─ Employees/   ├─ Students/   ├─ Projects/
├─ Trainings/   ├─ Expense Receipts/   ├─ Reports/
├─ Marketing/   └─ Temporary Uploads/
```
`DriveService.ensureFolder(path)` creates missing folders automatically; per-entity subfolders (e.g. `Students/<studentId>`) created lazily. Temporary uploads swept by a job.

---

## 10. Report Engine Architecture

**Centralized. Modules request reports from `ReportService` — no module renders reports itself.**

```ts
interface IReportService {
  generate(req: ReportRequest): Promise<ReportResult>; // {format, template, data, branding}
}
type ReportFormat = 'pdf' | 'excel' | 'csv' | 'preview' | 'email' | 'print';
```
- **Inputs:** a template id (from Template Engine §12-adjacent), a data payload (assembled by the requesting module's service), a branding profile (§16), and a target format.
- **Pipeline:** `resolve template → bind data → render (consulting-grade layout, design system §18) → output` (PDF via a headless renderer, Excel/CSV via an export lib, preview as HTML, email via CommunicationService, print CSS).
- **Consistency:** all reports share the KVJ report theme; charts use the shared chart palette; output is presentation-ready, never a raw Power BI export.
- Replaces today's hand-rolled per-controller CSV strings (report 06 correction) with one engine.

---

## 11. Certificate Engine Architecture

**Certificates are generated dynamically and NOT permanently stored.**

- **Persisted (Supabase) only:** `certificate_number`, `student_id`, `training_id`, `verification_token`, `template_version`, `generated_at` (+ audit). No PDF binary is kept.
- **Generation:** `CertificateService.render(certId)` re-generates the PDF on demand from the stored fields + the versioned template — reproducible because `template_version` is pinned.
- **Verification:** a public verify endpoint resolves `verification_token` → validity + metadata (no file needed).
- **Audit:** every generation logged (§15).
- Built on the Template Engine + Report Engine renderer for a consistent branded output.

## 11a. Template Engine

Reusable, **configurable-without-code** templates for **email, reports, certificates, announcements, notifications, training messages**.
- Templates stored as data (Supabase) with `type`, `version`, `body` (handlebars-style tokens), `variables`, `branding_ref`.
- `TemplateService.render(templateId, data)` → resolved content; versioned so historical outputs are reproducible.
- Consumed by Report, Certificate, Notification, and Communication services.

---

## 12. Workflow Engine Architecture

Architecture prepared for **configurable approval workflows** (expense, leave, training lifecycle, project lifecycle, certificate, payroll) — **mechanism now, specific rules later (KVJ-defined, not invented).**

- **Model:** `workflow_definition` (steps, roles/approvers, conditions, escalation) + `workflow_instance` (current step, history) + `workflow_task` (an approval awaiting an actor).
- **Engine:** `WorkflowService.start(definitionKey, context)`, `.act(instanceId, decision, actor)` advances steps, emits events (`ExpenseApproved`, etc.), and creates notifications/audit entries.
- **Configurable:** definitions are data-driven (no code change to add/alter an approval chain).
- **Integration:** modules **start** workflows and **react** to workflow events rather than hardcoding approval logic — replacing today's hardcoded chains (task transfer, expense approval).

> Specific approval steps, thresholds, and approver roles are **business rules to be confirmed by KVJ** before configuring definitions.

---

## 13. Notification Architecture

**Central `NotificationService`; every module publishes events, the engine decides delivery.**

```
Module service → emits domain event → Notification engine →
   resolves recipients + preferences + template →
   delivers via channels: [in-app, realtime(socket), email] (+ future: push, SMS, WhatsApp, Teams, Slack)
```
- **Channels** behind a common `INotificationChannel` interface; add a channel without touching modules.
- **Preferences** per user/category; **grouping**, **priority**, **unread counts**, **actionable notifications** (design system §17).
- **Realtime:** reuse existing Socket.IO layer now; Supabase Realtime is a future channel.
- Sits under the broader **CommunicationService** (email, chat, announcements, marketing) so all outbound messaging is unified and future channels (SMS/WhatsApp/Teams/Slack) are additive.

---

## 14. Event Architecture

**Event-driven where practical**, to decouple modules.

- **Bus:** an in-process event bus (v1) with a clear interface, upgradeable to a durable broker / Supabase Realtime / queue later without changing publishers.
- **Pattern:** services **publish** domain events after state changes; **handlers** (in other modules/engines) subscribe. Example cascade:
```
TrainingAssigned → [Attendance seeds sessions] + [Calendar entry] +
                   [Student tracker updated] + [Notification sent] +
                   [Analytics/PowerBI marked dirty]
```
- **Contracts:** each event has a typed name + payload in the publishing module's `events.ts`; handlers are registered centrally in `api/events`.
- **Guarantees:** v1 best-effort in-process; design leaves room for outbox pattern + retries when durability is required (§19).
- This realizes the vision's "enter once, everything updates" principle **without tight coupling**.

---

## 15. Audit Architecture

**Every important action logged**, centrally, via `AuditService`.

- **`audit_log` table:** `id, actor_id, action, entity_type, entity_id, old_value(jsonb), new_value(jsonb), reason?, ip?, at`.
- **What's audited:** attendance changes, expense/leave/task approvals, project updates, student assessment changes, voucher assignment, certificate generation, role/permission changes, config changes.
- **How:** services call `AuditService.record(...)` (or repositories emit change diffs) so auditing isn't per-controller boilerplate. The existing attendance `correctionLog` pattern (report 05) is generalized here.
- **Immutable & queryable:** append-only; surfaced in admin/CEO workspaces and reports; retained per policy.

---

## 16. Configuration Management

**No hardcoding.** A central config, layered: **env (secrets)** → **DB settings (runtime, editable)** → **defaults (code)**.

- **Settings (Supabase, editable):** company details, branding (logo/colors/fonts — design system §19), email templates, theme defaults, report settings, notification rules, application settings, feature flags/module toggles (generalizing today's `Settings` singleton, report 05).
- **Secrets (env):** DB/Supabase keys, Google credentials, JWT secret — via a secrets manager, never in the tree (fixes report 09 finding).
- **Access:** a typed `ConfigService` exposes config to services; the web app fetches a safe public subset (branding/theme) at boot. Changing branding/templates requires **no code change**.

---

## 17. Security Architecture

Consolidates the fixes from [report 09](09-security.md) into the foundation:

- **AuthN:** custom JWT now (httpOnly cookie, short-lived access + refresh rotation, server-side revocation); Supabase Auth swap-in later behind `IAuthService`. **Remove** `localStorage`/query-string tokens and hardcoded seed admin.
- **AuthZ:** **role-based + permission-based**. A `permissions` matrix (role → permission) checked by a shared `PermissionService`/middleware on the api, mirrored by a web `permissions` module (route guards + UI gating). RLS in Supabase as defense-in-depth (§7).
- **Validation:** zod schemas shared web+api; validate at the api edge; guard against NoSQL/SQL-operator injection (parameterized Supabase queries).
- **Output:** consistent error envelope, no stack traces, no PII leakage.
- **Transport/headers:** Helmet, HSTS/CSP, strict CORS allow-list, rate limiting on auth + sensitive endpoints.
- **Secrets & encryption:** secrets manager; encrypt sensitive fields where required; rotate the currently-exposed credentials immediately.
- **Audit:** §15 covers who/when/what.

---

## 18. Performance Strategy

- **Frontend:** route-level **code-splitting/lazy loading**; **virtualized tables**; **skeletons**; **optimistic updates**; server-state **caching/dedupe** (query layer); memoized selectors; split marketing vs app bundles.
- **Backend:** **pagination + filtering** standardized in `QuerySpec`; DB **indexes** on hot fields; **aggregation in Postgres** (not JS) for dashboards; response caching for hot reads; projection (select only needed columns).
- **Sync/jobs:** **background synchronization** (Sheets/PowerBI) off the request path; distributed scheduler.
- **Realtime (future):** Supabase Realtime / sockets for live tables.
- Targets the design system's "desktop-app feel" bar.

---

## 19. Scalability Strategy

- **Stateless api** (JWT) → horizontal scale behind a load balancer.
- **Distributed job scheduler** (BullMQ/Agenda/edge) with locks — fixes the in-process double-fire risk (report 12).
- **Event bus upgrade path:** in-process → durable broker / outbox + queue when volume/durability demands, without changing publishers.
- **Modular boundaries** allow extracting a module into its own service later if needed (the interfaces already isolate it).
- **DB:** Supabase/Postgres read replicas + connection pooling; analytics offloaded to a dataset/warehouse for Power BI so operational load stays clean.
- **Multi-channel comms & integrations** are additive (new `INotificationChannel`/`IIntegration` impls) — no redesign for WhatsApp/SMS/Teams/Slack/payments/LMS.
- **5–10 year durability:** achieved by (a) interface-based layers, (b) data-driven config/workflows/templates, (c) event decoupling, (d) datastore behind repositories.

---

## 20. Migration Strategy

Phased, **non-destructive**, preserving working logic (reports 04/11).

**Phase 0 — Foundation (no features):**
- Stand up folder/module skeleton, DI registry, API client, error handler, config, permissions, event bus, engine interfaces.
- Fix P0 security (secrets rotation, route guards, token storage). Add test harness + CI.

**Phase 1 — Mock-backed build:**
- Implement **mock services + mock repositories + dummy data** behind the interfaces.
- Build the **design system + workspaces + module UIs** against mocks (design system doc 17).
- Port existing business logic into **Services** (behavior-for-behavior), validated by tests — still mock-backed.

**Phase 2 — Supabase cutover (per module):**
- Author Supabase schema + migrations (§6) with UUID/audit/soft-delete/RLS.
- Implement **Supabase repositories + Google integration adapters**; register them in place of mocks. **UI and business logic unchanged.**
- **Data migration MongoDB → Supabase:** per-module ETL mapping documents→relational, generating UUIDs, resolving references to FKs, fixing the model issues (client FK, label domains, expense fields), with dual-run verification and rollback. *Whether existing live data is migrated or the platform starts fresh is a KVJ decision (assessment §12/R- items).*
- Wire **Sheets/Forms sync** and **Power BI** dataset.

**Phase 3 — New modules & engines:**
- Payroll, Students, Marketing, Certificate/Report/Workflow engines activated — each new module only after its **business rules are confirmed by KVJ** (never invented).

**Cutover safety:** feature-flag per module; one module at a time; keep the old app runnable until parity is verified.

---

### Sign-off

This specification defines the complete technical foundation for all 20 requested areas. **No business modules, database tables, or APIs have been implemented, and no code changed.** On approval — and confirmation of the two open choices (**TypeScript**, **monorepo layout**) — every future module will be built to these contracts. Business rules for workflows, payroll, certificates, students, and marketing remain to be provided by KVJ and will not be invented.
