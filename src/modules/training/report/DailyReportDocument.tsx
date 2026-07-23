import React from 'react';
import type { DailyReportData, DailyReportConfig } from './daily-report.types';
import { SECTIONS } from './daily-report.registry';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';

interface DailyReportDocumentProps {
  data: DailyReportData;
  config: DailyReportConfig;
}

export const DailyReportDocument: React.FC<DailyReportDocumentProps> = ({ data, config }) => {
  const activeSections = SECTIONS.filter((s) => config.selectedSections.includes(s.id));

  return (
    <div
      className="daily-report-document"
      style={{
        width: '100%',
        maxWidth: '850px',
        margin: '0 auto',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '28px 36px',
        boxSizing: 'border-box',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Global Executive Print Style Overrides */}
      <style>{`
        .kvj-print-portal { display: none; }

        @media print {
          @page {
            size: A4 portrait;
            /* Small page margin only — the running header/footer live INSIDE the
               table's thead/tfoot, which reserve their own space per page. */
            margin: 7mm;
          }

          body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body.kvj-printing-active > *:not(.kvj-print-portal) { display: none !important; }
          .daily-report-no-print,
          aside, nav, [class*="sidebar"], [class*="AppShell"] { display: none !important; }

          body.kvj-printing-active .kvj-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          .daily-report-document {
            display: block !important;
            width: 100% !important; max-width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important; border-radius: 0 !important;
            background: #ffffff !important; box-sizing: border-box !important;
          }

          /* ── Repeating header / footer ──────────────────────────────────────
             thead as table-header-group repeats at the TOP of every printed
             page; tfoot as table-footer-group repeats at the BOTTOM. This is the
             one technique Chrome's print-to-PDF honours reliably — position:fixed
             only paints on the first page. The tbody content flows between them. */
          .report-shell { width: 100%; border-collapse: collapse; }
          .report-shell > thead { display: table-header-group; }
          .report-shell > tfoot { display: table-footer-group; }
          .report-shell > thead > tr > td,
          .report-shell > tfoot > tr > td,
          .report-shell > tbody > tr > td { border: none; padding: 0; }

          /* A visual is one atomic block — never split it across a page. If it
             does not fit, the browser moves the whole thing to the next page. */
          .report-block,
          .report-section > * ,
          svg {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* Keep a section heading with the block that follows it. */
          .report-section h2 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          /* Two-up chart grids stack to one column in print so each visual
             fragments cleanly instead of a shared row being cut in half. */
          .report-chart-grid { display: block !important; }
          .report-chart-grid > * { margin-bottom: 12px !important; }

          /* Data tables: repeat their own header, never split a row. */
          .report-shell table:not(.report-shell) thead { display: table-header-group !important; }
          .report-shell tr { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      <table className="report-shell" style={{ width: '100%', borderCollapse: 'collapse' }}>
        {/* ── Running header (repeats on every printed page) ── */}
        <thead>
          <tr>
            <td style={{ padding: 0, border: 'none' }}>
              <ReportHeader data={data} />
            </td>
          </tr>
        </thead>

        {/* ── Running footer (repeats on every printed page) ── */}
        <tfoot>
          <tr>
            <td style={{ padding: 0, border: 'none' }}>
              <ReportFooter data={data} />
            </td>
          </tr>
        </tfoot>

        {/* ── Body: sections flow and paginate between header and footer ── */}
        <tbody>
          <tr>
            <td style={{ padding: 0, border: 'none' }}>
              <div className="report-section">
                <ExecutiveSummarySection data={data} config={config} />
              </div>
              {activeSections
                .filter((sec) => sec.id !== 'executive-summary')
                .map((sec) => {
                  const SectionComponent = sec.component;
                  return (
                    <div className="report-section" key={sec.id} style={{ marginTop: 18 }}>
                      <SectionComponent data={data} config={config} />
                    </div>
                  );
                })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/** Running header — logo only (no "KVJ Analytics" text title), repeated each page. */
const ReportHeader: React.FC<{ data: DailyReportData }> = ({ data }) => (
  <div style={{ borderBottom: '2px solid #1e40af', paddingBottom: 12, marginBottom: 16, background: '#ffffff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <img src="/logo.png" alt="KVJ Logo" style={{ height: 44, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-block', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          TRAINING INTELLIGENCE REPORT · V2.4 EXECUTIVE EDITION
        </div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Daily Training &amp; Intelligence Report
        </h1>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginTop: 2, whiteSpace: 'nowrap' }}>
          {data.collegeName} — {data.courseName}
        </div>
      </div>
    </div>

    <div
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 10,
        padding: '8px 12px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 10, color: '#334155',
      }}
    >
      <div><span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Report Date</span><strong style={{ color: '#0f172a' }}>{data.reportDate}</strong></div>
      <div><span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Batch Code</span><strong style={{ color: '#2563eb' }}>{data.batchCode} ({data.batchName})</strong></div>
      <div><span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Academic Year</span><strong style={{ color: '#0f172a' }}>{data.academicYear}</strong></div>
      <div><span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Lead Trainer</span><strong style={{ color: '#0f172a' }}>{data.trainerName}</strong></div>
      <div><span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Coordinator</span><strong style={{ color: '#0f172a' }}>{data.coordinatorName}</strong></div>
    </div>
  </div>
);

/** Running footer — repeated on every printed page. */
const ReportFooter: React.FC<{ data: DailyReportData }> = ({ data }) => (
  <div
    style={{
      marginTop: 16, paddingTop: 10, borderTop: '1.5px solid #cbd5e1',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 9, color: '#64748b', background: '#ffffff',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 800, color: '#1e40af' }}>KVJ Analytics</span>
      <span>·</span>
      <span>Generated on {data.reportDate} at {new Date().toLocaleTimeString()}</span>
      <span>·</span>
      <span>By {data.trainerName}</span>
    </div>
    <div style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
      CONFIDENTIAL · EXECUTIVE TRAINING INTELLIGENCE REPORT
    </div>
  </div>
);
