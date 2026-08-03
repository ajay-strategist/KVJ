# Enterprise Gap Analysis

This document compares the current implementation of the KVJ Analytics application against enterprise software standards. It highlights security debt, technical debt, and missing features.

---

## 1. Security & Compliance Gaps

### Row-Level Security (RLS)
- **Current state**: All 42 tables use open RLS policies (`USING (true)`), allowing any authenticated user full access to read and write any record.
- **Enterprise Standard**: Granular RLS policies that restrict data access based on user roles and reporting lines.
- **Security Debt**: High. Regular employees can view, edit, or delete sensitive records like salary structures, budgets, and other employees' profiles.

### Authentication & Secrets
- **Current state**: Hardcoded developer profiles, default password fallbacks, and fallback API keys are present in source files.
- **Enterprise Standard**: All credentials and API configurations should be loaded dynamically from secure database entries or runtime environment variables.
- **Security Debt**: Medium. Exposes key credentials in the Git repository history.

---

## 2. Technical & Architectural Gaps

### Dual Databases (Supabase & MongoDB)
- **Current state**: The frontend writes to Supabase (PostgreSQL), while scheduled crons run on an Express server connected to MongoDB.
- **Enterprise Standard**: A single backend database that runs all application workflows and scheduled tasks.
- **Technical Debt**: Critical. Dangling attendance sessions, leave balance resets, and overdue tasks are not processed on Supabase, leading to stale and incorrect reports.

### Repository Pattern Bypasses
- **Current state**: UI views import the concrete `supabase` instance directly and run inline queries, bypassing the repository layer.
- **Enterprise Standard**: All network operations route through repository interfaces managed by a central dependency injection container.
- **Technical Debt**: Medium. Tightly couples the UI with the Supabase client, making it difficult to refactor or mock the database layer.

---

## 3. UX & Performance Gaps

### Mobile Layout Scaling
- **Current state**: Complex tables and schedulers (e.g., timesheets, calendar grids) overflow horizontally on mobile screens, requiring side scrolling.
- **Enterprise Standard**: Responsive layouts that adapt complex grids into stacked card views on smaller screens.
- **UX Debt**: Medium. Restricts managers and employees from logging hours or viewing calendars on mobile devices.

### Monolithic Components
- **Current state**: Monolithic component files (such as `BatchManagement.tsx` with 3,900+ lines) cause slow render times and are difficult to maintain.
- **Enterprise Standard**: Modular component trees where state updates are isolated to smaller sub-views.
- **Performance Debt**: High. Minor updates (e.g., typing in a search bar) trigger full re-renders of the entire page DOM.

---

## 4. Feature Implementation Gaps

| Feature Area | Current State | Enterprise Standard Gap | Remediation Complexity |
| :--- | :--- | :--- | :---: |
| **Real-time Chat** | Saves messages to Supabase, but requires page refreshes to display updates. | Missing real-time subscriptions (WebSockets) in the UI. | Medium |
| **Scheduled Tasks** | Cron jobs run on a legacy Express/MongoDB server. | Missing background scheduling on the active Supabase database. | Medium |
| **PowerBI Gateway** | Disabled via configuration. Renders a static placeholder screen. | Missing iframe integrations with active PowerBI reports. | Low |
| **Error Fallbacks** | Direct queries throw unhandled promise rejections on network loss. | Missing centralized error boundaries and offline warnings on UI pages. | Low |
