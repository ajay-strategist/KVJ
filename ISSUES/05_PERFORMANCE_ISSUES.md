# Category 05: Performance Issues

This register tracks frontend re-rendering bottlenecks, large bundle splits, network waterfall delays, and excessive database queries in FlowDesk.

---

## Active Issues in Category

| Issue ID | Title | Module | Priority | Investigation Status | Fix Status | Detailed Document |
|---|---|---|---|---|---|---|
| — | *No active standalone issues currently assigned to this category* | — | — | — | — | — |

---

## Category Scope & Governance

This category encompasses:
* Large bundle chunk optimization (e.g. `BatchManagement` and main bundle chunks >500 kB).
* Unnecessary re-render cascades in high-frequency hooks (`useTaskSessions`, `useAttendance`).
* Network caching, stale-while-revalidate strategies, and query batching.

*Master index: [`ISSUES_REGISTER.md`](file:///Users/apple/Downloads/flow-desk-main/ISSUES/ISSUES_REGISTER.md).*

