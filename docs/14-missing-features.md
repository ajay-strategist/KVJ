# 14 — Missing Features Report

Gaps between FlowDesk today and a **complete Operations Management System**. Grouped by theme. This is an inventory for planning — nothing here has been built.

## Platform & foundation

- **No automated tests** (unit/integration/e2e) — foundational for a production OMS.
- **No CI/CD pipeline** evident (lint/test/build/deploy automation).
- **No frontend route protection / centralised auth guard.**
- **No shared component library or design system** (primitives are re-implemented per page).
- **No centralised API client / error handling / logging** on the frontend.
- **No structured server logging, monitoring, or health/metrics endpoints** (only a liveness string).
- **No environment/config management** beyond raw `.env`; no secrets manager.
- **No API documentation artefact** (OpenAPI/Swagger).

## Access control & governance

- **Coarse 3-role model** (Admin/Manager/Employee + isTrainer). A full OMS typically needs **granular permissions / custom roles**, department/business-unit scoping, and delegation.
- **No audit trail** beyond attendance corrections — an OMS usually needs org-wide activity logging (who changed what, when).
- **No approval-chain configurability** — approval flows (expense, leave, task transfer) are hardcoded, not configurable multi-step workflows.
- **No SSO / MFA** — enterprise operations tools generally require SAML/OIDC SSO and MFA.

## Operations breadth

- **No inventory / asset / resource management** (equipment, licences, rooms) — common OMS pillar.
- **No procurement / purchase-order / vendor management** (there's expense capture but no PO lifecycle or vendor master; `Client` exists but is underused and there's no supplier concept).
- **No scheduling / shift / roster management** (attendance is reactive clock-in, not planned shifts).
- **No capacity / resource-allocation planning** (who is available, utilisation targets, forecasting).
- **No SLA / ticketing / service-request module** (no helpdesk/case management).
- **No document management / knowledge base** (files go to Drive ad hoc; no versioned doc store).
- **No CRM / sales pipeline** (Client is a thin record; no opportunities, contracts, or billing).
- **No invoicing / billing / revenue** despite cost tracking on timesheets — a PSA usually closes the loop to client invoicing.
- **No budget vs actual / financial planning** at project or department level.

## Analytics & reporting

- **No BI/warehouse layer** (see [13](13-powerbi-readiness.md)); reporting is dashboards + Excel exports.
- **No custom/ad-hoc report builder** for end users.
- **No scheduled report delivery** (email a weekly ops report).
- **No org-level KPI/analytics dashboards** beyond the admin counts.

## Notifications & collaboration

- Real-time **in-app** notifications and email exist, but there's **no notification centre / preferences**, **no push/mobile notifications**, and **no digest emails**.
- **No calendar-driven scheduling UI** despite the Google Calendar OAuth plumbing.
- Chat lacks **reactions, edits/deletes, read receipts, search, pinning** (typical of a mature messaging module).

## User experience

- **No dark mode / theming** (single light theme).
- **No mobile app or PWA**; layouts are desktop-oriented.
- **No internationalisation / localisation / multi-currency** (currency is effectively INR-defaulted).
- **No accessibility (a11y) pass** evident.
- **No global search** across entities.
- **No user self-service profile/settings** page (profile data is admin-managed).
- **No bulk-import** (users, projects, holidays) beyond seed scripts.

## Data & integrations

- **Client data model unlinked** from projects (string vs collection) — blocks client-centric operations.
- **Cloudinary disabled**; storage story is Drive-only and undocumented.
- **No webhook/eventing outward** for third-party integration.
- **In-process cron** doesn't scale horizontally (no distributed scheduler).
- **No data retention / archival policy** beyond the 1-year archived-task delete and annual leave reset.

## Reliability & compliance

- **No backup/restore or disaster-recovery documentation.**
- **No rate limiting / abuse protection.**
- **No GDPR-style data-subject tooling** (export/delete a person's data).
- **No feature flags** for safe rollout (module toggles exist but are coarse on/off).

## Summary

FlowDesk is a strong **PSA-flavoured operations tool** covering people-ops (attendance, leave, timesheets), work management (projects/tasks), spend (expenses) and collaboration (chat) very capably. To become a **complete Operations Management System** the largest missing pillars are: **granular access control + audit**, **resource/scheduling/asset/procurement modules**, **billing/financial closure of the PSA loop**, a **BI/analytics layer**, and the **engineering foundations** (tests, CI/CD, monitoring, shared component/API layers, SSO/MFA) expected of an enterprise product.
