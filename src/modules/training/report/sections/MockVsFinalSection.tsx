import React from 'react';
import type { SectionProps } from './CoverPageSection';
import { selectMockVsFinalScatterData } from '../daily-report.selectors';

export const MockVsFinalSection: React.FC<SectionProps> = ({ data }) => {
  const points = selectMockVsFinalScatterData(data);
  const examMax = data.courseMaxMarks || 100;

  // Helpers to calculate SVG Scatter Plot coordinates
  const renderScatterPlot = (
    title: string,
    xLabel: string,
    yLabel: string,
    getX: (p: (typeof points)[0]) => number,
    xMin: number,
    xMax: number
  ) => {
    const width = 280;
    const height = 140;
    const padL = 35;
    const padR = 15;
    const padT = 15;
    const padB = 30;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    return (
      <div
        className="chart-avoid-break"
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 10,
          background: '#ffffff',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{title}</div>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="#cbd5e1" strokeWidth="1" />
          <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="#cbd5e1" strokeWidth="1" />

          {/* Points */}
          {points.map((pt) => {
            const rawX = getX(pt);
            const rawY = pt.finalMark;

            const cx = padL + Math.max(0, Math.min(1, (rawX - xMin) / (xMax - xMin || 1))) * plotW;
            const cy = height - padB - Math.max(0, Math.min(1, rawY / examMax)) * plotH;

            const fill = pt.status === 'Passed' ? '#22c55e' : pt.status === 'Failed' ? '#ef4444' : '#f59e0b';

            return (
              <circle
                key={pt.studentId}
                cx={cx}
                cy={cy}
                r="3.5"
                fill={fill}
                opacity="0.85"
                stroke="#ffffff"
                strokeWidth="0.5"
              >
                <title>{`${pt.studentName}: ${xLabel}=${rawX}, Final Mark=${rawY}`}</title>
              </circle>
            );
          })}

          {/* Axis Labels */}
          <text x={width / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">
            {xLabel}
          </text>
          <text
            x={10}
            y={height / 2}
            textAnchor="middle"
            fontSize="9"
            fill="#64748b"
            fontWeight="600"
            transform={`rotate(-90 10 ${height / 2})`}
          >
            {yLabel}
          </text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 9.5, marginTop: 4, color: '#475569' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} /> Passed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} /> Failed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} /> Not Attended
          </span>
        </div>
      </div>
    );
  };

  const maxMockMark = Math.max(...points.map((p) => p.mockMark), examMax);
  const maxAttempts = Math.max(...points.map((p) => p.mockAttempts), 5);
  const maxMockTime = Math.max(...points.map((p) => p.mockTime), 60);
  const maxPractice = Math.max(...points.map((p) => p.practiceTime), 50);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' }}>
      <div style={{ borderBottom: '1.5px solid #cbd5e1', paddingBottom: 6, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
          Mock Exam vs. Final Certification Performance Correlation
        </h2>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Scatter analysis evaluating relationships between preparation metrics, mock test attempts, practice duration, and final exam outcomes.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {renderScatterPlot(
          '1. Mock Mark vs. Final Exam Mark',
          'Mock Score (Marks)',
          'Final Mark',
          (p) => p.mockMark,
          0,
          maxMockMark
        )}
        {renderScatterPlot(
          '2. No. of Mock Exams vs. Final Exam Mark',
          'Mock Attempts Count',
          'Final Mark',
          (p) => p.mockAttempts,
          0,
          maxAttempts
        )}
        {renderScatterPlot(
          '3. Mock Exam Time vs. Final Exam Mark',
          'Mock Time (mins)',
          'Final Mark',
          (p) => p.mockTime,
          0,
          maxMockTime
        )}
        {renderScatterPlot(
          '4. Total Practice Time vs. Final Exam Mark',
          'Practice Hours',
          'Final Mark',
          (p) => p.practiceTime,
          0,
          maxPractice
        )}
      </div>
    </div>
  );
};
