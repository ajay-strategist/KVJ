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
  const isFinalReport = config.reportMode === 'final' || config.selectedSections.includes('final-exam-results');

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
        border: '1px solid #cbd5e1',
      }}
    >
      {/* Global Executive Print Style Overrides */}
      <style>{`
        /* Screen view for portal: hidden on screen, displayed only during print when body has kvj-printing-active */
        .kvj-print-portal {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }

          /* Light gray background canvas matching executive design */
          html, body {
            background: #f8fafc !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide EVERYTHING under body when in kvj-printing-active EXCEPT .kvj-print-portal */
          body.kvj-printing-active > *:not(.kvj-print-portal) {
            display: none !important;
          }

          /* Force hide explicit UI elements */
          .daily-report-no-print,
          aside, nav, [class*="sidebar"], [class*="AppShell"], [class*="drawer"] {
            display: none !important;
          }

          /* Outer canvas wrapper on print: light gray background with padding around card */
          body.kvj-printing-active .kvj-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 6mm !important;
            background: #f8fafc !important;
            box-sizing: border-box !important;
          }

          /* EXECUTIVE WHITE CARD DESIGN: Preserved in PDF print output */
          .daily-report-document {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 24px 32px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          /* Prevent orphaned headings at the bottom of pages */
          h1, h2, h3, h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Element-level break avoidance: avoid breaking inside cards, SVGs, and visual units */
          .card-avoid-break,
          .chart-avoid-break,
          .section-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 10px !important;
          }

          svg, canvas, figure {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-width: 100% !important;
          }

          /* Table print formatting */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* EXECUTIVE DOCUMENT HEADER */}
      <div style={{ borderBottom: '2px solid #1e40af', paddingBottom: 12, marginBottom: 20, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Nexus Logo" style={{ height: 44, width: 'auto', display: 'block' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Nexus <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>by KVJ</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#2563eb', marginTop: 1 }}>
                Enterprise Operations Platform
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: isFinalReport ? '#f0fdf4' : '#eff6ff', border: `1px solid ${isFinalReport ? '#86efac' : '#bfdbfe'}`, color: isFinalReport ? '#166534' : '#1e40af', fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {isFinalReport ? 'FINAL CERTIFICATION REPORT · V2.4 EXECUTIVE EDITION' : 'DAILY TRAINING INTELLIGENCE REPORT · V2.4 EXECUTIVE EDITION'}
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              {isFinalReport ? 'Final Course & Certification Report' : 'Daily Training & Intelligence Report'}
            </h1>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginTop: 2, whiteSpace: 'nowrap' }}>
              {data.collegeName} — {data.courseName}
            </div>
          </div>
        </div>

        {/* Sub-header Metadata Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            marginTop: 10,
            padding: '8px 12px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 10,
            color: '#334155',
          }}
        >
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Report Date</span>
            <strong style={{ color: '#0f172a' }}>{data.reportDate}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Batch Code</span>
            <strong style={{ color: '#2563eb' }}>{data.batchCode} ({data.batchName})</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Academic Year</span>
            <strong style={{ color: '#0f172a' }}>{data.academicYear}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Lead Trainer</span>
            <strong style={{ color: '#0f172a' }}>{data.trainerName}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9, fontWeight: 600 }}>Coordinator</span>
            <strong style={{ color: '#0f172a' }}>{data.coordinatorName}</strong>
          </div>
        </div>
      </div>

      {/* Fixed Executive Overview Section (Shown in ALL reports) */}
      <ExecutiveSummarySection data={data} config={config} />

      {/* Render Remaining Active Streamlined Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {activeSections
          .filter((sec) => sec.id !== 'executive-summary')
          .map((sec) => {
            const SectionComponent = sec.component;
            return (
              <div key={sec.id}>
                <SectionComponent data={data} config={config} />
              </div>
            );
          })}
      </div>

      {/* EXECUTIVE DOCUMENT FOOTER */}
      <div
        className="card-avoid-break"
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: '1.5px solid #cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
          color: '#64748b',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 900, color: '#1e40af' }}>Nexus by KVJ</span>
          <span>·</span>
          <span>Enterprise Operations Platform</span>
          <span>·</span>
          <span style={{ color: '#2563eb', fontWeight: 600 }}>Connect. Manage. Transform.</span>
          <span>·</span>
          <span>Developed by KVJ Analytics</span>
        </div>
        <div style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
          CONFIDENTIAL · {isFinalReport ? 'FINAL CERTIFICATION REPORT' : 'EXECUTIVE TRAINING INTELLIGENCE REPORT'}
        </div>
      </div>
    </div>
  );
};
