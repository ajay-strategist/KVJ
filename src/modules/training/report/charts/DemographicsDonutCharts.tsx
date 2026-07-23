import React from 'react';

interface GenderDonutChartProps {
  femaleCount: number;
  maleCount: number;
  totalStudents: number;
}

interface PriorKnowledgeDonutChartProps {
  learnedBeforeCount: number;
  newLearnerCount: number;
  totalStudents: number;
}

interface LaptopAvailabilityDonutChartProps {
  hasLaptopCount: number;
  noLaptopCount: number;
  totalStudents: number;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── 1. Gender Donut Chart ───────────────────────────────────────────────────
export const GenderDonutChart: React.FC<GenderDonutChartProps> = ({
  femaleCount,
  maleCount,
  totalStudents,
}) => {
  const total = femaleCount + maleCount || totalStudents || 0;
  if (total === 0) {
    return (
      <div className="report-block" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Gender Distribution</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>No student data available</div>
      </div>
    );
  }

  const femalePct = Math.round((femaleCount / total) * 100);
  const malePct = 100 - femalePct;

  const femaleStroke = (femalePct / 100) * CIRCUMFERENCE;
  const maleStroke = CIRCUMFERENCE - femaleStroke;

  return (
    <div style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>Gender Distribution</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Female vs Male Student Ratio</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
        <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0 }}>
          <title>{`Gender: ${femalePct}% Female, ${malePct}% Male`}</title>
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="16" />

          {/* Female Arc (Pink) */}
          {femaleCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#ec4899"
              strokeWidth="16"
              strokeDasharray={`${femaleStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
          )}

          {/* Male Arc (Blue) */}
          {maleCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="16"
              strokeDasharray={`${maleStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset={`-${femaleStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          <text x="50" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">
            {femalePct}%
          </text>
          <text x="50" y="61" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ec4899">
            FEMALE
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#ec4899', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>👩 Female: {femaleCount} ({femalePct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>👨 Male: {maleCount} ({malePct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 2. Prior Course Knowledge Donut Chart ──────────────────────────────────
export const PriorKnowledgeDonutChart: React.FC<PriorKnowledgeDonutChartProps> = ({
  learnedBeforeCount,
  newLearnerCount,
  totalStudents,
}) => {
  const total = learnedBeforeCount + newLearnerCount || totalStudents || 0;
  if (total === 0) {
    return (
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Prior Course Knowledge</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>No student data available</div>
      </div>
    );
  }

  const expPct = Math.round((learnedBeforeCount / total) * 100);
  const newPct = 100 - expPct;

  const expStroke = (expPct / 100) * CIRCUMFERENCE;
  const newStroke = CIRCUMFERENCE - expStroke;

  return (
    <div style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>Prior Course Knowledge</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Experienced vs New Learner</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
        <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0 }}>
          <title>{`Prior Knowledge: ${expPct}% Experienced, ${newPct}% New Learners`}</title>
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="16" />

          {/* Experienced Arc (Purple) */}
          {learnedBeforeCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="16"
              strokeDasharray={`${expStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
          )}

          {/* New Learner Arc (Amber) */}
          {newLearnerCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="16"
              strokeDasharray={`${newStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset={`-${expStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          <text x="50" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">
            {expPct}%
          </text>
          <text x="50" y="61" textAnchor="middle" fontSize="8" fontWeight="700" fill="#8b5cf6">
            PRIOR EXP
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#8b5cf6', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>📚 Experienced: {learnedBeforeCount} ({expPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>🌱 New Learner: {newLearnerCount} ({newPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 3. Laptop Availability Donut Chart ──────────────────────────────────────
export const LaptopAvailabilityDonutChart: React.FC<LaptopAvailabilityDonutChartProps> = ({
  hasLaptopCount,
  noLaptopCount,
  totalStudents,
}) => {
  const total = hasLaptopCount + noLaptopCount || totalStudents || 0;
  if (total === 0) {
    return (
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Laptop Availability</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>No student data available</div>
      </div>
    );
  }

  const hasPct = Math.round((hasLaptopCount / total) * 100);
  const noPct = 100 - hasPct;

  const hasStroke = (hasPct / 100) * CIRCUMFERENCE;
  const noStroke = CIRCUMFERENCE - hasStroke;

  return (
    <div style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#ffffff', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>Laptop Availability</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Own Laptop vs Lab Required</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
        <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0 }}>
          <title>{`Laptop: ${hasPct}% Has Laptop, ${noPct}% Requires Lab`}</title>
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="16" />

          {/* Has Laptop Arc (Sky Blue) */}
          {hasLaptopCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#0284c7"
              strokeWidth="16"
              strokeDasharray={`${hasStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
          )}

          {/* No Laptop Arc (Rose / Red) */}
          {noLaptopCount > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#e11d48"
              strokeWidth="16"
              strokeDasharray={`${noStroke} ${CIRCUMFERENCE}`}
              strokeDashoffset={`-${hasStroke}`}
              transform="rotate(-90 50 50)"
            />
          )}

          <text x="50" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">
            {hasPct}%
          </text>
          <text x="50" y="61" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0284c7">
            HAS LAPTOP
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#0284c7', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>💻 Has Laptop: {hasLaptopCount} ({hasPct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#e11d48', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>🖥️ Lab Required: {noLaptopCount} ({noPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
