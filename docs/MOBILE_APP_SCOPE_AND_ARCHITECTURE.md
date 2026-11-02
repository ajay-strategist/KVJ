# FlowDesk Mobile Application Scope & Architecture

**Document Identifier:** DOC-MOBILE-ARCH-001  
**Version:** 2.0 (Master Authoritative Mobile Architecture & Operational Plan)  
**Status:** Approved Specification — Development Frozen During Web Rework  
**Effective Date:** 2026-11-01  
**Project:** FlowDesk (`flow-desk-main/Mobile App`)  
**Target Platform:** iOS & Android (Cross-Platform Native via React Native & Expo SDK 52)

---

## 1. Executive Summary & Mobile Strategy

The FlowDesk Mobile Application is engineered strictly as an **operational field companion** for employees, trainers, and project supervisors.

### Core Strategic Mandates
1. **Operational Focus (No Desktop Sprawl):** The mobile application intentionally avoids heavy administrative desktop workflows. Multi-page vector PDF generation, organization-wide accounting audits, bulk employee provisioning, complex schedule matrix editors, and system-wide settings remain strictly gated to desktop web browsers.
2. **Field Usability & Speed:** The mobile app prioritizes core daily field actions: clocking in with verified geolocation, tracking running tasks, quick task creation, supervisor task approvals, and rapid expense submission with mobile camera receipt capture.
3. **Task Lifecycle & Authorization Parity:** A task becomes startable on mobile strictly according to the existing approved task lifecycle and authorization rules (`BR-TASK-007`). Zero mobile bypasses of project permissions or supervisor approvals.
4. **Strict Workspace Boundary:** In compliance with project governance, **the `Mobile App/` directory remains strictly frozen and untouched during the Web application rework**.

---

## 2. Approved Operational Feature Scope

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FLOWDESK MOBILE CAPABILITIES                           │
├────────────────────────────────┬─────────────────────────────────────────────────┤
│ Attendance & Time Tracking     │ · Clock-In (GPS Location & Shift Label)          │
│                                │ · Clock-Out (End Work Session & Optional Status) │
│                                │ · Start Break / End Break (Live Timer)           │
│                                │ · View Own Attendance History & Running Timers   │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Task Management                │ · Quick Task Creation (Title, Project, Assignee) │
│                                │ · View Personal Assigned Tasks & Filter Active   │
│                                │ · Submit Completed Task for Supervisor Approval  │
│                                │ · Start/Pause Task Timer (Respects Lifecycle)    │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Project Supervision            │ · Quick Project Creation (Code, Title, Client)   │
│                                │ · Create Tasks Directly Inside Projects          │
│                                │ · Supervisor Mobile Task Approvals & Rejections  │
│                                │   (Enforces BR-TASK-007: delete draft vs close)  │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Expenses & Receipts            │ · Submit Travel & Operational Expense Claims     │
│                                │ · Direct Mobile Camera Receipt Photo Capture     │
│                                │ · Client-Side Image Compression (≤ 400KB)        │
│                                │ · Edit / Update Draft Claims                     │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Push Notifications             │ · Shift Start / End Reminders                    │
│                                │ · Task Approval & Rejection Alerts               │
│                                │ · Supervisor Pending Approval Banners            │
└────────────────────────────────┴─────────────────────────────────────────────────┘
```

### Desktop Gating Matrix: What is Excluded from Mobile
| Enterprise Capability | Web Application (Desktop) | Mobile App (Phone) | Architectural Justification |
|---|---|---|---|
| **Attendance Corrections Audit** | Full Administrative Review Queue | Excluded | Complex multi-pane side-by-side session comparisons require desktop screen real estate. |
| **Comprehensive Expense Analytics** | 15-Metric Power BI Dashboard Canvas | Excluded | Interactive 2D matrix heatmaps and cross-tab tables are unsuited for small mobile displays. |
| **Training Calendar Matrix** | Full Multi-Batch Drag-and-Drop Calendar | Excluded | High cognitive load and dense visual grid require mouse/keyboard desktop interface. |
| **Employee Lifecycle & Probation**| Provisioning, Probation End Date Edit | Excluded | Human resources governance gated strictly to Category 1 administrators on desktop. |
| **PDF & Multi-Sheet Excel Export** | Client-Side Dynamic Chunking | Excluded | Heavy export libraries (`xlsx`, `jspdf`) add unnecessary bundle weight to mobile builds. |

---

## 3. Technology Stack & Architecture Evaluation

### Existing Workspace Reality
Inspection of `flow-desk-main/Mobile App/` reveals an active, production-grade **React Native / Expo SDK 52** codebase:
- **Framework:** React Native `0.76.7` with Expo `~52.0.35`.
- **Navigation:** React Navigation v7 (`@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`).
- **Backend / Database:** `@supabase/supabase-js` `^2.49.1` (direct connection to identical Supabase cloud backend).
- **Hardware Integration:**
  - Geolocation: `expo-location` `~18.0.7` (high-accuracy GPS).
  - Camera & Media: `expo-image-picker` `~16.0.6` (receipt photos).
  - Secure Storage: `expo-secure-store` `~14.0.1` (encrypted JWT storage).

### Architecture Evaluation: React Native (Expo) vs. Flutter
| Architectural Dimension | Current React Native (Expo SDK 52) | Proposed Flutter Alternative | Architectural Assessment & Decision |
|---|---|---|---|
| **Code & Logic Sharing** | **High:** Shares TypeScript interfaces, DTOs, and Supabase query patterns directly with Web. | **Low:** Requires rewriting all models, API contracts, and business logic in Dart. | **Keep React Native / Expo:** Preserves existing codebase and minimizes rework cost. |
| **Backend Integration** | Native Supabase JavaScript SDK (`@supabase/supabase-js`) matches Web. | `supabase_flutter` SDK. | **React Native is optimal:** Identical API payloads, session tokens, and RPC patterns. |
| **Hardware Capabilities** | Expo managed modules (`expo-location`, `expo-image-picker`, `expo-secure-store`). | Flutter plugins (`geolocator`, `image_picker`). | Both provide high-grade native hardware bridges. |
| **Build & Release Pipeline** | EAS Build (Expo Application Services) with cloud provisioning. | Fastlane / Xcode / Gradle manual builds. | EAS provides turnkey automated cloud builds for iOS and Android. |

---

## 4. Engineering & Operational Infrastructure

### A. Shared API Architecture & Business Logic Feasibility
* **Direct Database Parity:** Mobile connects directly to the same Supabase PostgreSQL backend as Web.
* **Row-Level Security (RLS):** All mobile requests pass the authenticated user's JWT; PostgreSQL RLS policies enforce identical data scoping rules across Web and Mobile.
* **Shared TypeScript Contracts:** Domain interfaces (e.g. `Task`, `AttendanceRecord`, `ExpenseClaim`, `Batch`) will be extracted into a shared types package (`@flowdesk/types`) during Phase 6, ensuring zero drift between Web and Mobile data models.

### B. Automated Cloud Builds (EAS Build)
The Mobile App is configured for **EAS (Expo Application Services) Cloud Build**:
```json
{
  "scripts": {
    "start": "expo start",
    "build:android": "eas build -p android --profile preview",
    "build:ios": "eas build -p ios --profile preview"
  }
}
```
* **Android:** Builds `.aab` (Android App Bundle) for Google Play Console and `.apk` for internal enterprise distribution.
* **iOS:** Builds `.ipa` signed via Apple Developer Enterprise / Ad-Hoc provisioning profiles for TestFlight.

### C. CI/CD Pipeline
1. **Trigger:** Git push or release tag on `mobile/main`.
2. **GitHub Actions Workflow:**
   - Step 1: `npm run lint` and `tsc --noEmit`.
   - Step 2: Trigger EAS Cloud Build with secret Apple/Google provisioning keys.
   - Step 3: Automatically distribute build to internal testers via TestFlight and Google Play Internal App Sharing.

### D. Over-The-Air (OTA) Updates & Limitations
* **Engine:** `expo-updates` enables rapid Over-The-Air JavaScript bundle updates without requiring app store resubmission.
* **Critical Operational Limitations:**
  - OTA updates apply **only to JavaScript / React code and assets**.
  - Any change to native modules (e.g. updating Expo SDK, changing `app.json` native permissions, or adding native camera libraries) **cannot be shipped via OTA** and requires a full native build submission through Apple App Store and Google Play Console.
  - A runtime version mismatch guard (`runtimeVersion` in `app.json`) is mandatory to prevent incompatible JS bundles from crashing older native app shells.

### E. Push Notification Infrastructure
* **Architecture:** Expo Push Notifications integrated with Firebase Cloud Messaging (FCM v1 for Android) and Apple Push Notification service (APNs for iOS).
* **Token Lifecycle:** On user login, mobile app registers hardware device token and persists it to `flwdsk_employee_devices.push_token`.
* **Triggers:** Supabase Database Webhooks or Edge Functions dispatch notifications when:
  - Supervisor approves/rejects a task.
  - New task is assigned to an employee.
  - Shift reminder at 09:25 AM if employee is not clocked in.
  - 15-minute continuous idle alert dispatched to Admin.

---

## 5. Mobile Implementation Roadmap (Phased Execution)

> [!IMPORTANT]
> Execution of the Mobile App roadmap is **temporarily frozen** and scheduled as an independent workstream following completion of Phase 8 Master Production Acceptance for the Web application.

| Mobile Phase | Focus / Key Deliverables | Estimated Effort | Approval Gate |
|---|---|---|---|
| **Mobile Phase 1: Authentication & Time Tracking** | Clean Auth flow via Supabase; Geolocation Clock-in/Clock-out; Break management; Running task timer. | 3 Days | Tier 1 (Stakeholder Walkthrough) |
| **Mobile Phase 2: Task Operations & Approvals** | Task list; Quick Task Creation; Supervisor Task Approvals & Rejections (enforcing `BR-TASK-007`). | 3 Days | Tier 1 (Supervisor Sign-Off) |
| **Mobile Phase 3: Expense Submission & Camera** | Expense claim submission drawer; Mobile camera receipt capture; Image compression ($\le 400\text{KB}$). | 2 Days | Tier 1 (Finance Sign-Off) |
| **Mobile Phase 4: Push Notifications & EAS Release**| Expo Notification hooks; EAS production build pipeline; TestFlight & Google Play Internal App Sharing. | 2 Days | Tier 3 (Production Release) |

