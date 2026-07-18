# 01 — Executive Summary

## What the system is

FlowDesk is an internally-built **Professional Services Automation (PSA) / operations platform** for a training-and-consulting style organisation. It consolidates eight operational domains into a single web application: **user administration, attendance/time-clock, leave management, timesheets/worklogs, projects & tasks, expenses, team chat, and trainer activity logging**. A three-tier role model (Admin, Manager, Employee) governs access, with an additional `isTrainer` flag layering trainer-only features on top.

Architecturally it is a textbook **MERN** application:

- **Frontend:** React 19 SPA built with Vite 8, styled with Tailwind CSS v4, routed with React Router v7, real-time via Socket.IO client. Icons from lucide-react. No component library, no dedicated state manager.
- **Backend:** Node.js + Express 4 REST API, MongoDB via Mongoose 8, JWT auth (cookie + bearer), Socket.IO server, six `node-cron` scheduled jobs.
- **Integrations:** Google Drive (service account) for file storage, Gmail API for transactional email, Google Calendar OAuth (per-user), Cloudinary (present but currently disabled/stubbed).
- **Hosting (inferred from config):** Frontend on Vercel, backend on Render, database on MongoDB Atlas.

## Overall health assessment

FlowDesk is a **feature-rich, functionally mature application that has clearly grown organically**. It already implements a surprising breadth of operations functionality — recurring tasks, task timers, task transfer approval chains, half-day leaves with medical-certificate deadlines, geolocated clock-in, auto-clock-out, per-user leave balances, and CSV/XLSX exports across nearly every module. The domain modelling is genuinely thoughtful.

However, it carries the hallmarks of rapid iterative development without a hardening pass. The most material concerns:

| Area | Verdict | Headline issue |
|------|---------|----------------|
| Feature completeness | Strong | Broad, real operational coverage |
| Data model | Good | Sensible schemas; some denormalisation drift (see below) |
| Security | **Needs work** | No frontend route guards; JWT stored in `localStorage`; a real `.env` with live secrets sits in the working tree; hardcoded seed admin credentials |
| Frontend structure | **Needs work** | Very large page components (Projects 1,488 LOC, Expenses 1,344, Chat 1,107); axios calls scattered per-page; no shared API client |
| Consistency | Fair | `Project.client` is a free-text string while a full `Client` collection also exists; task statuses configurable but enums hardcoded elsewhere |
| Reporting / BI | Fair foundation | Rich transactional data but no fact/dimension separation; not yet warehouse-shaped for Power BI |
| Testing | **Absent** | No automated test suite; only ad-hoc `scratch/` scripts |

## Top risks to address before/with the upgrade

1. **Authorization is enforced only server-side and only partially client-side.** `App.jsx` registers every route publicly — there is no `ProtectedRoute` wrapper. Access control depends on each page individually reading `localStorage` and on the API rejecting unauthorised calls. This is fragile and inconsistent.
2. **Secret management.** A populated `server/.env` (Mongo URI, JWT secret, Google refresh tokens, mail credentials) exists in the working directory, and `server/seedAdmin.js` hardcodes `admin@flowdesk.com / admin123`. These must be rotated and removed from any shared artefact.
3. **JWT in `localStorage`.** Despite the server also setting an httpOnly cookie, the token is persisted in `localStorage` and sent as a bearer header (and even in query strings for export links, e.g. `?token=`), which exposes it to XSS exfiltration.
4. **Monolithic page components** will make the planned upgrade slow and error-prone. The four largest pages hold most of the business logic inline.
5. **No test coverage** means the upgrade has no safety net.

## Suitability for the intended upgrade

The foundation is **sound enough to build the Operations Management System on, but should be hardened first.** The domain models, role system, real-time layer, cron infrastructure, and export machinery are genuine assets and shorten the road to a fuller OMS. The frontend architecture and the security posture are the two areas that will most repay attention before new modules are layered on.

See report [15 — Improvement Opportunities](15-improvements.md) for a prioritised (analysis-only) list. **No changes have been made in this phase.**
