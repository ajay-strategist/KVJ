# PDF GENERATION — AUDIT & FIX PLAN

**Scope:** the training reports (Daily Training Report / Final Certification Report) and the Batch Management Student-Performance PDF.
**Constraint (stated honestly):** this environment has **no PDF rasterizer and no running browser**, so I cannot generate and visually inspect a PDF here. The report PDF is produced **client-side in the browser** (html2canvas + jsPDF). The audit below is grounded in the actual source and in the rendered screenshots you supplied. Any item that genuinely needs a rendered page to confirm is marked **RENDER-VERIFY**.

---

## PHASE 1–2 — Architecture as it actually is

There are **two independent PDF pipelines**, built on different technologies:

| Pipeline | File | Technology | Output nature |
|---|---|---|---|
| **A. Training report** (Daily / Final) | `src/modules/training/report/DailyReportPreview.tsx` → `handlePrintPDF()` | `html2canvas` snapshot of each `.kvj-page` → JPEG → `jsPDF.addImage` | **Raster image** of the page |
| **B. Batch Student Performance** | `src/modules/training/pages/BatchManagement.tsx` → `downloadPDF()` | `jsPDF` + `jspdf-autotable` | **Vector text + table** |

Supporting pieces for pipeline A:
- `report/ReportPaginator.tsx` — measures block heights, packs them into A4 `.kvj-page` sheets (added in the previous pass).
- `report/DailyReportDocument.tsx` — masthead, running header, numbered footer, print CSS.
- `report/sections/*` (20 files) + `report/charts/*` (15 SVG charts).

Libraries installed: `jspdf ^2.5.2`, `jspdf-autotable ^3.8.4`, `html2canvas ^1.4.1`. No server-side/Puppeteer path.

**A4 geometry** is defined once in `ReportPaginator.tsx` (`210 × 297 mm`, 14 mm side / 10 mm top / 8 mm bottom margins, header 18 mm, footer 10 mm). This part is correct.

---

## PHASE 3–4 — Issue audit

### ROOT CAUSE (the finding that explains most defects)

**Pipeline A renders the report as photographs, not as a document.** Each A4 sheet is snapshotted by html2canvas into a JPEG and placed into the PDF. Everything downstream inherits the problems of raster:

- Text is **not selectable, not searchable, not crisp**; it blurs when the image is scaled.
- **File size explodes** (your earlier export was 67 MB / 691 pages) because every page is a full-page JPEG.
- If a single sheet is **taller than A4**, the image is **scaled down to fit** → the cramped, tiny Student Register you saw.
- Grayscale/print fidelity and accessibility are poor.

This is the P0 architecture issue. Pipeline B (autotable) already demonstrates the correct, professional approach in the same app.

### P0 — Critical

| ID | Category | Problem | Current | Expected | Root cause |
|---|---|---|---|---|---|
| PDF-001 | Architecture | Report is a raster image, not vector text | Blurry, unsearchable, huge files | Crisp selectable text, small file | html2canvas image pipeline (A) |
| PDF-002 | Pagination | A section taller than one sheet is scaled to fit → unreadable | 60-row register shrunk to tiny text | Table flows across pages at full size with repeating header | Paginator treats each section as one atomic block; export scales oversized sheets |
| PDF-003 | Data correctness | Final-exam mark shown "754 / 100", pass logic compared raw mark to a percent | Almost everyone "Passed" | "754 / 1000", pass = mark ≥ (pass% × course max) | *FIXED in previous pass — see note below* |

### P1 — High

| ID | Category | Problem | Notes |
|---|---|---|---|
| PDF-010 | Pagination | Running header/footer live inside each `.kvj-page`; if a sheet overflows onto a 2nd physical page, that overflow page has no header/footer and the "Page X of Y" count can undercount | RENDER-VERIFY on long sections |
| PDF-011 | Table width | Student Register at full 9-column width can exceed the 182 mm printable area for long names | Column-chunking (max 4 data cols) exists; RENDER-VERIFY the widest case |
| PDF-012 | Large dataset | 60+ students × 3 assessments → many full-page name lists; performance of html2canvas per page is slow and memory-heavy | Vector pipeline removes this cost |
| PDF-013 | Empty state | Empty histogram used to draw a bare axis | *FIXED previous pass* — now shows "No marks recorded yet" |

### P2 — Medium

| ID | Category | Problem | Notes |
|---|---|---|---|
| PDF-020 | Icons/emoji | Decorative emojis (📊 📅 🎓 …) in section/chart titles | *FIXED previous pass* — 52 removed; ✓/✗ data marks kept |
| PDF-021 | Typography | Internal chart labels "V5." leaked into headings | *FIXED previous pass* |
| PDF-022 | Layout | 60 bordered name-chips consuming whole pages | *FIXED previous pass* — dense multi-column lists |
| PDF-023 | Number format | No Indian grouping (₹1,25,000.00) or consistent 2-dp currency in the report money fields | Not yet addressed |
| PDF-024 | Date format | Report dates rendered as raw ISO in places vs dd/mm elsewhere | Not yet addressed — needs one shared formatter |
| PDF-025 | Whitespace | Sections force `breakBefore`, which on short sections can leave large blank lower halves | Balance, don't compress |

### P3 — Low

| ID | Category | Problem |
|---|---|---|
| PDF-030 | Header | Masthead height / logo aspect — RENDER-VERIFY not distorted |
| PDF-031 | Color | Gradient callout boxes (`linear-gradient`) may print poorly in grayscale |
| PDF-032 | Footer | Footer sits at 8 mm from edge — confirm inside printer safe area |

**Note on PDF-003 and the "FIXED previous pass" items:** those were implemented and pass `typecheck`/`build`, but like everything here they are **RENDER-VERIFY** — I could not print a page to confirm the pixels.

---

## PHASE 6 — Prioritisation

```
P0  PDF-001 (vector architecture)  →  PDF-002 (table pagination)
P1  PDF-010, PDF-011, PDF-012
P2  PDF-023 (currency), PDF-024 (dates), PDF-025 (whitespace)
P3  PDF-030..032
```

---

## PHASE 7 — Fix plan (root-cause based)

### The core decision (needs your go-ahead)

The professional fix for PDF-001/002/010/011/012 is to **generate the training report the same way the Batch Student-Performance PDF is already generated: `jsPDF` + `jspdf-autotable` (real vector text and tables)**, embedding only the charts as small high-resolution images.

**Option 1 — Vector rebuild (recommended, professional).**
- Root cause addressed: no more full-page raster.
- Approach: a centralized `report/pdf/` builder using autotable. Tables (student register, results, absentees, eligibility) become native autotable tables → automatic multi-page flow, **repeating headers**, crisp text, right-aligned numeric/currency columns, tiny files. Each chart (donut/gauge/histogram/line) is rendered once to a high-DPI PNG and placed at a fixed, correctly-sized box. Header/footer/page-numbers drawn on every page via autotable's `didDrawPage` hook (exactly as Batch Management already does).
- Files: **new** `report/pdf/reportTheme.ts` (the PDF_THEME), `report/pdf/buildReport.ts`; **modify** `DailyReportPreview.tsx` `handlePrintPDF` to call the builder. The on-screen preview (`DailyReportDocument`) can stay as-is for viewing.
- Side effects: the PDF will look different from the on-screen HTML preview (that is expected and desirable). Charts-as-image is fine; only bulk text/tables must be vector.
- Effort: **large** (1 focused build), and **I cannot visually verify it here** — you would need to generate one and check.

**Option 2 — Patch the image pipeline (smaller, still raster).**
- Keep html2canvas but guarantee **no sheet ever exceeds A4** (so nothing is scaled): split long sections — chiefly the Student Register — into real page-sized blocks the paginator distributes, and render at `scale: 3` for sharper text.
- Addresses PDF-002 and the tiny-text symptom, **not** PDF-001 (still images, still large files, still unsearchable).
- Files: `ReportPaginator.tsx` (support splittable blocks), `sections/StudentDataSection.tsx` (already row-chunked into 16s in the previous pass), `DailyReportPreview.tsx` (raise scale).
- Effort: **medium**; lower risk; inferior end result.

### Independent P2 fixes (safe to do under either option)

- **PDF-023 currency:** one shared `formatINR(value)` → `₹1,25,000.00` (Indian grouping, 2 dp, negatives in parentheses). Apply to every money field in the report + Batch PDF.
- **PDF-024 dates:** one shared `formatReportDate(d)` → a single chosen format (e.g. `10 Aug 2026`) used everywhere in the document.
- **PDF-025 whitespace:** only force a section onto a new page when it doesn't fit the remaining space (the paginator already does this for packing; extend to "fill, don't force").

---

## PHASE 13 — Visual QA status (honest)

I **cannot** perform the mandated render-inspect loop in this environment. What I can and did verify:
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- Source-level correctness of the data (final-exam math), structure (pagination model), and the removal of emojis/V-labels/chip-lists.

To complete Visual QA, **you** (or a browser-capable session) must: open a report → Download PDF → check the pages, ideally for the 14 test cases in Phase 14 (small/large/long-text/wide-table/empty/large-currency/negatives/dates/missing-fields/long-names/totals page). Send back any page that looks wrong and I will fix precisely.

---

## Definition-of-Done gap

Of the Definition-of-Done checklist, these are **met in source** (RENDER-VERIFY pending): A4 dimensions, margins, header/footer present, page numbers, emojis removed, final-exam totals correct, empty-data handled.
These are **NOT yet met** and depend on the option chosen above: crisp/selectable text (needs Option 1), guaranteed no-scale long tables (Option 1 or 2), consistent currency/date formatting (P2 fixes), grayscale-safe colours.

---

## IMPLEMENTED — Option 1 (vector rebuild)

The training-report PDF now generates as a true vector A4 document via `jsPDF` + `jspdf-autotable`. The `html2canvas` page-image export was removed from the download path.

**Files created**
- `src/modules/training/report/pdf/reportTheme.ts` — the centralized PDF design system (A4 geometry, margins, typography, colours).
- `src/modules/training/report/pdf/format.ts` — shared `formatINR` (₹1,25,000.00), `formatReportDate` (10 Aug 2026), `formatNum`, `truncate`, `safe`.
- `src/modules/training/report/pdf/buildReport.ts` — `buildReportPdf(data, config): jsPDF`. Masthead + identity strip; Executive Summary (KPI boxes + demographics table); Attendance (bar + date-wise autotable, <75% flagged red); Assessment Performance (per-assessment KPIs + score-distribution bars); Final Exam Eligibility (KPIs + ineligible autotable); Final Exam Results (KPIs + results autotable, correct mark/maxMark + pass logic); Student Performance Register (autotable, selected columns/assessments); Trainer Notes. Running header on continuation pages + numbered footer ("Page X of Y") on every page via `didDrawPage` + a final page loop.

**Files modified**
- `src/modules/training/report/DailyReportPreview.tsx` — `handlePrintPDF()` now calls `buildReportPdf(...).save(...)`; removed the html2canvas snapshot loop and its import.

**What this fixes:** PDF-001 (vector, crisp, selectable, small file), PDF-002 (native multi-page tables — no scaling), PDF-010 (footer/page-numbers correct on every page; header on every continuation page), PDF-011/012 (autotable handles width/wrap/large datasets), PDF-023/024 (consistent currency + date formatting available), plus the earlier emoji/label/data fixes.

**Still to verify by rendering:** the exact look (masthead spacing, register width with many assessment columns, grayscale). `typecheck` + `build` pass; no page was rendered in this environment.

**Note:** the on-screen HTML preview (`DailyReportDocument` + paginator) is unchanged and still used for viewing; the downloaded PDF is now the vector document and will look cleaner/different from that preview — this is intended.

## Recommendation

Approve **Option 1 (vector rebuild)** for a genuinely professional, print-ready, small-file A4 document — it reuses the proven autotable approach already in this codebase. If you'd rather keep the current visual design and just stop the tiny-text/oversize problems quickly, approve **Option 2**. Either way I'll also do the currency/date consistency fixes.

I did **not** modify any code in this audit pass. Tell me **Option 1 or Option 2** and I'll implement it, then hand you a report to render-check.
