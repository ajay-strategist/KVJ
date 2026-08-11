import React from 'react';
import type { DailyReportData, DailyReportConfig } from './daily-report.types';
import { SECTIONS } from './daily-report.registry';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { ReportPaginator, A4, type ReportBlock } from './ReportPaginator';

interface DailyReportDocumentProps {
  data: DailyReportData;
  config: DailyReportConfig;
}

/** Neutral, print-safe palette. No decorative icons anywhere in the chrome. */
const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const ACCENT = '#1e40af';

export const DailyReportDocument: React.FC<DailyReportDocumentProps> = ({ data, config }) => {
  const activeSections = SECTIONS.filter((s) => config.selectedSections.includes(s.id));
  const isFinalReport =
    config.reportMode === 'final' || config.selectedSections.includes('final-exam-results');

  const documentTitle = isFinalReport
    ? 'Final Course & Certification Report'
    : 'Daily Training & Intelligence Report';

  const safe = (v: unknown, fallback = '—') => {
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    return s.length > 0 ? s : fallback;
  };

  // ── Blocks: the executive summary first, then each selected section. ────────
  const blocks: ReportBlock[] = [
    {
      key: 'executive-summary',
      node: <ExecutiveSummarySection data={data} config={config} />,
    },
    ...activeSections
      .filter((sec) => sec.id !== 'executive-summary')
      .map((sec) => {
        const SectionComponent = sec.component;
        return {
          key: sec.id,
          // Major sections open on a fresh sheet, but the paginator only honours
          // this when the page already has content — so no blank pages.
          breakBefore: true,
          node: <SectionComponent data={data} config={config} />,
        } as ReportBlock;
      }),
  ];

  // ── Masthead (page 1 only) ─────────────────────────────────────────────────
  const cover = (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: 12,
          borderBottom: `2px solid ${ACCENT}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="" style={{ height: 40, width: 'auto', display: 'block' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              KVJ Analytics
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Enterprise Operations Platform
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', maxWidth: '58%' }}>
          <div
            style={{
              display: 'inline-block',
              border: `1px solid ${RULE}`,
              color: MUTED,
              fontSize: 8,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 5,
            }}
          >
            {isFinalReport ? 'Final Certification Report' : 'Daily Training Report'}
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {documentTitle}
          </h1>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: MUTED, marginTop: 3, wordBreak: 'break-word' }}>
            {safe(data.collegeName)} — {safe(data.courseName)}
          </div>
        </div>
      </div>

      {/* Identity strip: plain label/value pairs, no coloured chrome. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginTop: 12,
          paddingBottom: 12,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        {[
          ['Report Date', safe(data.reportDate)],
          ['Batch', safe(data.batchCode || data.batchName)],
          ['Academic Year', safe(data.academicYear)],
          ['Total Students', String(data.totalStudents ?? 0)],
        ].map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 7.5,
                fontWeight: 700,
                color: MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: INK, wordBreak: 'break-word', lineHeight: 1.3 }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Running header (every page after the first shows the identity band) ────
  const renderHeader = (pageNumber: number) => {
    if (pageNumber === 1) return null;
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: 6,
          marginBottom: 12,
          borderBottom: `1px solid ${RULE}`,
          fontSize: 8.5,
          color: MUTED,
        }}
      >
        <span style={{ fontWeight: 800, color: ACCENT, letterSpacing: '0.02em' }}>KVJ Analytics</span>
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
          {documentTitle}
        </span>
        <span style={{ fontWeight: 600 }}>{safe(data.batchCode || data.batchName)}</span>
      </div>
    );
  };

  // ── Numbered footer on every page ──────────────────────────────────────────
  const renderFooter = (pageNumber: number, totalPages: number) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
        borderTop: `1px solid ${RULE}`,
        fontSize: 8,
        color: MUTED,
      }}
    >
      <span>
        <strong style={{ color: ACCENT, fontWeight: 800 }}>KVJ Analytics</strong>
        <span style={{ margin: '0 5px' }}>·</span>
        Connect. Manage. Transform.
      </span>
      <span style={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Confidential</span>
      <span style={{ fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>
        Page {pageNumber} of {totalPages}
      </span>
    </div>
  );

  return (
    <div
      className="daily-report-document"
      style={{
        width: `${A4.widthMm}mm`,
        margin: '0 auto',
        color: INK,
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        /* Screen: the print copy is parked off-screen rather than display:none.
           It must stay in layout, because the paginator measures real element
           heights to decide where each page ends — inside display:none every
           height is 0 and the whole report would collapse onto one page. */
        .kvj-print-portal {
          position: absolute;
          left: -100000px;
          top: 0;
          width: ${A4.widthMm}mm;
          pointer-events: none;
        }

        /* Every page sheet on screen looks like paper. */
        .kvj-page {
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.10);
          border: 1px solid ${RULE};
          border-radius: 6px;
        }

        /* Never split a visual unit across a page boundary. */
        .kvj-block,
        .card-avoid-break,
        .chart-avoid-break,
        .section-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .kvj-block { margin-bottom: 12px; }
        .kvj-block:last-child { margin-bottom: 0; }

        /* Tabular figures keep numeric columns aligned. */
        .daily-report-document table td,
        .daily-report-document table th { font-variant-numeric: tabular-nums; }

        /* Long names/emails wrap instead of pushing a table off the page. */
        .daily-report-document table { table-layout: auto; width: 100%; }
        .daily-report-document td,
        .daily-report-document th { overflow-wrap: anywhere; word-break: break-word; }

        @media print {
          @page {
            size: A4 portrait;
            /* The page components carry their own padding, so the sheet margin
               is zero — this is what keeps the header/footer exactly where the
               paginator placed them. */
            margin: 0;
          }

          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Only the report portal prints. */
          body.kvj-printing-active > *:not(.kvj-print-portal) { display: none !important; }
          .daily-report-no-print,
          aside, nav, [class*="sidebar"], [class*="AppShell"], [class*="drawer"] {
            display: none !important;
          }

          body.kvj-printing-active .kvj-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .daily-report-document {
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* One sheet per page: no shadows, no rounding, hard page break. */
          .kvj-page {
            width: 100% !important;
            min-height: ${A4.heightMm}mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            break-after: page;
            page-break-after: always;
            break-inside: auto;
          }
          .kvj-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          /* Headings never end a page alone. */
          h1, h2, h3, h4, h5 {
            break-after: avoid;
            page-break-after: avoid;
          }
          p, li { orphans: 3; widows: 3; }

          svg, canvas, figure, img {
            break-inside: avoid;
            page-break-inside: avoid;
            max-width: 100% !important;
          }

          /* A long table repeats its header on each continuation page. */
          table { width: 100% !important; border-collapse: collapse !important; }
          thead { display: table-header-group !important; }
          tbody { display: table-row-group !important; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <ReportPaginator
        blocks={blocks}
        cover={cover}
        renderHeader={renderHeader}
        renderFooter={renderFooter}
      />
    </div>
  );
};
