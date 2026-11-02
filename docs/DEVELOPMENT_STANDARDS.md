# FlowDesk Engineering & Development Standards

**Document Identifier:** DOC-STD-001  
**Version:** 2.0  
**Status:** Approved Engineering Standards  
**Effective Date:** 2026-10-31  
**Project:** FlowDesk (`flow-desk-main`)

---

## 1. Objective & Scope

This document defines the formal coding and development standards for FlowDesk. All future rework, feature additions, and refactoring activities must strictly adhere to these guidelines to ensure maintainability, reliability, and code quality.

---

## 2. TypeScript & Type Safety Standards

### Strict Zero-`any` Policy
1. **Elimination of `any`:** The codebase currently contains **834 instances of `any`**. All new code and refactored files must eliminate `any` in favor of explicit domain interfaces, generic type constraints, or `unknown` with type guards.
2. **Compiler Settings:** Future phases will enable `noImplicitAny: true` in `tsconfig.json`.
3. **Explicit Return Types:** All public service methods, repository methods, and custom hooks must declare explicit return types.
4. **Type Assertion Prohibition:** Unsafe type casting (`as any`, `as unknown as Type`) is strictly prohibited unless interacting with un-typed third-party libraries, in which case a runtime validation assertion is mandatory.

```typescript
// ❌ REJECTED (Unsafe, un-typed)
const handleReject = async (task: any) => { ... }

// ✅ APPROVED (Explicit domain type with compile-time safety)
interface TaskItem {
  id: UUID;
  title: string;
  projectId: UUID;
  status: TaskStatus;
  actualHours: number;
}
const handleReject = async (task: TaskItem): Promise<Result<void, AppError>> => { ... }
```

---

## 3. Component Architecture & Design Standards

### Component Size & Single Responsibility
1. **Maximum Component Length:** No presentational React component may exceed **400 lines of code**. Pages exceeding this threshold (e.g. `MyDayPage.tsx` at 3,290 lines) must be decomposed into focused sub-components.
2. **Container vs. Presentational Separation:**
   - **Page Containers:** Responsible for route handling, invoking custom hooks, and layout composition.
   - **Presentational Components:** Pure, memoizable components receiving data and callbacks via typed props.
3. **Colocation:** Modals, drawers, and form components specific to a page must reside in a dedicated `components/` or `forms/` directory adjacent to that page.

---

## 4. Service & Repository Pattern Standards

1. **Clear Separation of Concerns:**
   - **Repositories:** Responsible exclusively for data access, Supabase PostgREST query generation, soft-delete filtering (`deleted_at IS NULL`), and object-relational mapping (`snake_case` $\leftrightarrow$ `camelCase`). Repositories contain **zero business logic**.
   - **Services:** Responsible for business logic validation, formula execution, multi-repository coordination, event emission, and error wrapping.
2. **Strict Query Encapsulation:** UI components and hooks must **never call `supabase.from(` directly**. All database interaction must flow through an injected or resolved repository.
3. **Result Pattern:** Services must never throw unhandled exceptions. All service methods return `Promise<Result<T, AppError>>`.

```typescript
// ✅ APPROVED: Standard Service Method Contract
async getEmployeeProbation(employeeId: UUID): Promise<Result<ProbationDetails, AppError>> {
  try {
    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) return Err(AppError.notFound('Employee not found.'));
    const details = calculateProbationMetrics(employee.joiningDate, employee.probationEndDate);
    return Ok(details);
  } catch (error) {
    this.logger.error('Failed to calculate probation metrics', { employeeId, error });
    return Err(AppError.internal('Unable to compute probation details.'));
  }
}
```

---

## 5. Date & Timezone Integrity Standards

1. **Root Cause Prevention:** Inconsistent date formatting was identified as a primary cause of `ISSUE-001` and attendance logging anomalies.
2. **Standardization Rules:**
   - **Storage:** All timestamps stored in the database must be ISO-8601 UTC strings (`2026-10-31T15:30:00.000Z`).
   - **Calendar Dates:** Work dates, leave dates, and holiday dates must be stored as ISO-8601 date strings (`YYYY-MM-DD`).
   - **Prohibited:** Never use `new Date().toISOString().slice(0, 10)` for local calendar dates, as it yields the wrong date in non-UTC timezones (e.g. IST). Always use `todayISO()` from [`src/shared/utils/date.ts`](file:///Users/apple/Downloads/flow-desk-main/src/shared/utils/date.ts).
   - **UI Rendering:** Format dates using the centralized utility `formatDisplayDate(val)` to ensure consistent `DD-MM-YYYY` rendering.

---

## 6. Dependency Management Standards

### Dead Package Elimination
The following unused dependencies identified in `package.json` must be removed during Phase 0 cleanup:
- `googleapis` (Node.js server library — 0 imports in web client)
- `nodemailer` (Node.js server library — 0 imports in web client)
- `dotenv` (Vite uses `import.meta.env` — 0 imports in web client)
- `socket.io-client` (Supabase Realtime is used — 0 imports in web client)
- `axios` (Native `fetch` is used throughout — 0 imports in web client)

### Heavy Library Optimization
Heavy client-side libraries must be lazy-loaded on demand:
- `xlsx` (424 kB minified) must only be loaded when the user clicks an "Export to Excel" action.
- `jspdf` and `html2canvas` (400+ kB minified) must only be loaded inside PDF export handlers.

---

## 7. Animation & UI Engineering Standards

### Restrained Animation Policy
1. **Usability-First:** Animations must serve a functional purpose (e.g., feedback on click, modal entry/exit, skeleton loading states) and must never be purely decorative.
2. **Performance Constraints:**
   - Animate only GPU-accelerated properties: `transform` and `opacity`.
   - Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` (causes layout reflows).
   - Durations must remain between `150ms` and `250ms` using standard easing curves (`cubic-bezier(0.4, 0, 0.2, 1)`).
3. **Accessibility (Reduced Motion):**
   - All animations must respect user preferences via the CSS media query `@media (prefers-reduced-motion: reduce)`.
   - When reduced motion is preferred, transitions must be disabled or replaced with instant opacity crossfades.

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Error Handling & Diagnostics Standards

1. **Hierarchical Error Boundaries:** Monolithic top-level error boundaries (`ErrorBoundary.tsx`) catch all unhandled errors and display generic 500 error screens (`ISSUE-002`). The application must implement granular, route-level and widget-level error boundaries so that a failure in one widget (e.g. timer widget) does not crash the entire application shell.
2. **User-Facing Feedback:** Errors must present actionable messages via Toast notifications with clear next steps.
3. **Structured Diagnostics:** Replace un-namespaced `console.log` calls with a centralized logger (`src/shared/logging/logger.ts`) supporting log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`) and contextual metadata.

