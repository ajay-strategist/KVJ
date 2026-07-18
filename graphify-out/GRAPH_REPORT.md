# Graph Report - D:\strategist\PSA web  (2026-05-07)

## Corpus Check
- Corpus is ~49,063 words - fits in a single context window. You may not need a graph.

## Summary
- 180 nodes · 174 edges · 73 communities (70 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Components Components|Components Components]]
- [[_COMMUNITY_Components Components|Components Components]]
- [[_COMMUNITY_Context Components|Context Components]]
- [[_COMMUNITY_Components Components|Components Components]]
- [[_COMMUNITY_Pages Components|Pages Components]]
- [[_COMMUNITY_Pages Components|Pages Components]]
- [[_COMMUNITY_Pages Components|Pages Components]]
- [[_COMMUNITY_Server Components|Server Components]]

## God Nodes (most connected - your core abstractions)
1. `useSocket()` - 15 edges
2. `FadeInSection()` - 10 edges
3. `getActiveAttendance()` - 3 edges
4. `AdminUsers()` - 3 edges
5. `Leaves()` - 3 edges
6. `WorkLog()` - 3 edges
7. `getTodayStart()` - 2 edges
8. `ensureCanStartTask()` - 2 edges
9. `DashboardLayout()` - 2 edges
10. `SocketProvider()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `ProjectManagement()` --calls--> `useSocket()`  [INFERRED]
  src/pages/ProjectManagement.jsx → src/context/SocketContext.jsx
- `DashboardLayout()` --calls--> `useSocket()`  [INFERRED]
  src/components/DashboardLayout.jsx → src/context/SocketContext.jsx
- `Chat()` --calls--> `useSocket()`  [INFERRED]
  src/pages/Chat.jsx → src/context/SocketContext.jsx
- `Dashboard()` --calls--> `useSocket()`  [INFERRED]
  src/pages/Dashboard.jsx → src/context/SocketContext.jsx
- `Projects()` --calls--> `useSocket()`  [INFERRED]
  src/pages/Projects.jsx → src/context/SocketContext.jsx

## Communities (73 total, 3 thin omitted)

### Community 1 - "Components Components"
Cohesion: 0.17
Nodes (9): DashboardLayout(), useSocket(), Chat(), Dashboard(), fmt(), Leaves(), fmtTime(), LiveTimer() (+1 more)

### Community 4 - "Pages Components"
Cohesion: 0.28
Nodes (3): AdminUsers(), formatDate(), formatHours()

### Community 5 - "Pages Components"
Cohesion: 0.38
Nodes (4): fmtTime(), formatHrsMins(), LiveTimer(), WorkLog()

### Community 6 - "Pages Components"
Cohesion: 0.4
Nodes (3): fmtTime(), LiveTimer(), ProjectManagement()

### Community 8 - "Server Components"
Cohesion: 0.83
Nodes (3): ensureCanStartTask(), getActiveAttendance(), getTodayStart()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useSocket()` connect `Components Components` to `Pages Components`, `Pages Components`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `useSocket()` (e.g. with `DashboardLayout()` and `Chat()`) actually correct?**
  _`useSocket()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `Components Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Context Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._