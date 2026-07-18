# 11 — Technical Debt Report

Inventory of accumulated debt, with type and severity. Severity reflects impact on the planned Operations Management System upgrade.

## High severity

| Item | Detail |
|------|--------|
| **Mega page components** | `Projects` (1,488), `Expenses` (1,344), `Chat` (1,107), `AdminUsers` (866) hold business logic, data fetching, and UI inline. Every new feature enlarges them further. |
| **No shared API/data layer (frontend)** | axios + manual `Bearer` header + `API_BASE_URL` repeated across every page. No interceptor, no central error handling, no retry/cancel. |
| **No test suite** | Zero automated tests. Only ad-hoc `scratch/test_*.js` and root `test-*.js` connectivity probes. The upgrade has no regression safety net. |
| **Secrets in tree** | `server/.env`, `config/service-account.json`, `services/service-account.json.json` physically present (see [09](09-security.md)). |
| **No frontend route guards** | Security debt that is also structural — the app assumes but never enforces auth at the routing layer. |

## Medium severity

| Item | Detail |
|------|--------|
| **Model inconsistency: Client** | A full `Client` collection exists, yet `Project.client` is a free-text **string**. Client data is effectively duplicated/unlinked; reporting on "revenue by client" is unreliable. |
| **Configurable-vs-hardcoded labels** | `Settings.taskStatuses`/`taskPriorities` are configurable, but `Task.priority` still has a **hardcoded enum** (`Critical/High/Medium/Low`) and status defaults are hardcoded. Config and schema can drift out of sync. |
| **Legacy expense fields** | `Expense` keeps legacy fields (`title`, generic `category`, `currency`, `receiptUrl`, `dateIncurred`) alongside new structured fields "for backward compatibility" — dual code paths and ambiguous source-of-truth. |
| **Unrouted pages** | `AdminAttendance.jsx` (690 LOC) and `Timesheets.jsx` (559 LOC) are not in `App.jsx` routes — either dead code or reachable only by accident. |
| **Disabled integration left inline** | Cloudinary config is commented out and stubbed to return `{ secure_url: null }`; multer falls back to memory storage. Dead configuration and a half-present integration. |
| **No central error handler** | Each controller try/catches and returns `error.message`; inconsistent shapes and information disclosure on 500s. |
| **Duplicated helpers** | today-start/holiday/half-day date logic and CSV/XLSX export code repeated across controllers instead of shared utils. |
| **Alias routing** | `/api/timesheets` and `/api/worklogs` map to the same controller; timer endpoints layered onto `/api/tasks` in a separate router file mounted twice. Works, but non-obvious. |

## Low severity

| Item | Detail |
|------|--------|
| **Loose maintenance scripts** | `seed*.js`, `migrate*.js`, root `*.cjs`, `scratch/` accumulate without npm-script wrapping or a documented runbook. |
| **`TrainerLog` lacks `timestamps`** | Uses a manual `createdAt` while every other model uses Mongoose `timestamps`. Minor inconsistency. |
| **Duplicate service-account file** | `services/service-account.json.json` is a misnamed/duplicate credential file. |
| **`graphify-out/` artefacts committed** | Generated analysis output lives in the repo. |
| **Mixed FR/US comment tags** | Requirement tags (`FR-08.10`, `US-A21`) sprinkled in code — useful traceability but no central mapping doc. |
| **No linter enforcement in CI** | ESLint config exists but there is no evidence of CI running it. |

## Debt hotspots (where to be careful during the upgrade)

1. **`taskController.js` (725 LOC)** — the most complex file; transfers, approvals, timers, recurrence and overdue logic interlock. Change with tests.
2. **`Projects.jsx` / `Expenses.jsx` / `Chat.jsx`** — touching any of these risks wide regressions.
3. **Expense + Drive coupling** — the create-expense path spans controller, multer, and `driveService`; the disabled Cloudinary branch adds confusion.
4. **Leave/attendance date logic** — timezone handling uses `setUTCHours` in several places; half-day and holiday interactions are subtle.

## Overall debt posture

The debt is **typical of a fast-moving internal tool**, not pathological. The backend is comparatively clean; most debt is concentrated in (a) frontend component size / lack of shared UI and API layers, (b) absence of tests, and (c) a handful of data-model inconsistencies (Client, expense legacy fields, hardcoded enums). None of these block the upgrade, but addressing (a)–(c) early will materially reduce the cost of everything that follows.
