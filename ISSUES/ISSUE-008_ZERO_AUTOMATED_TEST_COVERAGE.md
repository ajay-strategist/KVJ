# FlowDesk Technical Issue Specification: ISSUE-008

**Issue Identifier:** ISSUE-008  
**Issue Title:** Zero Automated Test Coverage (Absence of Unit & Integration Test Harness)  
**Module / Area:** Testing & Quality Assurance / DevOps  
**Category:** Code Quality / DevOps  
**Priority:** Medium  
**Investigation Status:** Repository Gap Confirmed  
**Fix Status:** Open — Not Fixed  
**Date Documented:** 2026-10-31  

---

## 1. Executive Summary

The FlowDesk codebase currently possesses **zero automated unit or integration tests**. A review of `package.json` confirms that while TypeScript compiler verification (`tsc --noEmit`) and ESLint are present, no test runner (such as Vitest, Jest, or Playwright) is installed, configured, or integrated into CI.

---

## 2. Root Cause & Technical Details

* **Repository Finding:** `package.json` lacks dependencies for `vitest`, `@testing-library/react`, or any testing framework. No `tests/` directory or `*.test.ts(x)` files exist.
* **Risk & Impact:** Complex business calculations—such as fractional probation calculations (`BR-EMP-002`), new joiner pro-rata leave formulas (`BR-LEAVE-011`, `BR-LEAVE-013`), task worklog duration sums, and attendance break transitions—can only be verified through manual browser testing. Any regressions introduced during rework must be caught manually.

---

## 3. Recommended Remediation

1. Install and configure `vitest` in the Vite environment.
2. Author unit test suites for pure business calculation utilities:
   - `src/shared/utils/probation.ts` (Fractional probation forward and reverse calculation)
   - `src/shared/utils/leave-accrual.ts` (New joiner pro-rata leave calculation & 0.5-day rounding)
   - Task timer and attendance duration calculation helpers.
3. Integrate test execution into pre-commit and build scripts.

