# KVJ Analytics — UI/UX Design System

**Version:** 1.0 (proposal for approval)
**Scope:** Prompt 3 — the complete design language for the KVJ Analytics Training Operations Platform.
**Status:** Design specification only. **No business logic, database, or API work is included, and no application code has been modified.** This document defines *how the product looks and behaves*; feature implementation begins only after approval.

> Design north star: it should feel like a **premium 2026 SaaS product** — the calm precision of Linear, the structured warmth of Notion, the approachability of Slack — never a traditional admin dashboard. Every token below is centralized and swappable (see [§19 Branding](#19-branding-guidelines)).

## Contents
1. [Design Principles](#1-design-principles) · 2. [Color Palette](#2-color-palette) · 3. [Theme System](#3-theme-system) · 4. [Typography](#4-typography) · 5. [Spacing & Layout System](#5-spacing--layout-system) · 6. [Radius, Elevation & Borders](#6-radius-elevation--borders) · 7. [Design Tokens (master reference)](#7-design-tokens-master-reference) · 8. [Iconography](#8-iconography) · 9. [Component Library](#9-component-library) · 10. [Table Design](#10-table-design) · 11. [Form Design](#11-form-design) · 12. [Navigation System](#12-navigation-system) · 13. [Global Search](#13-global-search) · 14. [Dashboards & Workspaces](#14-dashboards--workspaces) · 15. [Charts](#15-charts) · 16. [Chat Design](#16-chat-design) · 17. [Notifications](#17-notifications) · 18. [Report Theme](#18-report-theme) · 19. [Branding Guidelines](#19-branding-guidelines) · 20. [Animation Guidelines](#20-animation-guidelines) · 21. [Responsive Rules](#21-responsive-rules) · 22. [Accessibility Standards](#22-accessibility-standards) · 23. [State Design (Empty / Loading / Error / Success)](#23-state-design) · 24. [Implementation Notes](#24-implementation-notes)

---

## 1. Design Principles

1. **Automate over ask.** Derive, pre-fill, and suggest. The UI shows results, not empty forms.
2. **One source of truth, visually.** A change surfaces everywhere it's relevant — reflected in linked cards, badges, and counts.
3. **Feedback for every action.** Hover, focus, optimistic update, success celebration — the user is never guessing.
4. **Content first, chrome second.** Minimal borders, generous whitespace, restrained color. Color communicates *meaning*, never decoration.
5. **Progressive disclosure.** Surface the 20% users need constantly; tuck the rest behind drawers, tabs, and "more".
6. **Fast is a feature.** Skeletons, code-splitting, and optimistic UI so it feels like a desktop app.
7. **Consistent, not repetitive.** One component per job, reused everywhere — no bespoke tables/modals per page.

---

## 2. Color Palette

Color is expressed as a **primitive scale** (raw values) mapped to **semantic tokens** (roles). Components use *semantic* tokens only, so themes and branding swap cleanly.

### 2.1 Brand & accent primitives (light-reference values, 50→900)

| Scale | 50 | 100 | 300 | 500 (base) | 600 | 700 | 900 |
|---|---|---|---|---|---|---|---|
| **Blue** (primary/brand) | `#EFF6FF` | `#DBEAFE` | `#93C5FD` | `#3B82F6` | `#2563EB` | `#1D4ED8` | `#1E3A8A` |
| **Emerald** (success/positive) | `#ECFDF5` | `#D1FAE5` | `#6EE7B7` | `#10B981` | `#059669` | `#047857` | `#064E3B` |
| **Purple** (info/insight) | `#F5F3FF` | `#EDE9FE` | `#C4B5FD` | `#8B5CF6` | `#7C3AED` | `#6D28D9` | `#4C1D95` |
| **Orange/Amber** (warning) | `#FFFBEB` | `#FEF3C7` | `#FCD34D` | `#F59E0B` | `#D97706` | `#B45309` | `#78350F` |
| **Red** (danger/error) | `#FEF2F2` | `#FEE2E2` | `#FCA5A5` | `#EF4444` | `#DC2626` | `#B91C1C` | `#7F1D1D` |
| **Slate/Grey** (neutral) | `#F8FAFC` | `#F1F5F9` | `#CBD5E1` | `#64748B` | `#475569` | `#334155` | `#0F172A` |

The current app's navy `#1A3E6F` / blue `#2E75B6` are preserved as an optional **"KVJ Classic"** brand preset (see [§19](#19-branding-guidelines)); the default brand is Blue-500/600 for a more modern feel. **Both are just token values** — swapping is one config change.

### 2.2 Status colors (semantic, theme-independent meaning)

| Status | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Success / Approved / Active / Present | `--status-success` | Emerald-600 | Emerald-400 | Positive terminal states |
| Warning / Pending / Overdue-soon | `--status-warning` | Amber-500 | Amber-400 | Needs attention |
| Danger / Rejected / Overdue / Absent | `--status-danger` | Red-600 | Red-400 | Negative / blocking |
| Info / In Review / Scheduled | `--status-info` | Purple-600 | Purple-400 | Neutral-informational |
| Neutral / Draft / To Do / Inactive | `--status-neutral` | Slate-500 | Slate-400 | Default / idle |
| In Progress / Working | `--status-progress` | Blue-600 | Blue-400 | Active work |

Every status is rendered as a **Badge** (soft tinted bg + saturated text) — never as raw colored text — for consistent contrast in both themes.

### 2.3 Gradient accents (used sparingly)
- **Brand gradient:** `linear-gradient(135deg, Blue-500, Purple-500)` — hero surfaces, empty-state art, report covers, primary CTA on marketing/auth only.
- **Success gradient:** `linear-gradient(135deg, Emerald-400, Blue-500)` — success celebrations.
Gradients never sit behind body text or data tables.

---

## 3. Theme System

Three modes: **Light**, **Dark**, **System** (follows OS). Switching is **instant** (CSS-variable swap on `:root`, ~150ms color transition, respects `prefers-reduced-motion`). Persisted per user.

### 3.1 Semantic surface tokens

| Role | Token | Light | Dark |
|---|---|---|---|
| App background | `--bg-app` | `#F8FAFC` (Slate-50) | `#111827` |
| Surface / card | `--bg-surface` | `#FFFFFF` | `#1F2937` |
| Raised panel / popover | `--bg-panel` | `#FFFFFF` | `#374151` |
| Sunken / input well | `--bg-sunken` | `#F1F5F9` | `#0F1520` |
| Hover fill | `--bg-hover` | `rgba(15,23,42,0.04)` | `rgba(255,255,255,0.05)` |
| Border / divider | `--border` | `#E2E8F0` | `#374151` |
| Border strong | `--border-strong` | `#CBD5E1` | `#4B5563` |
| Text primary | `--text-primary` | `#0F172A` | `#F9FAFB` |
| Text secondary | `--text-secondary` | `#475569` | `#D1D5DB` |
| Text muted | `--text-muted` | `#94A3B8` | `#9CA3AF` |
| Brand | `--brand` | Blue-600 | Blue-400 |
| Brand-contrast (text on brand) | `--brand-contrast` | `#FFFFFF` | `#0B1220` |
| Focus ring | `--focus-ring` | `Blue-500 @ 45%` | `Blue-400 @ 55%` |

**Light theme** is soft, not stark: app bg is Slate-50 (never pure white everywhere), cards are white with soft shadows, color used only to convey meaning. **Dark theme** uses the mandated layered surfaces (`#111827` bg → `#1F2937` cards → `#374151` panels), **never pure black**, with accents kept vibrant (shift to the -400 step for legibility) and charts auto-adapting their grid/label colors.

---

## 4. Typography

**Primary typeface:** Inter (already in use) for UI. **Numeric/tabular:** Inter with `font-variant-numeric: tabular-nums` in tables and metrics. **Report/display option:** a serif (e.g. "Fraunces" / "Source Serif") reserved for report covers only. Fonts are a branding token (see §19).

### 4.1 Type scale

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `display` | 36 / 44 | 700 | Report covers, marketing hero |
| `h1` | 28 / 36 | 700 | Page title |
| `h2` | 22 / 30 | 600 | Section title |
| `h3` | 18 / 26 | 600 | Card / group title |
| `body-lg` | 16 / 24 | 400 | Emphasised body, form labels |
| `body` | 14 / 22 | 400 | Default body, table cells |
| `label` | 13 / 18 | 500 | Field labels, badges, meta |
| `caption` | 12 / 16 | 500 | Timestamps, helper text |
| `mono` | 13 / 20 | 500 | IDs, code, tokens (JetBrains Mono) |

Rules: one `h1` per page; obvious hierarchy via size+weight, not color; body never below 12px; line length capped ~72ch for reading surfaces; letter-spacing `-0.01em` on headings ≥ h2.

---

## 5. Spacing & Layout System

**4px base grid.** Scale (tokens `--space-*`): `0=0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64, 20=80`.

- **Card padding:** 24 (desktop) / 16 (mobile).
- **Section gap:** 32–48. **Component gap in a group:** 12–16.
- **Page gutter:** 32 desktop / 24 tablet / 16 mobile.
- **Content max-width:** 1440 (app), 720 (reading/forms), 1080 (reports).

### 5.1 App layout skeleton
```
┌──────────────────────────────────────────────────────────┐
│ Top bar: breadcrumb · global search · theme · notifications · avatar │
├───────────┬──────────────────────────────────────────────┤
│  Sidebar  │  Workspace / page content                     │
│ (collapsible│  ┌─ Page header (title, actions) ─────────┐ │
│  72↔260px)│  │  Content grid (cards / table / board)   │ │
│           │  └──────────────────────────────────────────┘ │
│           │  Optional right context drawer (details/chat)  │
└───────────┴──────────────────────────────────────────────┘
```
12-column fluid grid inside content; cards snap to 1/2/3/4-up responsively.

---

## 6. Radius, Elevation & Borders

**Radius** (`--radius-*`): `xs=6, sm=8, md=12, lg=16, xl=20, 2xl=24, pill=9999`. Default card = `lg (16)`; buttons/inputs = `md (12)`; badges/chips = `pill`.

**Elevation** (soft, low-spread shadows; dark theme uses subtler shadows + a 1px light top-border for lift):
| Token | Light | Use |
|---|---|---|
| `e0` | none | Flush surfaces |
| `e1` | `0 1px 2px rgba(15,23,42,.06)` | Cards at rest |
| `e2` | `0 4px 12px rgba(15,23,42,.08)` | Card hover, dropdowns |
| `e3` | `0 12px 28px rgba(15,23,42,.12)` | Drawers, popovers |
| `e4` | `0 24px 48px rgba(15,23,42,.16)` | Modals |

**Borders:** prefer elevation + bg contrast over borders. When used, 1px `--border`, hairline. No heavy 2px admin-style borders.

---

## 7. Design Tokens (master reference)

All tokens are CSS custom properties on `:root`, overridden under `[data-theme="dark"]`. Categories: **color** (§2–3), **typography** (§4), **spacing** (§5), **radius/elevation/border** (§6), plus:

- **Animation:** `--dur-instant 80ms`, `--dur-fast 150ms`, `--dur-base 220ms`, `--dur-slow 320ms`; easings `--ease-standard cubic-bezier(.2,0,0,1)`, `--ease-emphasized cubic-bezier(.2,0,0,1)`, `--ease-spring` for playful reveals.
- **Z-index:** `base 0`, `sticky 100`, `dropdown 1000`, `drawer 1100`, `modal 1200`, `toast 1300`, `tooltip 1400`.
- **Icon sizes:** `14 / 16 / 20 / 24`. **Stroke:** 1.75px.
- **Table:** row height `44` (comfortable) / `36` (compact); header height `48`.
- **Focus ring:** `0 0 0 3px var(--focus-ring)`.

Token naming: `--<category>-<role>[-<variant>]`. Components reference semantic tokens **only** — never raw hex.

---

## 8. Iconography

Single library: **Lucide** (already a dependency) — consistent 1.75px stroke, rounded joints, matches the modern aesthetic. Rules: icons carry meaning (never decorative filler); one icon per concept app-wide (e.g. clock = attendance everywhere); pair with a text label except in dense toolbars where a tooltip is required; 20px default in nav/buttons, 16px inline. Illustrations (empty/error/success) use a cohesive line-illustration style tinted with brand/accent tokens.

---

## 9. Component Library

One canonical component per job; all theme-aware and accessible. Core set:

**Actions & inputs:** Button (variants: `primary`, `secondary`, `ghost`, `subtle`, `danger`, `icon`; sizes `sm/md/lg`; states rest/hover/active/focus/loading/disabled; optional ripple), IconButton, SplitButton, Toggle, Checkbox, Radio, Switch, TextField, TextArea, NumberField, Select, **SearchableSelect/Combobox**, MultiSelect, DatePicker, DateRangePicker, TimePicker, FileDropzone, Slider, SegmentedControl.

**Containers:** Card, StatCard (metric + delta + sparkline), SectionCard, Panel, Drawer (right/left), Modal/Dialog, Popover, Tooltip, Tabs, Accordion, Collapsible, Divider.

**Data & status:** DataTable (§10), List, KanbanBoard, Timeline, Calendar, Avatar + AvatarGroup, Badge, StatusPill, Tag/Chip, ProgressBar, ProgressRing, Skeleton, EmptyState, Pagination, Stepper.

**Domain cards (reused across modules):** NotificationCard, ApprovalCard (inline approve/reject), ActivityCard, CommentCard, TaskCard, TrainingCard, ExpenseCard, StudentCard, AnnouncementCard.

**Feedback:** Toast, InlineAlert, ConfirmDialog, SuccessOverlay, ErrorState, LoadingBar.

Each component ships with: prop API, all states, light+dark, keyboard behavior, and a usage/don't note in the catalogue. **No page defines its own table, modal, or badge.**

---

## 10. Table Design

Tables are first-class (most of KVJ's operational data lives in them). The single **DataTable** supports:

- **Sticky header** (and optional sticky first column); header height 48.
- **Sorting** (multi-column), **column resize**, **hide/show columns**, **reorder** (drag), persisted per user.
- **Search** (in-table), **filters** (per-column + saved filter sets), **pagination** or infinite scroll, **row selection** + **bulk action bar** (appears on selection), **row expansion** (detail panel), **row hover** actions.
- **Export** hook (CSV/PDF via the Report Engine, later).
- **Loading skeleton rows**, **empty state**, **error state** built in.
- **Density toggle** (comfortable 44 / compact 36); **tabular-nums** for numeric columns; right-aligned numbers, left-aligned text.
- **Virtualized rows** for large sets (desktop-app feel).
- **Responsive:** on mobile, collapses each row into a stacked **Card** view (label:value pairs) with primary action — critical for approvals/expenses on phones.

Visual: zebra-free by default (rely on row hover + hairline dividers), generous 12–16px cell padding, status shown as Badge.

---

## 11. Form Design

- **Large, clear labels** above fields (`body-lg`/`label`), helper text below, **inline validation** on blur + on submit (never only on submit).
- **Searchable dropdowns** by default for any list > 7 options; **context-aware defaults** and **recent values** pre-filled; **autocomplete** and **templates** to reduce typing.
- **Keyboard-first:** logical tab order, Enter to submit, `⌘/Ctrl+S` to save, Esc to cancel/close.
- **Auto-save** on long/edit forms (draft indicator "Saved · 2s ago"); explicit Save on create flows.
- **Field states:** rest / focus (focus ring) / filled / error (red border + message + icon) / success / disabled / readonly.
- **Layout:** single-column for flows (fastest completion); two-column only for dense settings on desktop. Grouped sections with SectionCard. Sticky action bar on long forms.
- **Reduce steps:** multi-step forms use a Stepper with progress; bulk operations and drag-drop where it removes typing.

---

## 12. Navigation System

**Collapsible sidebar** (260px expanded ↔ 72px icon-rail), remembering state.

- **Structure:** Workspace switcher (top) → Pinned/Favourites → Primary modules → Recent (auto) → Settings (bottom). Active item shows brand accent bar + tinted bg.
- **Pinned modules** and **favourite pages** (user-curated); **recently visited** auto-list.
- **Top bar:** breadcrumb (path + quick parent nav), **global search** (§13), theme toggle, notification bell (unread count), avatar menu.
- **Command palette** (`⌘/Ctrl+K`) for nav + actions ("Create task", "Clock in", "Approve expense"), Linear-style.
- **Mobile:** sidebar becomes a bottom tab bar (Home/My Day, Tasks, Attendance, Chat, More) + slide-over drawer for full menu.

---

## 13. Global Search

One intelligent search (top bar + `⌘/Ctrl+K`). Searches across **employees, students, projects, tasks, trainings, reports, expenses, chat, announcements**. Results **grouped by entity type** with icon, title, context line, and a jump/inline-action. Supports recent searches, keyboard nav, and scoped search (`type:task overdue`). Design: full-width overlay with dimmed backdrop, large input, instant (debounced) results, skeleton while loading, helpful empty state with suggestions.

---

## 14. Dashboards & Workspaces

Modules recede; **role-based workspaces** are the primary interface. Each is a composed grid of the shared cards/charts — same components, different selection & priority.

### 14.1 My Day (default Employee workspace)
The employee's home. Widgets: **Current work session** (clock-in status + live timer), **Today's tasks** (prioritised, quick-complete), **Training** (today's sessions/batches), **Approvals** awaiting me, **Pending work**, **Expenses** (recent + submit CTA), **Notifications**, **Announcements**, **Calendar** (today/upcoming). Layout: greeting + date header, a top row of StatCards, then a responsive 2–3 column card grid; primary actions inline (clock in, add task, submit expense).

### 14.2 Supervisor workspace
Team-scoped: team presence/attendance, task board health, approvals queue (leave/expense/task), members needing attention, training progress for supervised batches.

### 14.3 Manager workspace
Department roll-up: cross-team KPIs, project portfolio status, utilisation, pending approvals routed to manager, budget vs actual (when available), trend charts.

### 14.4 CEO workspace
Executive analytics: company KPIs (headcount, active trainings, students, revenue/utilisation when available), org-wide trends, top/bottom performers, consulting-grade summary cards — the surface that feeds the Report Theme (§18).

All four share a consistent header pattern, StatCard row, and card grid — only widget selection and analytics depth differ.

---

## 15. Charts

Modern, minimal, theme-adaptive. Library recommendation: a React chart lib with full styling control (e.g. Recharts or ECharts) themed via tokens.

- **Palette:** categorical series use Blue→Purple→Emerald→Amber→Slate (colorblind-considered order); sequential/heat uses a single-hue ramp.
- **Style:** rounded bar caps, 2px smoothed lines, soft area fills (12% opacity), no chart borders, light dashed gridlines (`--border`), tokenized axis/label colors that **auto-adapt** to dark.
- **Interaction:** hover tooltips (card style, e2 elevation), legend toggles, smooth enter animation (`--dur-base`), empty/loading states.
- **Types:** line/area (trends), rounded bar/column (comparisons), donut (composition), sparkline (in StatCards), progress ring (completion), calendar heatmap (attendance).
- Numbers use tabular-nums; always labelled units; never rely on color alone (also use labels/patterns).

---

## 16. Chat Design

Modernize existing chat; **preserve all current functionality** (channels General/Team/Custom/DM, threads, mentions, file upload, real-time). Add: **emoji reactions**, **reply/quote**, **pinned messages**, **unread badges** per channel, **typing indicator**, **message search**, and scoped rooms — **project chat**, **training chat**, **department chat**.

Layout: three-pane on desktop (channel list · message stream · thread/detail drawer); two-pane tablet; single-pane mobile with slide navigation. Message row: avatar, name, timestamp (muted), body, reactions, hover actions (react/reply/pin/more). Own messages align subtly right or brand-tinted; grouped consecutive messages; date separators; sticky channel header with members + search. Composer: growing input, attach, emoji, mention autocomplete, Enter-to-send. Full light/dark support with vibrant accent for mentions/unread.

---

## 17. Notifications

**Notification center** (top-bar bell → drawer). Grouped by category (Approvals, Tasks, Training, Chat, System), **unread count** badge, **priority** indication (urgent = red dot, normal = brand). **Actions directly from the notification** (approve/reject, mark done, open) via the shared ActionableNotificationCard. Read/unread states, "mark all read", filters, and per-category preferences. Real-time toasts for live events (reuse existing socket layer) — top-right, auto-dismiss, stack, with action button; toasts never block; success/error/info variants tokenized.

---

## 18. Report Theme

Reports are a **KVJ product** — consulting-grade (Deloitte/PwC/McKinsey feel), **never** a Power BI export.

- **Cover page:** brand gradient or clean branded header, report title (`display` serif option), client/subject, date, KVJ logo, prepared-by.
- **Layout:** structured sections with generous margins, page numbers, running header/footer with branding, print-ready A4/Letter, consistent grid.
- **Content:** narrative + **cards, charts, timelines, infographics**, callout stats, key-findings boxes, tables styled to §10 but print-tuned (no zebra, hairline rules).
- **Typography:** display/serif headings, Inter body, clear hierarchy, ample line spacing.
- **Color:** restrained brand + accent palette; charts use §15 palette; high print contrast.
- **Output:** on-screen (beautiful, interactive) and print/PDF (presentation-ready). Report **theme is configurable** per brand (§19).

The distinction from dashboards: dashboards are for *operating*; reports are for *presenting* — polished, paginated, story-driven.

---

## 19. Branding Guidelines

Everything themeable via a central **Brand config** (tokens), so KVJ (or a future white-label) can configure without code changes:

- **Logo** (light/dark variants, favicon), **Application name**.
- **Primary color** & **Secondary color** (drive the brand/accent tokens).
- **Fonts** (UI + report/display).
- **Email templates** (branded header/footer, tokens).
- **Report theme** (cover style, accent, cover art).

Presets: **KVJ Modern** (Blue-600 primary, Purple secondary — default) and **KVJ Classic** (navy `#1A3E6F` / blue `#2E75B6`, honoring current identity). Changing the preset re-tints the entire app, charts, and reports instantly because components read semantic tokens only.

> **Confirmation needed (design-level, not business rules):** default **primary brand color** (recommended Blue-600) and **report display font**. These are the only two open design choices; sensible defaults are in place and swappable at any time.

---

## 20. Animation Guidelines

Motion clarifies, never distracts. Single motion system (recommend Framer Motion) using animation tokens (§7) and honoring `prefers-reduced-motion` (fall back to instant/opacity-only).

| Interaction | Motion | Duration / Ease |
|---|---|---|
| Theme switch | color cross-fade of tokens | `dur-fast` / standard |
| Card hover | lift e1→e2 + 1px translateY | `dur-fast` / standard |
| Sidebar expand/collapse | width + label fade | `dur-base` / emphasized |
| Page transition | fade + 8px slide-up | `dur-base` / standard |
| Drawer / modal | slide/scale-in + backdrop fade | `dur-base` / emphasized |
| Dropdown / popover | scale-95→100 + fade | `dur-fast` / standard |
| Skeleton | shimmer sweep | 1.2s loop |
| Toast / notification | slide-in from right + fade | `dur-base` / spring |
| Success | check-draw / confetti (tasteful) | `dur-slow` / spring |
| Chart reveal | series grow/draw-on | `dur-base` staggered |
| Button press | ripple / 98% scale | `dur-instant` |

Rules: animate transform/opacity (GPU-friendly); no animation > 400ms in-app; never animate on every keystroke; motion consistent across the app.

---

## 21. Responsive Rules

**Desktop-first, fully responsive.** Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.

- **Desktop (≥1024):** sidebar + multi-column grids + right context drawer.
- **Tablet (768–1023):** collapsed icon-rail sidebar, 2-column grids, drawers become full-height sheets.
- **Mobile (<768):** bottom tab bar, single-column, tables → stacked cards, modals → full-screen sheets, sticky action buttons.
- **Mobile-critical flows must be flawless:** Attendance (one-tap clock in/out, geolocation), Expenses (capture receipt + submit), Approvals (swipe/approve inline), Chat, Task updates. These get dedicated mobile-optimized layouts, not just reflow.
- Touch targets ≥ 44px; no hover-only actions on touch.

---

## 22. Accessibility Standards

Target **WCAG 2.1 AA**.

- **Contrast:** text ≥ 4.5:1 (≥3:1 for large); verified in both themes; status never conveyed by color alone (icon/label too).
- **Keyboard:** everything operable without a mouse; visible focus ring on all interactive elements; logical tab order; command palette + shortcuts; Esc closes overlays; focus trapped in modals and restored on close.
- **Screen readers:** semantic HTML, ARIA roles/labels on custom widgets (menus, tabs, dialogs, comboboxes), live regions for toasts/async results, table headers associated with cells.
- **Motion:** honor `prefers-reduced-motion`.
- **Forms:** labels tied to inputs, errors announced and linked (`aria-describedby`), required state exposed.
- **Targets/zoom:** 44px min touch targets; layouts survive 200% zoom.

---

## 23. State Design

Every screen defines four states — no blank screens, no dead ends.

- **Empty:** friendly line **illustration** + one-line explanation + **primary action** (e.g. "No expenses yet — Submit your first claim"). Never "No Data".
- **Loading:** **skeletons** matching final layout (cards/table rows/chart blocks), progress bar for route transitions, **optimistic updates** for user actions (show the result immediately, reconcile on response, roll back with a toast on failure).
- **Error:** illustrated error state that **explains the problem**, **suggests a fix**, and offers **Retry** / secondary action; inline field errors for forms; non-blocking toast for background failures. Never expose raw stack traces.
- **Success:** tasteful confirmation for meaningful actions (Report sent, Expense approved, Training completed, Task completed) — inline check animation or brief success overlay/confetti, plus a toast; celebrations are quick and never block the next action.

---

## 24. Implementation Notes

*(For the build phase — after approval. Nothing here is executed now.)*

- **Delivery:** implement tokens as CSS variables (Tailwind v4 `@theme` extended to full scales) + a typed token module; components as a documented kit (Storybook-style catalogue) so every module inherits the system.
- **Theming:** `data-theme` on `<html>`; System mode via `matchMedia`; persisted per user.
- **Consumption rule:** components read **semantic tokens only** — this is what makes theming and branding one-line swaps and keeps dark mode + reports automatically correct.
- **Ties to Prompt 2:** the design system sits in the Presentation layer and is fed by the mock services first (design-system Phase 1), so the full UI can be built and reviewed before any datastore/API decision is acted on.

---

### Sign-off

This is the complete UI/UX Design System proposal covering every item in the Prompt 3 deliverable list. **No features, business logic, database, or APIs have been implemented, and no application code changed.** On approval (and confirmation of the two open design choices in §19), this becomes the visual contract every subsequent module must follow.
