# 02 — System Architecture Report

## Application type

A **client–server single-page web application** following a classic **MERN** (MongoDB, Express, React, Node) three-tier architecture, with an added **real-time layer** (Socket.IO) and a **scheduled-jobs layer** (node-cron). It is an internal line-of-business / operations tool, not a public product.

## Technology stack

### Frontend (`/src`, root `package.json`, name `psa-web`)

| Concern | Choice | Version |
|---------|--------|---------|
| UI library | React | 19.2 |
| Build tool / dev server | Vite | 8.0 |
| Routing | react-router-dom | 7.14 |
| Styling | Tailwind CSS (via `@tailwindcss/vite`) | 4.2 |
| Icons | lucide-react | 1.11 |
| HTTP | axios | 1.15 |
| Real-time | socket.io-client | 4.8 |
| Env / server helpers | dotenv, googleapis, nodemailer *(present in root deps but primarily backend concerns)* | — |

### Backend (`/server`, `package.json` name `flowdesk-server`)

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime / framework | Node.js + Express | 4.18 |
| Database ODM | Mongoose | 8.x |
| Auth | jsonwebtoken + bcrypt | 9 / 6 |
| Cookies | cookie-parser | 1.4 |
| Real-time | socket.io | 4.8 |
| Scheduling | node-cron | 4.2 |
| File upload | multer, multer-storage-cloudinary | 2.x |
| Cloud media | cloudinary | 2.10 *(config commented out — stubbed)* |
| Email | nodemailer + googleapis (Gmail API) | — |
| Google services | googleapis (Drive, Calendar) | 171 |
| Dev | nodemon | 3.1 |

## High-level architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          BROWSER (SPA)                           │
│  React 19 + React Router 7                                       │
│  ├─ SocketProvider (global Socket.IO connection)                 │
│  ├─ DashboardLayout (sidebar shell + toasts + heartbeat)         │
│  └─ Pages (Dashboard, Projects, Expenses, Chat, ... )            │
│     state: local useState/useEffect; auth cached in localStorage │
└───────────────┬─────────────────────────────┬──────────────────┘
        REST (axios, JSON)             WebSocket (socket.io-client)
                │                             │
┌───────────────▼─────────────────────────────▼──────────────────┐
│                     EXPRESS SERVER (server.js)                    │
│  Middleware: cors(credentials), express.json, cookieParser       │
│  ┌────────────── Routing layer (/api/*) ──────────────┐          │
│  │  22 route modules → protect / authorize guards      │          │
│  └───────────────────────┬─────────────────────────────┘         │
│  ┌───────────────────────▼─────────── Controllers ────┐          │
│  │  21 controllers = business logic + data access      │          │
│  └───────────────────────┬─────────────────────────────┘         │
│  Services: driveService, calendarService  Utils: mailer,         │
│            taskStartAccess                                        │
│  Real-time: Socket.IO (rooms: user_, team_, project_, channel)   │
│  Cron: 6 scheduled jobs (auto clock-out, recurring tasks, ...)   │
└───────────────┬───────────────────────┬─────────────────────────┘
        Mongoose ODM                External APIs
                │                       │
     ┌──────────▼─────────┐   ┌─────────▼──────────────────────┐
     │  MongoDB (Atlas)   │   │ Google Drive / Gmail / Calendar│
     │  25 collections    │   │ Cloudinary (disabled)          │
     └────────────────────┘   └────────────────────────────────┘
```

## Design patterns in use

- **Layered / N-tier separation on the backend:** `routes → controllers → models`, with `services/` (external integrations) and `utils/` (cross-cutting helpers) pulled to the side. This is consistently applied across all 22 route modules.
- **Route-guard middleware chain:** `protect` (authenticate) then `authorize(...roles)` (RBAC) then handler — a clean, composable pattern. `router.use(protect)` is applied at the top of most route files.
- **Mongoose model-as-schema:** business rules like password hashing (`User.pre('save')`), `matchPassword` instance method, and `LeaveBalance.remainingDays` virtual live on the models.
- **Singleton config document:** `Settings` is a one-document-per-org configuration record (task labels, module toggles, org name/logo).
- **Repository-less data access:** controllers call Mongoose models directly (no repository abstraction) — typical MERN, but means query logic is duplicated across controllers.
- **Room-based pub/sub** on Socket.IO: personal (`user_<id>`), team (`team_<id>`), project (`project_<id>`), and channel rooms.
- **Alias routing:** the same timesheet controller is mounted at both `/api/timesheets` and `/api/worklogs`; timer endpoints are layered onto `/api/tasks`.
- **Cross-cutting scheduled jobs** required once at boot in `server.js` (fire-and-forget module side effects).

### Frontend patterns

- **Context for global concerns:** a single `SocketContext` provides the shared socket. No Redux/Zustand/React-Query.
- **Layout-as-wrapper:** `DashboardLayout` is passed `children` and renders the sidebar, notification toasts, and heartbeat loop.
- **Page-owns-everything:** each page component fetches its own data with axios, holds its own state, and renders its own modals/forms. Little shared UI beyond the layout and marketing components.
- **Auth cached in `localStorage`:** `user` object and `token` are read directly from `localStorage` throughout.

## Component hierarchy (frontend)

```
main.jsx
└─ App.jsx  (BrowserRouter)
   └─ SocketProvider
      └─ Routes
         ├─ "/"                         Home (marketing landing)
         │   └─ Navbar, Hero, Features, HowItWorks, SocialProof,
         │      ChatHighlight, TeamStatusPanel, Testimonials,
         │      Pricing, CtaBanner, Footer
         ├─ "/login"                    Login
         ├─ "/signup"                   Signup
         └─ "/dashboard/*"  (each page wraps itself in DashboardLayout)
            ├─ Dashboard                (employee/manager home)
            ├─ /admin                   AdminDashboard
            ├─ /users                   AdminUsers
            ├─ /batches                 ManageBatches
            ├─ /teams                   Teams
            ├─ /projects                Projects
            ├─ /project-management      ProjectManagement
            ├─ /attendance              Attendance
            ├─ /leaves                  Leaves
            ├─ /chat                    Chat
            ├─ /expenses                Expenses
            └─ /trainer-log             TrainerLog
```

Note: `DashboardLayout` is imported and rendered **inside each page** rather than as a parent route element, so the shell is repeated per page rather than shared via a layout route. There is **no `ProtectedRoute`** — routing is unauthenticated at the router level (see [09 — Security](09-security.md)).

## Real-time architecture

Socket.IO is initialised once in `SocketContext` on app load (if a token + user exist). On connect it:
1. emits `heartbeat <userId>` → server joins `user_<id>` room and stamps `lastActiveAt`;
2. joins the user's team room;
3. fetches the user's channels and DMs over REST and joins each channel room.

The server broadcasts domain events — `newMessage`, `poolTaskClaimed`, `forceLogout`, `userUpdated`, task/project progress updates — to the relevant rooms. `DashboardLayout` listens globally and renders toast notifications. A 60-second REST heartbeat (separate from the socket) keeps `lastActiveAt` fresh for Active/Away presence detection.

## Configuration & environments

- Frontend base URL resolved in `src/config.js`: production → `VITE_API_URL` (default `https://flow-desk-wgfm.onrender.com`), otherwise `http://localhost:5000`.
- CORS allow-list in `server.js` includes localhost:5173/5174, a Vercel URL, and `APP_URL`.
- `vercel.json` and `vite.config.js` present at root; backend expects `.env` (PORT, MONGO_URI, JWT_SECRET, Google credentials, MAIL_FROM, Drive folder id).
