# FlowDesk Technical Issue Specification: ISSUE-010

**Issue Identifier:** ISSUE-010  
**Issue Title:** Database Schema Absence of Probation and Accrual Date Columns on `flwdsk_employees`  
**Module / Area:** Employee Directory / Database Migrations  
**Category:** Data & Architecture  
**Priority:** High  
**Investigation Status:** Root Cause Identified  
**Fix Status:** Open — Not Fixed  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

Approved business decision `EMP-Q01` and formal conflict resolution `DISC-001` establish that **`probation_end_date` is the sole authoritative stored value in the database** (`probation_end_date DATE NULL`). Probation Duration and Leave Accrual Start Date are **strictly derived dynamically** in application logic from `probation_end_date` and `date_of_joining`.

However, code and schema inspection reveals that the underlying table `flwdsk_employees` lacks `probation_end_date` in both `reset-and-rebuild.sql` and all existing database migrations. Any attempt to persist authoritative probation end dates in `RWK-003` without a prior schema migration will fail with PostgREST column missing errors (`PGRST204`).

---

## 2. Technical Evidence & Root Cause

* **Source File:** [`supabase/reset-and-rebuild.sql#L83-L106`](file:///Users/apple/Downloads/flow-desk-main/supabase/reset-and-rebuild.sql#L83-L106)
* **Code Trace:**
  `CREATE TABLE public.flwdsk_employees` contains fields for identity, contact, department, designation, role, and date_of_joining, but **omits**:
  - `probation_end_date` (DATE, NULLABLE)
* **Derived Fields (NOT Stored):**
  - `probation_duration`: Dynamically computed in memory from `probation_end_date - date_of_joining`.
  - `leave_accrual_start_date`: Dynamically computed from `probation_end_date` (or `date_of_joining`).
* **Impact:** 
  - `RWK-003` cannot be executed as a pure frontend task.
  - A database migration (`20261101000000_add_employee_probation_columns.sql`) adding **only `probation_end_date`** is a mandatory prerequisite before frontend binding.

---

## 3. Recommended Remediation

Author a versioned schema migration adding **only `probation_end_date DATE NULL`** to `flwdsk_employees`:
```sql
ALTER TABLE public.flwdsk_employees 
ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL;
```
Update `Employee` TypeScript interface in `src/modules/employee/employee.repository.ts` and compute `probation_duration` dynamically in getters/helpers. Do not store duration or accrual start date columns in the database.

