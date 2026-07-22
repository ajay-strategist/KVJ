# Antigravity Prompt — Daily Training Report (UI + Structure, dummy data)

Scope for this pass: **UI and report structure only.** Dummy data is expected.
Do NOT wire repositories, do NOT implement email sending, do NOT add a backend.

---

```
Read the SHARED CONTEXT in docs/21-antigravity-prompts.md and the requirements
in docs/22-daily-report-requirements.md before writing any code.

GOAL
Build the Daily Training Report: a Report Builder modal, an on-screen preview,
and a print/PDF-ready document. Use DUMMY DATA for this pass — we are
finalising the visual structure, not the data pipeline.

════════════════════════════════════════════════════════════
1. ARCHITECTURE (non-negotiable)
════════════════════════════════════════════════════════════
Create:

  src/modules/training/report/
    daily-report.types.ts        # DailyReportData, SectionId, StudentColumnId
    daily-report.fixture.ts      # ALL dummy data lives HERE, nowhere else
    daily-report.selectors.ts    # pure maths: KPIs, eligibility, risk, buckets
    charts/                      # pure SVG chart primitives
    DailyReportBuilderModal.tsx  # section + assessment + column pickers
    DailyReportPreview.tsx       # on-screen preview + action bar
    DailyReportDocument.tsx      # the paginated document itself
    sections/                    # one file per report section

RULES
- Dummy data goes in ONE fixture module exporting `makeDailyReportFixture()`.
  Do NOT scatter hardcoded arrays inside components — that mistake already
  exists in BatchManagement.tsx and we are not repeating it. Swapping the
  fixture for real repositories later must touch ONE file.
- All maths lives in `daily-report.selectors.ts` as PURE functions taking
  DailyReportData and returning numbers/arrays. No calculations inside JSX.
- Sections are DATA-DRIVEN from a registry:
      const SECTIONS = [{ id, label, component, defaultOn }]
  The document renders `sections.filter(s => selected.includes(s.id))` in order.
  Adding a section must not require editing the document component.
- Use design tokens for the on-screen UI. The DOCUMENT uses its own FIXED print
  palette (white background, dark text) so it looks identical in Light, Dark
  and Cockpit themes.
- Dates via src/shared/utils/date.ts only. `toISOString().split('T')[0]` is
  BANNED (it returns yesterday in Asia/Kolkata).
- Gate entry with the permission engine (`can(...)`), never inline role checks.

════════════════════════════════════════════════════════════
2. REPORT BUILDER MODAL (opens on "Daily Report" — do not generate immediately)
════════════════════════════════════════════════════════════
Three groups:

A) SECTION CHECKBOXES (all default ON unless noted)
   Cover Page · Executive Summary · Batch Information · Attendance Summary ·
   Attendance Charts · Date-wise Attendance · Absent Students ·
   Student Attendance Details · Assessment Status · Assessment Charts ·
   Failed Students · Not-Attended Students · Final Exam Eligibility ·
   Eligibility Charts · Student Data · Daily Progress Analytics ·
   Student Risk Analysis · Trainer Notes (default OFF) ·
   Attachments Summary (default OFF)

B) ASSESSMENT PICKER (multi-select)
   Drives Assessment Status, Assessment Charts, Failed, Not-Attended,
   Eligibility AND the assessment columns in Student Data.
   If none selected, all of those sections are omitted entirely.
   Show each assessment's PASS MARK next to its name, and mark it "(custom)"
   when the trainer has overridden the 84% default.

C) STUDENT COLUMN PICKER for Student Data
   Register No. (Phone) · Student Name · Attendance % ·
   <one column per SELECTED assessment> · Assessment Status ·
   Final Exam Eligibility · Remarks
   Only ticked columns render. Selecting "Assessment 1" shows exactly that
   assessment's column.

Also: a Trainer Notes textarea, and persist the trainer's last selection to
localStorage.

════════════════════════════════════════════════════════════
3. KPIs — build exactly these
════════════════════════════════════════════════════════════
COVER HERO (7 tiles)
  Overall Attendance % · Assessment Progress % · Training Completion % ·
  Total Students · Present · Absent · Eligible Students

EXECUTIVE SUMMARY (rounded KPI cards)
  Total Students · Present · Absent · Attendance % ·
  Assessments Completed Today · Eligible for Final Exam · Not Eligible ·
  Pending Assessments · Pending Tasks
  (NO per-student certificate KPI — certificates are batch-level only)

ATTENDANCE SUMMARY
  Present · Absent · Attendance % · Late Entries · Early Check-outs ·
  Average Attendance · Highest Attendance · Lowest Attendance

PER SELECTED ASSESSMENT
  Total Students · Completed · Pending · Failed · Not Attempted ·
  Average Mark · Highest Mark · Lowest Mark · Pass % · Completion % ·
  Pass Mark Applied  ← always print this, it is trainer-editable

FINAL EXAM ELIGIBILITY
  Eligible · Not Eligible · Eligibility % ·
  Required Assessments (each with the pass mark applied)
  ⚠️ Attendance is NEVER shown as an eligibility criterion.

BATCH CERTIFICATE STATUS (one block, not per student)
  Printed · Delivered to College · Delivery Date · Remarks

════════════════════════════════════════════════════════════
4. VISUALS — build exactly these, all hand-rolled SVG
════════════════════════════════════════════════════════════
NO chart library. Write small SVG primitives (see app/widgets/demo-widgets.tsx
for the existing dependency-free approach). SVG keeps charts vector-sharp in
the PDF.

ATTENDANCE
  V1  Attendance Donut — Present vs Absent, % in the centre
  V2  Present vs Absent Column Chart — grouped, per session date
  V3  Date-wise Attendance Line/Trend — one point per session date;
      points BELOW 75% rendered RED with a dashed 75% reference line
  V4  Attendance % Gauge — semicircular, colour-banded

PER SELECTED ASSESSMENT
  V5  Score Distribution Histogram — buckets of 10 (0-9 … 90-100),
      with the pass mark drawn as a vertical marker line
  V6  Pass vs Fail Donut
  V7  Average Score Gauge
  V8  Completion Progress Bar — completed vs pending vs not attempted

ELIGIBILITY
  V9  Eligible vs Not Eligible Pie
  V10 Eligibility by Assessment — horizontal stacked bar, one row per
      selected assessment (passed / failed / not attempted)

PROGRESS & RISK
  V11 Completion Funnel — Enrolled → Attended → Assessed → Passed → Eligible
  V12 Daily Progress Timeline — session-by-session milestone strip
  V13 Risk Distribution — count by reason (low attendance / failed / missing)

CHART RULES (these matter for print)
- A PDF has NO hover. Every chart must carry visible data labels, a legend and
  axis labels. Never rely on tooltips to convey a value.
- Fixed print palette, colour-blind safe, and each series must still be
  distinguishable in GREYSCALE (vary fill patterns or lightness, not just hue).
- Every chart needs a title, a caption stating the source/period, and an
  accessible <title>/aria-label.
- Give charts a viewBox and no fixed pixel width so they scale on the page.
- Empty state: render "No data for this period", never a broken axis.

════════════════════════════════════════════════════════════
5. DOCUMENT STRUCTURE
════════════════════════════════════════════════════════════
PAGE FURNITURE — repeat on EVERY page
  Header: KVJ LOGO ONLY (public/logo.png) — the text "KVJ Analytics" must NOT
  appear as the title — plus "Daily Training Report", College, Course, Program,
  Academic Year, Batch, Trainer, Coordinator, Report Date.
  Footer: Generated date & time · Generated By · "Page X of Y" ·
  "Confidential — for the intended recipient only".

COVER PAGE
  Logo, "Daily Training Report", batch identity block, and the 7 hero tiles.

SECTION ORDER (render only what is selected)
  Cover → Executive Summary → Batch Information → Attendance Summary →
  Attendance Charts → Date-wise Attendance → Absent Students →
  Student Attendance Details → Assessment Status → Assessment Charts →
  Failed Students → Not-Attended Students → Final Exam Eligibility →
  Eligibility Charts → Student Data → Daily Progress Analytics →
  Risk Analysis → Trainer Notes → Attachments Summary

TABLE RULES
  - First column is always "Register No. (Phone)".
  - Date-wise Attendance rows with attendance % < 75 render RED.
  - Student Attendance Details: sortable by Attendance %, and students below
    the threshold highlighted.
  - Long tables must repeat their header row after a page break and must not
    split a row across pages.
  - NO per-student certificate column anywhere.

════════════════════════════════════════════════════════════
6. PREVIEW + ACTIONS
════════════════════════════════════════════════════════════
After building, show a full preview with an action bar:
  Preview (default) · Download PDF · Download Excel (Student Data only) ·
  Email to Coordinator · Save to Training Records · Regenerate

For THIS pass: Download PDF may use browser print-to-PDF with proper @page /
print CSS. Email, Excel and Save may be stubs that toast "not yet wired" —
but the buttons must exist and be laid out correctly.

════════════════════════════════════════════════════════════
7. DESIGN
════════════════════════════════════════════════════════════
Modern white corporate theme · premium typography with a clear type scale ·
generous executive spacing · soft section dividers · rounded KPI cards ·
consistent palette · no clutter. Target the look of Power BI / Tableau
executive output. A4 portrait, comfortable print margins.

════════════════════════════════════════════════════════════
8. DEFINITION OF DONE
════════════════════════════════════════════════════════════
- npm run typecheck, npm run lint (0 errors) and npm run build all pass.
- Toggling any section checkbox adds/removes exactly that section.
- Deselecting all assessments removes all assessment-dependent sections.
- Selecting a single assessment column shows exactly that column in Student Data.
- The document renders identically in Light, Dark and Cockpit themes.
- Browser print preview shows repeating header/footer and correct page numbers.
- Show me the builder modal, the preview, and a print preview screenshot.
```

---

## Deliberately excluded from this pass

| Excluded | Why | Covered by |
|---|---|---|
| Repository wiring | Report data is still hardcoded in `BatchManagement.tsx` | Requirements §9 blocker 2 |
| Real email + PDF attachment | `email.service.ts` is a stub with no attachment support; SMTP cannot run in a browser | Requirements §9 blocker 1 |
| Pass-mark consolidation | 84% / 70% / hardcoded 50% conflict must be fixed before eligibility numbers are trustworthy | Requirements §3.2c |
| Excel export | Needs `xlsx`; button is a stub for now | Requirements §8 |

**Important:** because the pass-mark conflict (§3.2c) is unresolved, the
eligibility figures produced in this pass are **illustrative only**. The fixture
should hardcode a plausible eligible/not-eligible split rather than pretend to
compute it from live rules.
