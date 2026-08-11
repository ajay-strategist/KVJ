/**
 * Vector A4 PDF builder for the Daily / Final training report.
 *
 * Real text and tables via jsPDF + jspdf-autotable (no page-image raster). The
 * output is crisp, selectable, small, paginates automatically, repeats table
 * headers, and carries a running header + numbered footer on every page.
 *
 * Driven entirely by DailyReportData + DailyReportConfig, so the numbers match
 * the on-screen preview.
 */
import { jsPDF } from 'jspdf';
import autoTable, { type RowInput, type CellHookData } from 'jspdf-autotable';
import type { DailyReportData, DailyReportConfig } from '../daily-report.types';
import {
  selectExecutiveKPIs,
  selectAttendanceKPIs,
  selectAssessmentKPIs,
  selectScoreHistogramBuckets,
  selectEligibilityKPIs,
  selectFinalExamDetailedAnalytics,
  selectDatewiseFinalExamAnalytics,
  selectToppers,
  selectCrossDemographicPerformance,
  selectMockVsFinalScatterData,
  selectDemographicBreakdowns,
} from '../daily-report.selectors';
import { PDF_THEME as T, CONTENT_W } from './reportTheme';
import { formatReportDate, formatNum, safe, truncate } from './format';

const { page: P, font: F, color: C, space: S } = T;
const RIGHT = P.widthMm - P.margin.right;
const BOTTOM = P.heightMm - P.margin.bottom;

export function buildReportPdf(data: DailyReportData, config: DailyReportConfig): jsPDF {
  const doc = new jsPDF({ orientation: P.orientation, unit: 'mm', format: P.format });
  const isFinal =
    config.reportMode === 'final' || config.selectedSections.includes('final-exam-results');
  const title = isFinal ? 'Final Course & Certification Report' : 'Daily Training & Intelligence Report';
  const sel = (id: string) => config.selectedSections.includes(id as never);

  // Final-exam pass threshold on the raw mark scale.
  const examMax = data.courseMaxMarks || 100;
  const passMarks = Math.round(((data.finalExamPassMarkPercent || 70) / 100) * examMax);

  let y = P.margin.top;

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', rgb = C.ink) => {
    doc.setFont(F.family, style);
    doc.setFontSize(size);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  };

  const newPage = () => {
    doc.addPage();
    y = P.margin.top;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  // ── Masthead (page 1 only) ────────────────────────────────────────────────
  const drawMasthead = () => {
    setFont(F.title, 'bold', C.ink);
    doc.text(title, P.margin.left, y + 4);
    setFont(F.small, 'bold', C.muted);
    doc.text('KVJ ANALYTICS  ·  ENTERPRISE OPERATIONS PLATFORM', P.margin.left, y + 9);
    setFont(F.body, 'normal', C.muted);
    doc.text(truncate(`${safe(data.collegeName)} — ${safe(data.courseName)}`, 95), P.margin.left, y + 14);
    y += 18;
    doc.setDrawColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.setLineWidth(0.6);
    doc.line(P.margin.left, y, RIGHT, y);
    y += 4;

    // Identity strip: 4 label/value pairs.
    const cells: Array<[string, string]> = [
      ['Report Date', formatReportDate(data.reportDate)],
      ['Batch', safe(data.batchCode || data.batchName)],
      ['Academic Year', safe(data.academicYear)],
      ['Total Students', formatNum(data.totalStudents)],
    ];
    const cw = CONTENT_W / 4;
    cells.forEach(([label, value], i) => {
      const x = P.margin.left + i * cw;
      setFont(F.kpiLabel, 'bold', C.muted);
      doc.text(label.toUpperCase(), x, y + 3);
      setFont(F.h3, 'bold', C.ink);
      doc.text(truncate(value, 26), x, y + 8);
    });
    y += 11;
    doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
    doc.setLineWidth(0.2);
    doc.line(P.margin.left, y, RIGHT, y);
    y += S.section;
  };

  const heading = (text: string, subtitle?: string) => {
    ensure(subtitle ? 14 : 10);
    doc.setDrawColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.rect(P.margin.left, y - 3.4, 1.4, 5, 'F');
    setFont(F.h2, 'bold', C.ink);
    doc.text(text, P.margin.left + 3.5, y);
    y += S.afterHeading + 1;
    if (subtitle) {
      setFont(F.small, 'normal', C.muted);
      doc.text(truncate(subtitle, 120), P.margin.left + 3.5, y);
      y += S.afterHeading;
    }
    y += 1.5;
  };

  // Helper for vector pie slice
  function drawPieSlice(cx: number, cy: number, radius: number, startDeg: number, endDeg: number, rgb: [number, number, number]) {
    if (startDeg >= endDeg) return;
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const points: Array<[number, number]> = [[0, 0]];
    const step = 4;
    for (let deg = startDeg; deg <= endDeg; deg += step) {
      const rad = (deg * Math.PI) / 180;
      points.push([radius * Math.cos(rad), radius * Math.sin(rad)]);
    }
    const lastRad = (endDeg * Math.PI) / 180;
    points.push([radius * Math.cos(lastRad), radius * Math.sin(lastRad)]);
    (doc as any).lines(points, cx, cy, [1, 1], 'F', true);
  }

  // KPI boxes: [label, value] across a row.
  const kpiRow = (items: Array<{ label: string; value: string; tone?: 'good' | 'bad' | 'accent' }>) => {
    if (items.length === 0) return;
    const gap = S.kpiGap;
    const bw = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const bh = 14;
    ensure(bh + 2);
    items.forEach((it, i) => {
      const x = P.margin.left + i * (bw + gap);
      doc.setFillColor(C.kpiBoxBg[0], C.kpiBoxBg[1], C.kpiBoxBg[2]);
      doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, bw, bh, 1.5, 1.5, 'FD');
      setFont(F.kpiLabel, 'bold', C.muted);
      doc.text(truncate(it.label.toUpperCase(), 26), x + 3, y + 4.5);
      const valColor = it.tone === 'good' ? C.good : it.tone === 'bad' ? C.bad : it.tone === 'accent' ? C.accent : C.ink;
      setFont(F.kpiValue, 'bold', valColor);
      doc.text(truncate(it.value, 16), x + 3, y + 11);
    });
    y += bh + S.paragraph;
  };

  // Vector Donut Card Helper
  function drawVectorDonutCard(
    x: number,
    cardY: number,
    w: number,
    h: number,
    cardTitle: string,
    cardSub: string,
    pct1: number,
    centerVal: string,
    centerLabel: string,
    color1: [number, number, number],
    color2: [number, number, number],
    legendItems: Array<{ label: string; valStr: string; color: [number, number, number] }>
  ) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, cardY, w, h, 2, 2, 'FD');

    // Header
    setFont(8, 'bold', C.ink);
    doc.text(truncate(cardTitle, 22), x + 3, cardY + 4);
    setFont(6.5, 'normal', C.muted);
    doc.text(truncate(cardSub, 25), x + 3, cardY + 7.5);

    // Donut Center
    const cx = x + 16;
    const cy = cardY + 20;
    const r = 9;

    const deg1 = (pct1 / 100) * 360;
    drawPieSlice(cx, cy, r, -90, -90 + deg1, color1);
    drawPieSlice(cx, cy, r, -90 + deg1, 270, color2);

    // Inner White Hole
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.55, 'F');

    // Center Text
    setFont(8, 'bold', C.ink);
    doc.text(centerVal, cx, cy + 0.5, { align: 'center' });
    setFont(5.5, 'bold', C.muted);
    doc.text(centerLabel, cx, cy + 3.2, { align: 'center' });

    // Legend items on right
    let legY = cardY + 13;
    legendItems.forEach((item) => {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(x + 28, legY - 2, 2.5, 2.5, 'F');
      setFont(6.5, 'bold', C.ink);
      doc.text(truncate(item.label, 14), x + 32, legY);
      setFont(6.5, 'normal', C.muted);
      doc.text(item.valStr, x + 32, legY + 3);
      legY += 7.5;
    });
  }

  // A horizontal percentage bar with a caption.
  const percentBar = (label: string, pctVal: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pctVal)));
    ensure(9);
    setFont(F.body, 'bold', C.ink);
    doc.text(label, P.margin.left, y);
    setFont(F.body, 'bold', clamped >= 75 ? C.good : C.bad);
    doc.text(`${clamped}%`, RIGHT, y, { align: 'right' });
    y += 2;
    const barW = CONTENT_W;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(P.margin.left, y, barW, 2.4, 1, 1, 'F');
    const fill = clamped >= 75 ? C.good : C.bad;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(P.margin.left, y, (barW * clamped) / 100, 2.4, 1, 1, 'F');
    y += 6;
  };

  // Autotable wrapper
  const table = (
    head: RowInput[],
    body: RowInput[],
    opts?: { colStyles?: any; onCell?: (d: CellHookData) => void; onDrawCell?: (d: CellHookData) => void },
  ) => {
    ensure(16);
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: P.margin.left, right: P.margin.right, top: P.margin.top, bottom: P.margin.bottom },
      theme: 'grid',
      styles: {
        font: F.family,
        fontSize: F.table,
        cellPadding: 1.6,
        lineColor: C.rule,
        lineWidth: 0.1,
        textColor: C.ink,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: C.tableHeadBg,
        textColor: C.tableHeadText,
        fontStyle: 'bold',
        fontSize: F.tableHead,
        lineWidth: 0.1,
      },
      alternateRowStyles: { fillColor: C.zebra },
      columnStyles: opts?.colStyles,
      didParseCell: opts?.onCell,
      didDrawCell: opts?.onDrawCell,
      didDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1) drawRunningHeader(doc, title, data);
      },
    });
    // @ts-expect-error lastAutoTable is attached at runtime
    y = (doc.lastAutoTable?.finalY ?? y) + S.paragraph;
  };

  // ── PAGE 1 ────────────────────────────────────────────────────────────────
  drawMasthead();

  // ── Executive Summary ──────────────────────────────────────────────────────
  if (sel('executive-summary')) {
    const k = selectExecutiveKPIs(data);
    const demo = selectDemographicBreakdowns(data);

    heading('Executive Summary & Batch Intelligence Overview', 'Core batch profile, enrolled strength metrics, attendance gauge, and student demographics.');

    // Top Row: 2 Cards (Enrolled Batch Strength + Overall Attendance Gauge Arc)
    const cardW = (CONTENT_W - S.kpiGap) / 2;
    const cardH = 30;
    ensure(cardH + 2);

    // Card 1: Enrolled Batch Strength
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(P.margin.left, y, cardW, cardH, 2, 2, 'FD');

    setFont(8, 'bold', C.muted);
    doc.text('ENROLLED BATCH STRENGTH', P.margin.left + 5, y + 6);
    setFont(22, 'bold', C.ink);
    doc.text(String(k.totalStudents), P.margin.left + 5, y + 17);
    setFont(10, 'bold', C.muted);
    doc.text('Enrolled Students', P.margin.left + 22, y + 17);
    setFont(7.5, 'bold', [37, 99, 235]);
    doc.text(truncate(`Active strength for batch: ${safe(data.batchCode || data.batchName)} (${safe(data.collegeName)})`, 52), P.margin.left + 5, y + 25);

    // Card 2: Overall Batch Attendance % Gauge Chart
    const rightCardX = P.margin.left + cardW + S.kpiGap;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(rightCardX, y, cardW, cardH, 2, 2, 'FD');

    setFont(8.5, 'bold', C.ink);
    doc.text('Overall Batch Attendance %', rightCardX + cardW / 2, y + 5, { align: 'center' });
    setFont(6.5, 'normal', C.muted);
    doc.text('Cumulative rate across all logged sessions', rightCardX + cardW / 2, y + 8.5, { align: 'center' });

    // Vector Gauge Arc
    const gcx = rightCardX + cardW / 2;
    const gcy = y + 22;
    const gr = 10;
    drawPieSlice(gcx, gcy, gr, 180, 360, [226, 232, 240]);
    drawPieSlice(gcx, gcy, gr, 180, 180 + (k.overallAttendancePct / 100) * 180, [16, 185, 129]);
    doc.setFillColor(255, 255, 255);
    doc.circle(gcx, gcy, gr * 0.65, 'F');
    setFont(9, 'bold', C.ink);
    doc.text(`${k.overallAttendancePct}%`, gcx, gcy - 1, { align: 'center' });
    setFont(6.5, 'bold', [16, 185, 129]);
    doc.text(k.overallAttendancePct >= 75 ? 'Excellent' : 'Attention Needed', gcx, gcy + 3.5, { align: 'center' });

    y += cardH + S.paragraph;

    // Middle Row: 3 Vector Donut Cards (Gender Distribution, Prior Course Knowledge, Laptop Availability)
    const donutW = (CONTENT_W - S.kpiGap * 2) / 3;
    const donutH = 31;
    ensure(donutH + 2);

    // Donut 1: Gender Distribution
    drawVectorDonutCard(
      P.margin.left,
      y,
      donutW,
      donutH,
      'Gender Distribution',
      'Female vs Male Student Ratio',
      k.femalePct,
      `${k.femalePct}%`,
      'FEMALE',
      [236, 72, 153],
      [59, 130, 246],
      [
        { label: 'Female', valStr: `${k.femaleCount} (${k.femalePct}%)`, color: [236, 72, 153] },
        { label: 'Male', valStr: `${k.maleCount} (${k.malePct}%)`, color: [59, 130, 246] },
      ]
    );

    // Donut 2: Prior Course Knowledge
    drawVectorDonutCard(
      P.margin.left + donutW + S.kpiGap,
      y,
      donutW,
      donutH,
      'Prior Course Knowledge',
      'Experienced vs New Learner',
      demo.learnedPct,
      `${demo.learnedPct}%`,
      'PRIOR EXP',
      [168, 85, 247],
      [245, 158, 11],
      [
        { label: 'Experienced', valStr: `${demo.learnedCount} (${demo.learnedPct}%)`, color: [168, 85, 247] },
        { label: 'New Learner', valStr: `${demo.notLearnedCount} (${demo.notLearnedPct}%)`, color: [245, 158, 11] },
      ]
    );

    // Donut 3: Laptop Availability
    drawVectorDonutCard(
      P.margin.left + (donutW + S.kpiGap) * 2,
      y,
      donutW,
      donutH,
      'Laptop Availability',
      'Own Laptop vs Lab Required',
      demo.hasLaptopPct,
      `${demo.hasLaptopPct}%`,
      'HAS LAPTOP',
      [2, 132, 199],
      [239, 68, 68],
      [
        { label: 'Has Laptop', valStr: `${demo.hasLaptop} (${demo.hasLaptopPct}%)`, color: [2, 132, 199] },
        { label: 'Lab Required', valStr: `${demo.noLaptop} (${demo.noLaptopPct}%)`, color: [239, 68, 68] },
      ]
    );

    y += donutH + S.paragraph;

    // Previous Qualification Table
    table(
      [['Previous Qualification', 'Student Count', 'Percentage Share']],
      demo.qualifications.map((q) => [safe(q.qual), formatNum(q.count), `${q.pct}%`]),
      { colStyles: { 0: { halign: 'left' }, 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 35 } } }
    );
  }

  // ── Attendance ──────────────────────────────────────────────────────────────
  if (sel('datewise-attendance')) {
    const a = selectAttendanceKPIs(data);
    heading('Attendance Log & Trends', 'Cumulative attendance and date-wise session log.');
    percentBar('Overall batch attendance', a.attendancePct);
    if (data.sessions.length > 0) {
      table(
        [['Date', 'Present', 'Absent', 'Total', 'Attendance %']],
        data.sessions.map((s) => [
          formatReportDate(s.date),
          formatNum(s.presentCount),
          formatNum(s.absentCount),
          formatNum(s.totalStudents),
          `${Math.round(s.attendancePct)}%`,
        ]),
        {
          colStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          onCell: (d) => {
            if (d.section === 'body' && d.column.index === 4) {
              const v = parseInt(String(d.cell.raw), 10);
              if (!isNaN(v) && v < 75) d.cell.styles.textColor = C.bad;
            }
          },
        }
      );
    } else {
      note('No session attendance has been logged for this batch yet.');
    }
  }

  // ── Assessment Performance ─────────────────────────────────────────────────
  if (sel('assessment-status') || sel('assessment-charts')) {
    heading('Assessment Performance', 'Per-assessment outcomes and score distribution.');
    const chosen = data.assessments.filter((as) => config.selectedAssessmentIds.includes(as.id));
    (chosen.length > 0 ? chosen : data.assessments).forEach((as) => {
      const k = selectAssessmentKPIs(data, as.id);
      ensure(10);
      setFont(F.h3, 'bold', C.ink);
      doc.text(`${safe(as.title)}  (Pass Target ${as.passMarkPercent}%)`, P.margin.left, y);
      y += 4;
      kpiRow([
        { label: 'Completed', value: `${k.completed} / ${k.totalStudents}` },
        { label: 'Passed', value: `${k.completed - k.failed} (${k.passPct}%)`, tone: 'good' },
        { label: 'Failed', value: `${k.failed}`, tone: k.failed > 0 ? 'bad' : undefined },
        { label: 'Not Attended', value: `${k.notAttempted}` },
        { label: 'Average', value: `${k.averageMark}%`, tone: 'accent' },
      ]);
      const buckets = selectScoreHistogramBuckets(data, as.id);
      const bucketTotal = buckets.reduce((sum, b) => sum + b.count, 0);
      if (bucketTotal > 0) {
        const maxCount = Math.max(...buckets.map((x) => x.count), 1);
        table(
          [['Score band (%)', 'Students', 'Distribution']],
          buckets.map((b) => [b.label, formatNum(b.count), '']),
          {
            colStyles: { 0: { halign: 'left', cellWidth: 34 }, 1: { halign: 'right', cellWidth: 26 }, 2: { halign: 'left' } },
            onDrawCell: (d) => {
              if (d.section === 'body' && d.column.index === 2) {
                const count = buckets[d.row.index]?.count ?? 0;
                const w = (d.cell.width - 4) * (count / maxCount);
                if (w > 0) {
                  doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
                  doc.roundedRect(d.cell.x + 2, d.cell.y + d.cell.height / 2 - 1, w, 2, 0.5, 0.5, 'F');
                }
              }
            },
          }
        );
      } else {
        note('No marks recorded for this assessment yet.');
      }
    });
  }

  // ── Final Exam Eligibility ─────────────────────────────────────────────────
  if (sel('final-exam-eligibility')) {
    const e = selectEligibilityKPIs(data, config.selectedAssessmentIds);
    heading('Final Exam Eligibility', 'Prerequisite clearance and remedial tracking.');
    kpiRow([
      { label: 'Eligible', value: formatNum(e.eligibleCount), tone: 'good' },
      { label: 'Not Eligible', value: formatNum(e.notEligibleCount), tone: e.notEligibleCount > 0 ? 'bad' : undefined },
      { label: 'Eligibility Rate', value: `${e.eligibilityPct}%`, tone: 'accent' },
    ]);
    const ineligible = data.students.filter((s) => s.finalExamEligibility !== 'Eligible');
    if (ineligible.length > 0) {
      table(
        [['Register No.', 'Student', 'Reason', 'Remedial Action']],
        ineligible.map((s) => [
          safe(s.phone),
          truncate(s.name, 28),
          truncate(s.eligibilityReason || 'Failed prerequisite(s)', 30),
          'Clear failed prerequisite retest',
        ]),
        { colStyles: { 0: { cellWidth: 26 }, 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left' } } }
      );
    } else {
      note('All students are eligible for the final certification exam.');
    }
  }

  // ── Final Exam Results ─────────────────────────────────────────────────────
  if (sel('final-exam-results')) {
    const fin = selectFinalExamDetailedAnalytics(data);
    const dateFin = selectDatewiseFinalExamAnalytics(data);
    const cross = selectCrossDemographicPerformance(data);

    heading('Final Exam Outcomes & Cross-Demographics', `Pass mark: ${passMarks} of ${examMax} (${data.finalExamPassMarkPercent || 70}%).`);

    kpiRow([
      { label: 'Pass Rate', value: `${fin.passPct}%`, tone: 'good' },
      { label: 'Max Mark', value: `${fin.maxMark} / ${examMax}`, tone: 'accent' },
      { label: 'Avg Mark', value: `${fin.avgMark} / ${examMax}` },
      { label: 'Exam Attempts', value: `${fin.totalAttempts}` },
    ]);

    // Batch Breakdown
    if (fin.batchBreakdown.length > 0) {
      table(
        [['Batch', 'Total', 'Passed', 'Failed', 'Not Attended', 'Pass %', 'Average Mark']],
        fin.batchBreakdown.map((b) => [
          safe(b.batch),
          formatNum(b.total),
          formatNum(b.passed),
          formatNum(b.failed),
          formatNum(b.notAttended),
          `${b.passPct}%`,
          `${b.avgMark} / ${examMax}`,
        ]),
        { colStyles: { 0: { halign: 'left' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } } }
      );
    }

    // Date-wise Exam Table
    if (dateFin.resultByDate.length > 0) {
      table(
        [['Exam Date', 'Total Exams', 'Passed', 'Failed', 'Not Attended', 'Pass %']],
        dateFin.resultByDate.map((d) => [
          formatReportDate(d.date),
          formatNum(d.total),
          formatNum(d.passed),
          formatNum(d.failed),
          formatNum(d.notAttended),
          `${d.passPct}%`,
        ]),
        { colStyles: { 0: { halign: 'left' }, 5: { halign: 'right', fontStyle: 'bold' } } }
      );
    }

    // 100% Stacked Cross-Demographics Table
    const crossRows = [
      ...cross.genderVsResult.map((r) => [`Gender: ${r.category}`, r.total, r.passed, r.failed, r.notAttended, `${r.passedPct}%`]),
      ...cross.laptopVsResult.map((r) => [`Laptop: ${r.category}`, r.total, r.passed, r.failed, r.notAttended, `${r.passedPct}%`]),
      ...cross.excelVsResult.map((r) => [`Prior Excel: ${r.category}`, r.total, r.passed, r.failed, r.notAttended, `${r.passedPct}%`]),
      ...cross.qualificationVsResult.map((r) => [`Qualification: ${r.qualification}`, r.total, r.passed, r.failed, r.notAttended, `${r.passedPct}%`]),
    ];

    table(
      [['Demographic Category', 'Total', 'Passed', 'Failed', 'Not Attended', 'Pass %']],
      crossRows.map((r) => [
        String(r[0]),
        formatNum(Number(r[1])),
        formatNum(Number(r[2])),
        formatNum(Number(r[3])),
        formatNum(Number(r[4])),
        String(r[5]),
      ]),
      { colStyles: { 0: { halign: 'left' }, 5: { halign: 'right', fontStyle: 'bold' } } }
    );
  }

  // ── Toppers Overview ───────────────────────────────────────────────────────
  if (sel('toppers-overview')) {
    const toppers = selectToppers(data);
    heading('Top Performing Students & Honor Roll', 'Priority 1: Earliest Date -> Priority 2: Highest Mark -> Priority 3: Lowest Time');

    if (toppers.top3.length > 0) {
      table(
        [['Rank', 'Student Name', 'Phone / Reg', 'Final Mark', 'Exam Time']],
        toppers.top3.map((t) => [
          `Rank ${t.rankLabel}`,
          truncate(t.student.name, 30),
          safe(t.student.phone),
          `${t.mark} / ${examMax}`,
          `${t.timeMins} mins`,
        ]),
        { colStyles: { 0: { cellWidth: 24, fontStyle: 'bold' }, 1: { halign: 'left' }, 3: { halign: 'right' } } }
      );
    }
  }

  // ── Mock vs Final Analysis ─────────────────────────────────────────────────
  if (sel('mock-vs-final')) {
    const scatterData = selectMockVsFinalScatterData(data);
    heading('Mock Exam vs. Final Performance Correlation', 'Preparation metrics and final certification exam correlation.');

    if (scatterData.length > 0) {
      table(
        [['Student', 'Mock Mark', 'Mock Attempts', 'Practice Time', 'Final Mark', 'Status']],
        scatterData.map((s) => [
          truncate(s.studentName, 26),
          `${s.mockMark} / ${examMax}`,
          formatNum(s.mockAttempts),
          `${s.practiceTime} hrs`,
          `${s.finalMark} / ${examMax}`,
          s.status,
        ]),
        {
          colStyles: { 0: { halign: 'left' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center' } },
          onCell: (d) => {
            if (d.section === 'body' && d.column.index === 5) {
              const raw = String(d.cell.raw);
              if (raw === 'Passed') d.cell.styles.textColor = C.good;
              if (raw === 'Failed') d.cell.styles.textColor = C.bad;
            }
          },
        }
      );
    }
  }

  // ── Student Performance Register ───────────────────────────────────────────
  if (sel('student-data')) {
    heading('Student Performance Register', 'Attendance, assessment and final exam records.');
    const cols = config.selectedStudentColumns;
    const showAtt = sel('datewise-attendance') && cols.includes('attendancePct');
    const chosenAss = data.assessments.filter((a) => config.selectedAssessmentIds.includes(a.id) && cols.includes(a.id));

    const head: RowInput = ['Register No.', 'Student'];
    if (cols.includes('qualification')) head.push('Qualification');
    if (showAtt) head.push('Attend %');
    chosenAss.forEach((a) => head.push(truncate(a.title, 12)));
    if (cols.includes('finalExamMark')) head.push('Final Mark');
    if (cols.includes('finalExamResult')) head.push('Result');

    const body: RowInput[] = data.students.map((s) => {
      const row: (string | number)[] = [safe(s.phone), truncate(s.name, 26)];
      if (cols.includes('qualification')) row.push(truncate(s.qualification || '—', 14));
      if (showAtt) row.push(`${s.attendancePct}%`);
      chosenAss.forEach((a) => {
        const sc = s.assessmentScores[a.id];
        row.push(!sc || !sc.attempted ? '—' : `${sc.marks}%`);
      });
      if (cols.includes('finalExamMark')) row.push(s.finalExamMark === undefined ? '—' : `${s.finalExamMark}/${examMax}`);
      if (cols.includes('finalExamResult')) {
        const isPass = s.finalExamResult ? s.finalExamResult === 'Passed' : (s.finalExamMark ?? 0) >= passMarks;
        row.push(isPass ? 'Passed' : 'Failed');
      }
      return row;
    });

    table([head], body, {
      colStyles: { 0: { cellWidth: 26 }, 1: { halign: 'left' } },
      onCell: (d) => {
        if (d.section === 'body' && String(d.cell.raw) === 'Passed') { d.cell.styles.textColor = C.good; d.cell.styles.fontStyle = 'bold'; }
        if (d.section === 'body' && String(d.cell.raw) === 'Failed') { d.cell.styles.textColor = C.bad; d.cell.styles.fontStyle = 'bold'; }
      },
    });
  }

  // ── Trainer Notes ──────────────────────────────────────────────────────────
  if (sel('trainer-notes')) {
    const notes = safe(config.trainerNotes || data.defaultTrainerNotes, 'No notes registered.');
    heading('Trainer Observations & Notes');
    setFont(F.body, 'normal', C.ink);
    const lines = doc.splitTextToSize(notes, CONTENT_W);
    lines.forEach((ln: string) => { ensure(5); doc.text(ln, P.margin.left, y); y += 4.6; });
  }

  // ── Running Header + Footer with Page Numbers ──────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) drawRunningHeader(doc, title, data);
    drawFooter(doc, p, totalPages, isFinal);
  }

  return doc;

  // ── Local Helpers ──────────────────────────────────────────────────────────
  function note(text: string) {
    ensure(7);
    setFont(F.body, 'normal', C.muted);
    doc.text(truncate(text, 140), P.margin.left, y);
    y += 6;
  }
}

/** Compact running header drawn on every continuation page. */
function drawRunningHeader(doc: jsPDF, title: string, data: DailyReportData) {
  doc.setFont(F.family, 'bold');
  doc.setFontSize(F.small);
  doc.setTextColor(C.accent[0], C.accent[1], C.accent[2]);
  doc.text('KVJ Analytics', P.margin.left, P.headerBaselineMm);
  doc.setFont(F.family, 'normal');
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text(truncate(title, 46), P.widthMm / 2, P.headerBaselineMm, { align: 'center' });
  doc.text(truncate(safe(data.batchCode || data.batchName), 30), RIGHT, P.headerBaselineMm, { align: 'right' });
  doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
  doc.setLineWidth(0.2);
  doc.line(P.margin.left, P.headerBaselineMm + 2, RIGHT, P.headerBaselineMm + 2);
}

/** Footer + accurate page numbers, drawn on every page. */
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, isFinal: boolean) {
  doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
  doc.setLineWidth(0.2);
  doc.line(P.margin.left, P.footerBaselineMm - 3, RIGHT, P.footerBaselineMm - 3);
  doc.setFontSize(F.footer);
  doc.setFont(F.family, 'bold');
  doc.setTextColor(C.accent[0], C.accent[1], C.accent[2]);
  doc.text('KVJ Analytics', P.margin.left, P.footerBaselineMm);
  doc.setFont(F.family, 'normal');
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text('Connect. Manage. Transform.', P.margin.left + 22, P.footerBaselineMm);
  doc.text('CONFIDENTIAL', P.widthMm / 2, P.footerBaselineMm, { align: 'center' });
  doc.setFont(F.family, 'bold');
  doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
  doc.text(`Page ${pageNum} of ${totalPages}`, RIGHT, P.footerBaselineMm, { align: 'right' });
}
