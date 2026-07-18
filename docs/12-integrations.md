# 12 — Integration Report

## External integrations

### Google Drive (active — primary file store)
- **Where:** `services/driveService.js`, used by the expense and leave (medical certificate) flows.
- **Auth:** OAuth2 client seeded with a **refresh token** from env (`GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI/REFRESH_TOKEN`); a **service-account.json** is also present. Uploads target `DRIVE_ROOT_FOLDER_ID`.
- **Behaviour:** files are uploaded with a structured filename (`{user}-{amount}-{expenseType}-{date}.ext`); only the Drive file id + view link are persisted in MongoDB. Drive is the de-facto storage because Cloudinary is disabled.

### Gmail API (active — transactional email)
- **Where:** `utils/mailer.js`.
- **Auth:** Google API (Gmail) via the same Google OAuth credentials; `MAIL_FROM` is the sender. If `MAIL_FROM` is unset the mailer no-ops with a warning.
- **Behaviour:** sends HTML emails (with `escapeHtml` on user values) — notably the **account approval** email. Replaces classic SMTP/nodemailer transport with the Gmail API.

### Google Calendar (active — per-user OAuth)
- **Where:** `controllers/calendarController.js`, `services/calendarService.js`, `routes/calendarRoutes.js`.
- **Auth:** per-user OAuth; tokens stored on `User.googleCalendar` (`accessToken`, `refreshToken`, `expiryDate`, `connected`).
- **Behaviour:** endpoints to get the auth URL, connect (exchange code), disconnect, and check status. `calendarService` currently contains placeholder client-id fallbacks (`YOUR_PLACEHOLDER_...`) — verify real credentials are wired before relying on it.

### Cloudinary (present but DISABLED)
- **Where:** `config/cloudinary.js`.
- **Status:** the Cloudinary `config(...)`, `CloudinaryStorage`, and upload-stream code are **commented out**; storage falls back to `multer.memoryStorage()` and the upload helper returns `{ secure_url: null }`. Dependencies (`cloudinary`, `multer-storage-cloudinary`) are still installed. This is a dormant integration.

### Power BI (NOT integrated)
- No Power BI connector, dataset export, or embed exists. The only reporting is in-app dashboards and CSV/XLSX downloads. See [13 — Power BI Readiness](13-powerbi-readiness.md).

### Supabase (NOT used)
- Despite being mentioned in the analysis brief, there is **no Supabase** anywhere. Persistence is MongoDB via Mongoose. (Noting this explicitly to correct the assumption.)

## Real-time (Socket.IO)
- **Server:** `server.js` initialises a Socket.IO server sharing the HTTP server and CORS allow-list; exposed via `app.set('io', io)` and `global._io`.
- **Rooms:** `user_<id>` (personal), `team_<id>`, `project_<id>`, and channel rooms.
- **Events emitted:** `newMessage`, `poolTaskClaimed`, `forceLogout`, `userUpdated`, task/project progress updates, mention/thread notifications.
- **Client:** single connection in `SocketContext`; `DashboardLayout` renders toasts. A separate 60s REST heartbeat maintains `lastActiveAt`.

## Scheduled jobs (node-cron) — six jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `autoClockOut` | `59 23 * * *` (23:59 daily) | Close dangling attendance sessions, label `Auto-closed`, compute hours |
| `overdueTaskFlagging` | `1 0 * * *` (00:01 daily) | Flag non-Done past-due tasks `isOverdue` |
| `recurringTasks` | `5 0 * * *` (00:05 daily) | Generate next instances of daily/weekly/monthly tasks |
| `overdueReports` | `0 0 * * *` (00:00 daily) | Mark overdue medical certificates; DM employee + post to General channel |
| `deleteOldArchivedTasks` | `0 2 * * *` (02:00 daily) | Delete archived tasks completed >1 year ago |
| `leaveBalanceReset` | `5 0 1 1 *` (Jan 1, 00:05) | Seed fresh annual leave balances for all active users |

All are `require`d for their side effects at the top of `server.js`. They run **in-process** on the single Node instance — if the app is horizontally scaled, jobs would double-fire without a distributed lock (a scaling consideration for the upgrade).

## Webhooks / third-party callbacks
- **Inbound webhooks:** none (no Stripe/GitHub/Slack-style webhook receivers).
- **OAuth callback:** the Google Calendar redirect URI (`/api/calendar/oauth2callback` referenced in `calendarService`) is the only external callback surface.

## Environment variables consumed

`PORT`, `MONGO_URI`, `JWT_SECRET`, `APP_URL`, `NODE_ENV`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_REDIRECT_URI`, `MAIL_FROM`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `DRIVE_ROOT_FOLDER_ID`, plus frontend `VITE_MODE` / `VITE_API_URL`. (Cloudinary vars referenced only in commented code.)

## Integration risks for the upgrade

- **Single Google project underpins Drive + Gmail + Calendar** — a token/quota issue cascades across file storage, email and calendar. Consider separating concerns and monitoring quotas.
- **In-process cron** does not survive horizontal scaling cleanly; migrating to a job runner (BullMQ/Agenda) with locking is advisable if scaling.
- **Disabled Cloudinary** leaves an ambiguous storage story — decide Drive-only vs re-enable Cloudinary and remove the dead branch.
- **No retry/backoff** around Drive/Gmail calls observed — external failures may surface as request errors without graceful degradation.
