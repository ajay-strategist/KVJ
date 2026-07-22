# Daily Training Report — Requirements

Grounded in the actual codebase (not a generic spec). Read §3 first: the
supplied draft contradicts rules KVJ has already confirmed, and those
conflicts must be settled before anyone writes code.

---

## 1. Purpose

When a trainer finishes a session they generate a **Daily Training Report** for
the college coordinator: a branded, executive-quality PDF summarising the day's
attendance, assessments and student progress, previewable before sending, and
emailed **from the trainer's own address**.

Audience: College / University coordinators, corporate clients, KVJ management.

---

## 2. Codebase reality check

### 2.1 What already exists and can be reused

| Capability | Where | Notes |
|---|---|---|
| Batch record | `training.repository.ts` → `Batch` | Has `college`, `academicYear`, `batchNo`, `coordinator`, `trainerId`, `venue`, `startDate`, `endDate`, `phase`, `completedTasks`/`totalTasks` |
| Course record | `training.repository.ts` → `Course` | Has `maxMarks`, `passPercentage`, `checklist` |
| Student record | `training.repository.ts` → `Student` | `firstName`, `lastName`, `email`, `phone`, guardian fields |
| Session attendance | `SessionAttendanceRecord` | `batchId`, `sessionDate`, `studentId`, `status` (`present`/`absent`/`late`/`leave`), `arrivalTime`, `notes` |
| Assessment | `AssessmentRecord` | `enrollmentId`, `title`, `type`, `maxMarks`, `marksObtained`, `grade`, `feedback`, `evaluatedBy/At` |
| Email log | `communication.repository.ts` → `EmailLog` | `recipient`, `subject`, `body`, `status`, `retryCount`, `errorMessage` |
| Eligibility policy | `config/business-rules.ts` → `eligibility` | `passMarkPercent: 84`, `mustClearAllSelected`, `attendanceGates: false` |
| Permission engine | `shared/permissions` | Use `can(...)`; never inline role checks |
| Logo | `public/logo.png`, `public/KVJ analytics Logo.png` | Raster only — see §9 |
| Design tokens | `shared/design-system/tokens.css` | Screen UI must use tokens; the PDF needs its own fixed print palette |

### 2.2 What does NOT exist (must be built or added)

1. **No PDF library.** No `jspdf`, `pdfmake`, `react-pdf`, or print pipeline.
2. **No chart library.** Charts are hand-rolled SVG in `app/widgets/demo-widgets.tsx`.
3. **No Excel library.** No `xlsx`/`sheetjs`.
4. **No real email sending.** `shared/integration/email.service.ts` is a 47-line
   stub: it reads config from `localStorage` and `sendEmail()` only
   `console.log`s and returns `{ ok: true }`. **It has no attachment parameter.**
5. **Report data is not repository-backed.** The students, assessments,
   attendance, documents and timeline shown in Training Details are **hardcoded
   arrays inside `BatchManagement.tsx`** (`useState<StudentRecord[]>([...])`).
   A report built on these would be fiction.
6. **No report entity.** Nothing persists a generated report, its version, its
   selected sections, or its delivery record.
7. **No backend.** Supabase is configured but the database has **zero tables**,
   and all modules still resolve mock repositories.

### 2.3 Current behaviour of "Send Daily Report"

`BatchManagement.tsx` → `handleOpenComposer('Daily Session Report', 'Dear
Coordinator, Attached is the Daily Report...')` — opens an email composer with
placeholder body text. **No report is generated and nothing is attached.**

---

## 3. Conflicts with confirmed business rules — DECISIONS REQUIRED

These are the highest-value findings. The supplied draft contradicts rules KVJ
has already signed off in `business-rules.ts`.

### 3.1 ✅ RESOLVED — attendance is reported, never an eligibility gate
Confirmed: attendance is **tracked and reported in detail**, but it does **not**
gate eligibility (`eligibility.attendanceGates = false` stands).

Attendance reporting requirements:
- Per-student **attendance %** column in Student Data.
- A **date-wise attendance %** table (batch attendance % per session date).
- Any date whose attendance % is **below 75%** renders in **red**.
- A **date-wise absent-student list**.

The 75% figure is a **visual warning threshold only** — it must never appear as
an eligibility criterion. Store it as
`businessRules.attendance.lowAttendanceWarnPercent = 75` so it is configurable.

### 3.2 ✅ RESOLVED — pass marks are per-assessment and trainer-overridable
Confirmed model:

| Assessment kind | Pass mark | Editable |
|---|---|---|
| Mock Test / other assessments | **84%** (default) | ✅ trainer may change **per assessment** |
| **Final Exam** | **70%** | fixed |

If a trainer sets an assessment to 70%, that value is used **and final-exam
eligibility recomputes from it**. So the pass mark is a property of the
*assessment instance*, not a global constant.

Required config change:
```ts
eligibility: {
  defaultAssessmentPassPercent: 84,  // was passMarkPercent
  ...
},
finalExam: {
  passMarkPercent: 70,               // new
  ...
}
```
Plus `AssessmentRecord.passMarkPercent?: number` as the per-assessment override.

⚠️ **`Course.passPercentage` (seeded 70) is now ambiguous** — it duplicates the
final-exam mark and conflicts with the per-assessment override. **Decision
needed:** repurpose it explicitly as the final-exam pass mark, or remove it.

### 3.3 🟠 Final exam is external — no in-app pass/fail
`finalExam.conductedExternally = true`, `inAppExamGate = false`. The report may
show a final-exam **mark entered externally**, but must not compute pass/fail
from an in-app exam.

### 3.4 ✅ RESOLVED — certificates are external and tracked at BATCH level only
Confirmed: certificates are generated **externally**, and KVJ tracks status for
the **whole batch — not per student**.

Consequences:
- The report shows **one batch-level** certificate status block
  (`printed / deliveredToCollege / deliveryDate / remarks`).
- There is **no per-student certificate column** anywhere in the report.
- ⚠️ `StudentRecord.certificateStatus` in `BatchManagement.tsx` contradicts this
  and must be **removed** — it currently implies per-student tracking.
- The "Certificates Delivered" KPI is a batch status, not a student count.

### 3.5 🟡 "Phone Number" is the Register No.
Confirmed: **Register No. = phone number**, and it is the key used to match the
voucher Excel round-trip. Label the column **"Register No. (Phone)"** so it is
not mistaken for a contact field.

### 3.6 🟡 Assessment pass is per selected assessment
`mustClearAllSelected = true` and `assessmentsSelectedPerTraining = true`. The
trainer picks which assessments count; a student must clear **every** selected
one. The report's assessment picker (§5) and the eligibility maths must use the
**same** selection.

---

## 3b. Eligibility algorithm (now fully specified)

This is the single most business-critical calculation in the report. It must
live in `daily-report.selectors.ts` as a pure function and be unit-tested.

```
eligibleForFinalExam(student, selectedAssessments):
    for each assessment A in selectedAssessments:
        passMark = A.passMarkPercent ?? businessRules.eligibility.defaultAssessmentPassPercent  // 84
        scorePct = (A.marksObtained / A.maxMarks) * 100
        if scorePct < passMark        -> NOT ELIGIBLE
        if A.marksObtained is missing -> NOT ELIGIBLE (not attempted)
    return ELIGIBLE
```

Rules that follow from §3:
- Only the **trainer-selected** assessments count (`assessmentsSelectedPerTraining`).
- The student must clear **every** selected assessment (`mustClearAllSelected`).
- **Attendance is never consulted here.**
- The **final exam's own 70%** is a separate pass/fail on the externally-entered
  mark; it is *not* part of computing eligibility *to sit* the exam.
- The report must print, per assessment, **which pass mark was applied**, since
  the trainer can change it — otherwise a college cannot reproduce the result.

## 4. Report data contract

One resolved object assembled once per generation, then rendered. Every field
maps to a real source; anything marked ⚠️ has no source today.

```ts
interface DailyReportData {
  meta: {
    reportDate: string;        // session date being reported
    generatedAt: string;       // ISO timestamp
    generatedBy: string;       // auth user full name
    version: number;           // increments per regeneration
    sections: SectionId[];     // what the trainer selected
  };
  batch: {                     // ← Batch + Course + Employee
    college; course; program; academicYear; batchNo;
    trainer; coordinator; venue; mode; sessionNumber; ⚠️
    totalStudents; status; completionPct;
  };
  attendance: {                // ← SessionAttendanceRecord
    present; absent; late; earlyOut ⚠️; attendancePct;
    average; highest; lowest;

    /** Date-wise batch attendance. `isLow` drives the RED styling (<75%). */
    byDate: Array<{
      date; present; absent; total;
      attendancePct;
      isLow: boolean;                     // attendancePct < 75
      absentees: Array<{ registerNo; name }>;   // date-wise absent list
    }>;

    /** Per-student, cumulative across the batch. */
    students: Array<{
      registerNo; name; status; attendancePct;
      timeIn; timeOut ⚠️; trainingHours ⚠️; remarks;
    }>;
  };

  assessments: Array<{         // ← AssessmentRecord, only SELECTED ones
    id; name; totalStudents; completed; pending; failed; notAttempted;
    average; highest; lowest; passPct; completionPct;
    passMarkApplied;           // 84 default, or the trainer's override
    isOverridden: boolean;     // print when the trainer changed it
    scores: number[];          // for the histogram
  }>;

  /**
   * Student Data is COLUMN-DRIVEN. One row per student; `assessmentScores` is
   * keyed by assessment id so selecting "Assessment 1" in the builder renders
   * exactly that column and no others.
   */
  studentData: {
    columns: StudentColumnId[];          // trainer's selection
    rows: Array<{
      registerNo; name;
      attendancePct;
      assessmentScores: Record<string, number | null>;  // null = not attempted
      assessmentStatus; eligible; remarks;
    }>;
  };

  eligibility: {               // ← §3b algorithm ONLY (never attendance)
    eligible; notEligible; eligibilityPct;
    requiredAssessments: Array<{ id; name; passMarkApplied }>;
  };

  certificate: {               // ← BATCH level only, never per student
    printed; deliveredToCollege; deliveryDate; remarks;
  };

  risk: Array<{ registerNo; name; reason; suggestedAction }>;
  trainerNotes?: TrainerNotes; ⚠️ // needs persistence
  attachments?: Array<{ name; uploadedAt }>; ⚠️
}
```

⚠️ **Missing sources:** session number, time-out, training hours, early
check-outs, trainer notes, attachments. Each needs either a schema field or
removal from scope. **Decision needed per field.**

---

## 5. Functional requirements

### FR-1 Report Builder modal (replaces immediate generation)
Clicking **Daily Report** opens a builder, not a generator. It must offer:
- **Section checkboxes** — Executive Summary, Batch Information, Attendance
  Summary, Attendance Charts, Student Attendance, Assessment Status, Assessment
  Charts, Final Exam Eligibility, Student Data, Absent Students, Failed
  Students, Not-Attended Students, Risk Analysis, Feedback, Trainer Notes,
  Attachments. Only selected sections render.
- **Assessment picker** — multi-select. §5/6/7 and eligibility all derive from
  this selection. If none selected, those sections are omitted entirely.
- **Student column picker** — choose columns for §9 (Register No., Name,
  Attendance %, selected assessment marks, status, eligibility, remarks).
- **Trainer notes** — free text captured before generation.
- Selections persist per trainer (localStorage now, user prefs later).

### FR-2 Page furniture (every page)
Header: **logo only — never the text "KVJ Analytics"**, plus Daily Training
Report, College, Course, Program, Academic Year, Batch, Trainer, Coordinator,
Report Date. Footer: Generated date/time, Generated By, `Page X of Y`,
confidentiality notice.

### FR-3 Cover page
Logo, title, batch identity block, and a hero metric card: Overall Attendance %,
Assessment Progress, Training Completion %, Total / Present / Absent / Eligible.

### FR-4 Sections
As listed in the supplied draft (§1–13), **subject to §3 of this document**.
Specifically: eligibility shows assessment criteria only; certificate figures
are delivery status; "Phone Number" is labelled Register No.

### FR-5 Charts
Attendance donut, present-vs-absent column, attendance trend line, percentage
gauge; per assessment: score histogram, pass/fail donut, average gauge,
completion bar. **All SVG** so they stay vector in the PDF.

### FR-6 Actions after generation
Preview · Download PDF · Download Excel (student data only) · Email to
Coordinator · Save to Training Records · Regenerate with different sections.

### FR-7 Email workflow
Generate PDF → attach → send **from the trainer's own address** → write an
`EmailLog` row → append to Communication History with sent date, sender,
recipient, section list and **version**.

### FR-8 Permissions
Gate via the permission engine (`can('report', 'create')` / `('report','export')`).
The role model now includes **COORDINATOR** and **TRAINER** — both must be in
the permission matrix before this ships. No inline role checks.

---

## 6. Non-functional requirements

- **Correctness first.** All dates via `shared/utils/date.ts`
  (`todayISO`/`toLocalISODate`). `toISOString().split('T')[0]` is banned — it
  yields *yesterday* in Asia/Kolkata.
- **Performance.** Assemble the dataset **once** per generation and pass it down;
  no component may re-query. Student tables of 100+ rows must be virtualized on
  screen (TanStack Virtual is already a dependency). Target: report assembled in
  < 1s for 300 students.
- **Print fidelity.** A4 portrait, repeating header/footer, no section split
  across a page break mid-row, identical layout regardless of section count.
- **Design.** White corporate theme, restrained palette, rounded KPI cards, soft
  dividers. The PDF uses a **fixed print palette**, not the app's theme tokens —
  it must not change with Light/Dark/Cockpit.

---

## 7. Architecture (follow existing conventions)

```
src/modules/training/
  report/
    daily-report.types.ts       # DailyReportData, SectionId
    daily-report.builder.ts     # assemble(batchId, date, options) -> DailyReportData  (pure)
    daily-report.selectors.ts   # KPI / eligibility / risk maths          (pure, unit-testable)
    charts/                     # SVG chart primitives
    DailyReportBuilderModal.tsx # FR-1
    DailyReportDocument.tsx     # print layout, section-driven
    DailyReportPreview.tsx      # on-screen preview + actions
```

Keep the maths **pure and separate from rendering** so eligibility can be tested
without a DOM — that is where the business rules live and where mistakes are
expensive.

---

## 8. Dependencies to add

| Need | Recommendation | Why |
|---|---|---|
| PDF | `@react-pdf/renderer` *or* browser print-to-PDF | react-pdf gives true vector + page control; print CSS adds nothing to the bundle but gives weaker control |
| Excel | `xlsx` (SheetJS) | §9 export only |
| Charts | **none** — hand-rolled SVG | Matches existing `demo-widgets`, keeps charts vector, avoids a heavy dependency |

**Decision needed:** `@react-pdf/renderer` (own layout engine, best fidelity,
~1MB) vs print CSS (zero deps, uses existing components, weaker pagination).

---

## 9. Blockers

1. 🔴 **Email with attachment is impossible in the browser.** SMTP cannot run
   client-side, and `EmailService.sendEmail()` is a stub with no attachment
   support. Sending a PDF requires a server (Supabase Edge Function or similar).
   Until then: generate + preview + download works; **"Email to Coordinator"
   cannot.**
2. 🔴 **No real data.** Students/attendance/assessments are hardcoded in
   `BatchManagement.tsx`. The report must be wired to repositories first, or it
   reports fiction.
3. 🟠 **No database.** Supabase has zero tables, so "optimized queries",
   server-side aggregation and caching are not yet possible.
4. 🟡 **Logo is raster.** `logo.png` will look soft in print. An **SVG or ≥300dpi**
   logo is needed for an executive-quality PDF.

---

## 10. Suggested build order

| Phase | Work | Depends on |
|---|---|---|
| 0 | Settle §3 decisions + §8 PDF choice | — |
| 1 | Wire students/attendance/assessments to repositories | Blocker 2 |
| 2 | `daily-report.builder` + `selectors` (pure, testable) | Phase 1 |
| 3 | Builder modal (FR-1) + section registry | Phase 2 |
| 4 | Document layout, page furniture, cover, SVG charts | Phase 3 |
| 5 | Preview + Download PDF + Excel | Phase 4 |
| 6 | Email + EmailLog + Communication History + versioning | Blocker 1 (server) |

Phases 1–5 deliver a genuinely useful report (generate → preview → download).
Phase 6 needs the backend.

---

## 11. Open questions

**Answered** — attendance is reporting-only with a 75% red threshold (§3.1);
pass marks are per-assessment, 84% default and trainer-overridable, final exam
70% (§3.2); certificates are external and batch-level only (§3.4).

**Still open:**
1. **`Course.passPercentage` (seeded 70)** — repurpose as the final-exam pass
   mark, or remove it? It currently duplicates/conflicts with the new
   per-assessment override. (§3.2)
2. **Where does the trainer set an assessment's pass %?** It needs a UI in the
   assessment configuration, and the value must be **audited** — changing it
   silently changes who is eligible.
3. **Date-wise attendance %** — confirm this is the **batch** attendance % per
   session date (not per-student per-date). (§4)
4. Drop or add schema for: session number, time-out, training hours, early
   check-outs, attachments? (§4)
5. PDF engine: `@react-pdf/renderer` or print CSS? (§8)
6. Report language: English only, or bilingual for colleges?
7. Retention: how long are generated reports kept, and can a coordinator
   re-download an old version?
8. Can a **Coordinator** generate this report, or trainers/managers only? (FR-8)
