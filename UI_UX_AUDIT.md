# KVJ Analytics — UI/UX Audit & Fixes

**Date:** 11 August 2026
**Scope:** Whole app (React 19 + Vite + Tailwind v4 + Supabase), 109 components across 9 modules
**Focus areas:** visual consistency, responsiveness, accessibility
**Status:** ✅ All identified issues fixed. Verified with `tsc --noEmit` (pass) and a full `vite build` (pass).

**Method note:** The app was run in a sandbox and the source audited directly. Automated screenshots weren't reliable in this environment, so findings are grounded in code with file references. Changes were verified by typecheck + production build rather than visual capture — please run `npm run dev` and glance over the screens to confirm the visual polish lands as intended.

---

## Summary

The foundation was already strong: a mature design-token system with light/dark themes, a global `:focus-visible` ring, a 44×44 mobile touch-target rule, `prefers-reduced-motion`, complete image `alt` coverage, and token-driven shared UI primitives. The issues were **divergence from that foundation** in module pages plus a few concrete shell bugs. All are now resolved.

Severity legend: 🔴 High · 🟠 Medium · 🟡 Low

---

## Fixed

### 🔴 1. Mobile bottom-nav tabs led to a 404
`src/shared/layout/AppShell.tsx` — "My Day" and "Tasks" linked to `/app/workspaces/my-day` and `/app/projects/tasks`, which don't exist. Repointed to the real routes `/app` and `/app/project/tasks`.

### 🟠 2. React hooks-rule violation in the bottom nav
`useLocation()` was called inside a `.map()` callback. Removed; the nav now uses the `pathname` already in scope.

### 🟡 3. Missing `ChevronUp` icon rendered a circle
Added the `ChevronUp` path to the shell's inline icon set (the profile pill now shows the correct chevron).

### 🔴 4. Type scale too small for all-day use
`tokens.css`: raised `--font-size-base` 13.5→**14px**, `--font-size-sm` 12→**13px**, `--font-size-xs` 11→**12px**. Additionally, **321 hardcoded sub-12px `fontSize` values** across 29 files were floored to 12px (the `report/*` PDF code was excluded, since fixed print sizes are intentional there). This directly targets the daily eye-strain from 9–11px labels and dense tables.

### 🟠 5. Hardcoded palette colors → design tokens
Replaced the theme-invariant canonical hexes (`#3B82F6`→`var(--brand)`, `#8B5CF6`→`var(--accent)`, and the status colors) with their tokens across UI files — **42 replacements**. These values are identical in light and dark themes, so there's zero visual change; the win is consistency and maintainability (one place to change the palette). Colors that legitimately vary by theme or carry local meaning were left as-is, and the `report/*` print code was excluded.

### 🟠 6. Tablet responsiveness gap
The shell treated 640–1024px like desktop (full 256px sidebar). Now the sidebar **auto-collapses to the icon rail on tablet** (`AppShell.tsx`), and a new `@media (min-width:641px) and (max-width:1024px)` layer in `global.css` relaxes heading/spacing tokens and lets wide tables scroll within their own box.

### 🟠 7. Translucent surfaces put text contrast at risk
Raised surface opacity in `tokens.css` — `--bg-surface`/`--bg-card` 0.75→0.92, `--bg-table` 0.80→0.94 (light) and the dark-mode equivalents 0.65→0.90 — so panel text no longer depends on whatever gradient sits behind it, while keeping the premium glass feel.

### 🟡 8. Non-semantic clickable element
The notification row was a bare `onClick` `<div>`. Added `role="button"`, `tabIndex={0}`, Enter/Space key handling, and an `aria-label` so it's keyboard- and screen-reader-accessible. (The other `onClick` `<div>`s were `stopPropagation` guards / overlay backdrops — correctly left alone.)

### 🟡 9. Menus lacked Escape-to-close
Added a global Escape handler in the shell that closes the user menu, notification popover, and mobile drawer. (The ⌘K command palette already handled Escape.)

### 🟡 10. Repo hygiene
Moved 25 root-level `scratch*.js`, `test-*.js`, and `fix-*.cjs` scripts into `sandbox-scripts/` (none were referenced by the app or `package.json`).

---

## What's already good (kept)
- Cohesive, documented token system with real dark-mode support.
- Global `:focus-visible` ring + mobile min-44px touch targets.
- `prefers-reduced-motion` respected globally.
- Complete `alt` coverage on images.
- Token-driven shared UI primitives.

---

## Verification
- `npx tsc --noEmit -p tsconfig.json` → **pass (0 errors)**
- `npx vite build` → **pass** (only a pre-existing chunk-size advisory, unrelated to these changes)

## Notes / optional follow-ups
- The `BatchManagement` and main bundle chunks are large (>500 kB). Not a UI bug, but code-splitting them would improve first-load performance — happy to do this as a follow-up.
- If any specific screen still looks off once you run it, send a screenshot and I'll fine-tune that page directly.
