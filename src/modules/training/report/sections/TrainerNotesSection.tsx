import React from 'react';
import type { SectionProps } from './CoverPageSection';

export const TrainerNotesSection: React.FC<SectionProps> = ({ data, config }) => {
  const notesText = config.trainerNotes || data.defaultTrainerNotes;

  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Lead Trainer Observations & Remarks</h2>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
        Direct qualitative notes recorded by the lead trainer for batch management.
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 14,
          fontSize: 12,
          lineHeight: 1.6,
          color: '#1e293b',
          whiteSpace: 'pre-wrap',
        }}
      >
        {notesText || 'No trainer observations recorded for today.'}
      </div>
    </div>
  );
};
