# FlowDesk Technical Issue Specification: ISSUE-006

**Issue Identifier:** ISSUE-006  
**Issue Title:** Dualism in Project Team Member Storage (`flwdsk_resource_allocations` vs `flwdsk_projects.member_ids`)  
**Module / Area:** Projects / Resource Scheduler  
**Category:** Data & Architecture  
**Priority:** High  
**Investigation Status:** Root Cause Identified (Linked to Decision `PROJECT-Q1`)  
**Fix Status:** Approved — Not Yet Implemented  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

FlowDesk currently maintains two divergent storage mechanisms for Project Team Memberships:
1. `flwdsk_projects.member_ids`: A JSON string array on the project entity, written to by `ProjectModal.tsx`.
2. `flwdsk_resource_allocations`: A normalized relational table recording `project_id`, `employee_id`, `role`, and `allocation_percentage`, managed by `ResourceScheduler.tsx`.

When team members are added or removed through one interface, the other storage location is not updated, causing state drift and permission confusion across project views.

---

## 2. Root Cause & Technical Details

* **Origin:** Partial migration toward resource scheduling where `flwdsk_resource_allocations` was introduced, while legacy project editing remained tied to `member_ids`.
* **Affected Files:**
  - [`src/pages/projects/ProjectModal.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/pages/projects/ProjectModal.tsx): Writes directly to `member_ids` column.
  - [`src/pages/projects/ResourceScheduler.tsx`](file:///Users/apple/Downloads/flow-desk-main/src/pages/projects/ResourceScheduler.tsx): Reads and writes `flwdsk_resource_allocations`.
  - [`src/hooks/useProject.ts`](file:///Users/apple/Downloads/flow-desk-main/src/hooks/useProject.ts): Disjoint queries depending on view context.

---

## 3. Approved Resolution (Decision PROJECT-Q1)

- **Approved Architectural Direction:**
  - `flwdsk_resource_allocations` is the single canonical source of truth for Project Membership.
  - Existing Employees must be assigned to Projects.
  - Project Members receive approved permissions to create tasks, view relevant tasks, and access relevant project reports, strictly scoped to their assigned project.
  - `flwdsk_projects.member_ids` may be deprecated only after dependency review, data validation, and migration planning.
  - Security architecture and RBAC policies must not be redesigned; existing permission scopes apply.

