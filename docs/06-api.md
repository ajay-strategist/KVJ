# 06 — API Documentation

## Conventions

- **Base URL:** `http://localhost:5000` (dev) or the Render URL in production (`src/config.js`). All routes are prefixed `/api`.
- **Auth:** unless marked *Public*, every route runs the `protect` middleware, which accepts a JWT from (in order) the `token` **cookie**, an `Authorization: Bearer <token>` header, or a `?token=` **query param**. Role-restricted routes add `authorize(...roles)`.
- **Content type:** `application/json`, except file uploads which use `multipart/form-data` (multer).
- **Roles:** `Admin`, `Manager`, `Employee` (+ `isTrainer` capability). "Auth" below = any authenticated user.

---

## Auth — `/api/auth`

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/register` | Public | fullName, email, password | 201 `{message, userId}` (status Pending) |
| POST | `/login` | Public | email, password | `{_id, fullName, email, role, status, isTrainer, token}` + sets httpOnly cookie |
| POST | `/logout` | Auth | — | 200 `{message}`; clears cookie |

## Users — `/api/users`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Admin, Manager | List users (Manager scoped to own team) |
| GET | `/export` | Admin | CSV/XLSX export of users |
| PUT | `/:id` | Admin | Update user (role/team/grade/salary/status) |
| DELETE | `/:id` | Admin | Delete user |
| PUT | `/:id/approve` | Admin | Approve pending user (email + seed leave balances) |
| PUT | `/:id/reject` | Admin | Reject pending user |
| PUT | `/:id/status` | Admin | Change status (Active/Deactivated → force-logout) |
| GET | `/:id/profile` | Admin, Manager | Member profile dashboard |
| GET | `/:id/performance-report` | Admin | Detailed JSON report (date range) |
| GET | `/:id/performance-csv` | Admin | Detailed XLSX export |

## Admin — trainer & worklog

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| PATCH | `/api/admin/users/:id/trainer` | Admin | Toggle `isTrainer` |
| GET | `/api/admin/worklog?userId=&from=&to=` | Admin | Aggregated worklog view |

## Teams — `/api/teams`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Auth | List teams |
| GET | `/:id/members` | Auth | Team members |
| POST | `/` | Admin | Create team |
| PUT | `/:id` | Admin | Update team |
| DELETE | `/:id` | Admin | Delete team |

## Projects — `/api/projects`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/export` | Admin | Export projects |
| GET | `/` | Auth | List projects |
| POST | `/` | Admin | Create project |
| PUT | `/:id` | Admin, Manager | Update project |
| DELETE | `/:id` | Admin | Delete project |
| GET | `/:id/members` | Auth | Project members |
| GET | `/:id/tasks` | Auth | Project tasks |

## Tasks — `/api/tasks` (+ timer endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/export` | Admin | Export tasks |
| GET | `/archived` | Auth | Archived tasks |
| GET | `/transfers/pending` | Auth | My pending transfers |
| GET | `/transfers/admin/pending` | Admin | Transfers awaiting admin |
| PATCH | `/:id/transfer/admin/approve` | Admin | Approve transfer |
| PATCH | `/:id/transfer/admin/reject` | Admin | Reject transfer |
| GET | `/manager-pending` | Admin | Manager assignments awaiting approval |
| PATCH | `/:id/manager-approve` | Admin | Approve manager assignment |
| PATCH | `/:id/manager-reject` | Admin | Reject manager assignment |
| GET | `/` | Auth | List tasks (role-filtered, overdue-flagged) |
| POST | `/` | Auth | Create task |
| PUT | `/:id/claim` | Auth | Claim a pool task |
| POST | `/:id/log-time` | Auth | Log time on task |
| GET | `/:id/comments` | Auth | List comments |
| POST | `/:id/comments` | Auth | Add comment |
| POST | `/:id/transfer` | Auth | Initiate transfer |
| PATCH | `/:id/transfer/accept` | Auth | Accept transfer |
| PATCH | `/:id/transfer/reject` | Auth | Reject transfer |
| PUT | `/:id` | Auth | Update task |
| DELETE | `/:id` | Admin, Manager | Delete task |
| GET | `/:id/timer` | Auth | Timer state |
| PUT | `/:id/timer/start` | Auth | Start timer (must be clocked-in) |
| PUT | `/:id/timer/pause` | Auth | Pause timer |
| PUT | `/:id/timer/end` | Auth | End timer |

## Attendance — `/api/attendance`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/clock-in` | Auth | Clock in (optional geolocation) |
| PUT | `/clock-out` | Auth | Clock out |
| PUT | `/break-in` | Auth | Start break |
| PUT | `/break-out` | Auth | End break |
| POST | `/heartbeat` | Auth | Presence heartbeat |
| GET | `/me` | Auth | My attendance |
| GET | `/team-status` | Admin, Manager | Live team presence |
| GET | `/` | Admin, Manager | All attendance |
| PUT | `/:id` | Admin | Correct attendance (audit-logged) |

## Timesheets / Worklogs — `/api/timesheets` and `/api/worklogs`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/export` | Admin | Export timesheets |
| POST | `/` | Auth | Create worklog (auto-approved) |
| GET | `/me` | Auth | My worklogs |
| GET | `/` | Admin, Manager | Team worklogs |
| PUT | `/:id` | Auth (owner) | Update |
| DELETE | `/:id` | Auth (owner) | Delete |

## Leaves — `/api/leaves`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/holidays` | Auth | List public holidays |
| POST | `/holidays` | Admin | Create holiday |
| DELETE | `/holidays/:id` | Admin | Delete holiday |
| GET | `/calendar` | Auth | Leave calendar |
| GET | `/export/leaves` | Admin | Export leaves |
| GET | `/export/attendance` | Admin | Export attendance |
| POST | `/` | Auth | Create leave request |
| GET | `/me` | Auth | My leaves |
| GET | `/` | Admin, Manager | All leaves |
| PUT | `/:id/status` | Admin, Manager | Approve/reject |
| DELETE | `/:id` | Auth | Delete request |
| POST | `/:id/report` | Auth | Upload medical certificate |

## Expenses — `/api/expenses` (+ `/api/expense-types`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/export` | Admin | Export expenses |
| POST | `/upload-bill` | Auth | Upload bill image (returns URL) |
| GET | `/` | Auth | List expenses |
| POST | `/` | Auth | Create expense (multipart bill) |
| POST | `/bulk-approve` | Admin | Bulk approve |
| POST | `/bulk-pay` | Admin | Bulk mark paid |
| POST | `/:id/bill` | Auth (owner/Admin) | Attach bill |
| PUT | `/:id/status` | Admin | Update status |
| DELETE | `/:id` | Auth | Delete |
| GET | `/api/expense-types` | Auth | List expense types |
| POST | `/api/expense-types` | Auth | Create expense type |

## Chat — `/api/chat`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/channels` | Auth | My channels |
| POST | `/channels` | Admin, Manager | Create channel |
| POST | `/channels/:channelId/members` | Admin, Manager | Add member |
| DELETE | `/channels/:channelId/members/:userId` | Admin, Manager | Remove member |
| GET | `/dm` | Auth | My DMs |
| POST | `/dm` | Auth | Get-or-create DM |
| GET | `/users` | Auth | All users (for DM picker) |
| GET | `/mentions` | Auth | Unread mention counts |
| GET | `/channels/:channelId/messages` | Auth | Channel messages |
| POST | `/channels/:channelId/messages` | Auth | Send message (multipart file) |
| GET | `/messages/:messageId/thread` | Auth | Thread replies |

## Clients — `/api/clients`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Auth | List clients |
| POST | `/` | Admin | Create client |
| PUT | `/:id` | Admin | Update client |
| DELETE | `/:id` | Admin | Delete client |

## Settings — `/api/settings`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Auth | Read settings (labels/modules) |
| PUT | `/` | Admin | Update settings |

## Calendar — `/api/calendar`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/auth-url` | Auth | Google OAuth URL |
| POST | `/connect` | Auth | Exchange code / store tokens |
| POST | `/disconnect` | Auth | Disconnect |
| GET | `/status` | Auth | Connection status |

## Dashboard — `/api/dashboard`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/admin` | Admin | Admin KPI stats + pending queues |

## Trainer log — `/api/trainer-log`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/export` | Admin | Export trainer logs |
| POST | `/` | isTrainer | Create log |
| GET | `/my` | isTrainer | My logs |
| GET | `/all` | Admin | All logs |

## Training batches — `/api/training-batches`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/colleges` | Auth | List / create colleges |
| GET/POST | `/courses` | Auth | List / create courses |
| GET | `/` | Auth | List batches |
| POST | `/` | Auth | Create batch |
| PUT | `/:id` | Auth | Update batch |
| DELETE | `/:id` | Admin | Delete batch |

## Root / health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Liveness string: "FlowDesk API is running..." |

## Cross-cutting notes

- **Request/response shapes** are not documented in code (no OpenAPI/Swagger, no JSDoc contracts beyond a few comments). Field names above are derived from the Mongoose schemas and controller code.
- **Error format** is consistent-ish: `{ message, error? }` with HTTP 400/401/403/500. There is no central error-handling middleware; each controller try/catches and responds.
- **Export endpoints** must be registered before `/:id` routes (the code comments note this ordering dependency).
- **Dependencies:** routes depend on `authMiddleware` (all), `cloudinary` multer config (chat/expenses uploads), `driveService`/`mailer`/`calendarService` (expenses, approvals, calendar), and Socket.IO (`req.app.get('io')` / `global._io`) for real-time side effects.
