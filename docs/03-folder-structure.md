# 03 — Folder Structure Documentation

## Repository root

```
flow-desk-main/
├─ index.html               SPA entry HTML (Vite)
├─ package.json             Frontend package (name: psa-web)
├─ vite.config.js           Vite + React + Tailwind plugin config
├─ vercel.json              Vercel deployment/rewrite config
├─ eslint.config.js         ESLint flat config
├─ logo.png                 App logo asset
├─ README.md                Original project readme
├─ public/                  Static assets served as-is (favicon.svg, icons.svg)
├─ src/                     FRONTEND application (React SPA)
├─ server/                  BACKEND application (Express API)
├─ graphify-out/            Generated code-graph analysis output (tooling artefact)
├─ fix-encoding.cjs         One-off maintenance script
├─ fix-expenses.cjs         One-off data-fix script
├─ refactor-urls.cjs        One-off codemod script
├─ test-drive.js            Ad-hoc Google Drive connectivity test
└─ test-gmail.js            Ad-hoc Gmail connectivity test
```

The presence of several root-level `*.cjs` maintenance scripts and `test-*.js` connectivity probes indicates manual, script-driven operations rather than an automated pipeline. `graphify-out/` is an artefact of a static-analysis/graphing tool (contains `graph.json`, `graph.html`, `GRAPH_REPORT.md`, Python scripts) and is not part of the running app.

## Frontend — `src/`

```
src/
├─ main.jsx                 React root render
├─ App.jsx                  Router + route table (SocketProvider wrapper)
├─ config.js                API_BASE_URL resolution (dev vs prod)
├─ index.css                Tailwind import + @theme design tokens
├─ App.css                  Additional app styles
├─ assets/                  hero.png, react.svg, vite.svg
├─ context/
│   └─ SocketContext.jsx    Global Socket.IO provider + global socket events
├─ hooks/
│   └─ useFadeIn.jsx        Scroll/intersection fade-in animation hook
├─ components/              Shared + marketing components
│   ├─ DashboardLayout.jsx  Authenticated shell: sidebar, toasts, heartbeat
│   ├─ Navbar.jsx           Marketing site nav
│   ├─ Hero.jsx             Landing hero
│   ├─ Features.jsx         Landing features grid
│   ├─ HowItWorks.jsx       Landing section
│   ├─ SocialProof.jsx      Landing section
│   ├─ ChatHighlight.jsx    Landing feature highlight
│   ├─ TeamStatusPanel.jsx  Live team presence widget
│   ├─ Testimonials.jsx     Landing testimonials
│   ├─ Pricing.jsx          Landing pricing
│   ├─ CtaBanner.jsx        Landing CTA
│   └─ Footer.jsx           Landing footer
└─ pages/                   Route-level screens (see report 07)
    ├─ Home.jsx             Marketing landing (composes components/)
    ├─ Login.jsx            Auth: login
    ├─ Signup.jsx           Auth: register
    ├─ Dashboard.jsx        Employee/Manager home
    ├─ AdminDashboard.jsx   Admin KPIs & pending queues
    ├─ AdminUsers.jsx       User administration (approve/roles/export)
    ├─ ManageBatches.jsx    Colleges / courses / training batches
    ├─ Teams.jsx            Team CRUD & membership
    ├─ Projects.jsx         Projects + task board (largest page, 1,488 LOC)
    ├─ ProjectManagement.jsx Project portfolio management view
    ├─ Attendance.jsx       Personal clock-in/out (thin wrapper, 24 LOC)
    ├─ AdminAttendance.jsx  Admin attendance oversight & correction
    ├─ Leaves.jsx           Leave requests, balances, calendar
    ├─ Timesheets.jsx       Worklog entry & review
    ├─ Expenses.jsx         Expense claims & approval (1,344 LOC)
    ├─ Chat.jsx             Channels, DMs, threads (1,107 LOC)
    └─ TrainerLog.jsx       Trainer activity logging
```

Note the split between **marketing components** (Navbar, Hero, Pricing, Testimonials…) used only by the public `Home` page, and **application components** (`DashboardLayout`, `TeamStatusPanel`) used inside the authenticated app. Both live flat in `components/` without a subfolder distinction.

Also note two attendance pages: `Attendance.jsx` (personal, 24 LOC) and `AdminAttendance.jsx` (admin, 690 LOC). `AdminAttendance` and `Timesheets` exist as files but are **not registered in `App.jsx`'s route table** — see report 07 for the implication.

## Backend — `server/`

```
server/
├─ server.js               App bootstrap: middleware, route mounting, Socket.IO, cron requires
├─ package.json            Backend package (name: flowdesk-server)
├─ .env                    Secrets (present in working tree — see report 09)
├─ .gitignore             Ignores .env / env
├─ seedAdmin.js            Seeds a default admin account (hardcoded creds)
├─ seedData.js            Seeds baseline reference data
├─ seedDummyData.js        Seeds demo/dummy data
├─ migrateBatches.js       One-off migration
├─ config/
│   ├─ db.js               Mongoose connection
│   ├─ cloudinary.js       Multer + (disabled) Cloudinary storage
│   └─ service-account.json Google service-account credentials (secret)
├─ middleware/
│   ├─ authMiddleware.js   protect (JWT) + authorize(...roles) RBAC
│   └─ isTrainerMiddleware.js  isTrainer gate
├─ models/                 25 Mongoose schemas (see report 05)
├─ controllers/            21 controllers (business logic + data access)
├─ routes/                 22 Express routers (see report 06)
├─ services/
│   ├─ driveService.js     Google Drive uploads (service account)
│   ├─ calendarService.js  Google Calendar OAuth client
│   └─ service-account.json.json  (duplicate/misnamed credential file)
├─ utils/
│   ├─ mailer.js           Gmail-API transactional email (HTML templates)
│   └─ taskStartAccess.js  Guard: must be clocked-in to start a task
├─ cron/                   6 scheduled jobs (see report 12)
│   ├─ autoClockOut.js
│   ├─ recurringTasks.js
│   ├─ overdueTaskFlagging.js
│   ├─ deleteOldArchivedTasks.js
│   ├─ leaveBalanceReset.js
│   └─ overdueReports.js
├─ scripts/
│   └─ migrateLeaveBalances.js  One-off data migration
└─ scratch/
    ├─ test_login.js       Ad-hoc auth test
    └─ test_bcrypt.js      Ad-hoc hashing test
```

## Observations on structure

- The backend layering (`routes / controllers / models / services / utils / middleware / cron`) is **clean and conventional** — easy to navigate, each concern in its own directory.
- **Loose maintenance scripts** (`seed*.js`, `migrate*.js`, root `*.cjs`, `scratch/`, `test-*.js`) accumulate at the root and in `server/` without a formal `scripts/` convention or npm-script wrapping. These are operational debt (see report 11).
- Two credential files (`config/service-account.json`, `services/service-account.json.json`) and a populated `.env` sit inside the tree — a secrets-hygiene concern (see report 09).
- The frontend has **no `services/` or `api/` layer**; every page imports axios and `API_BASE_URL` directly. There is no `utils/` on the frontend beyond a single hook.
