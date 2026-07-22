import React, { useState, useEffect } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button, SectionHeader, Badge } from '../../../shared/ui/components';
import type { DailyReportData, DailyReportConfig, SectionId, StudentColumnId } from './daily-report.types';
import { SECTIONS } from './daily-report.registry';

const LOCAL_STORAGE_KEY = 'kvj_daily_report_builder_config_v1';

interface DailyReportBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DailyReportData;
  onGenerate: (config: DailyReportConfig) => void;
}

export const DailyReportBuilderModal: React.FC<DailyReportBuilderModalProps> = ({
  isOpen,
  onClose,
  data,
  onGenerate,
}) => {
  const defaultSections: SectionId[] = SECTIONS.filter((s) => s.defaultOn).map((s) => s.id);
  const defaultAssessments: string[] = data.assessments.map((a) => a.id);
  const defaultColumns: StudentColumnId[] = [
    'studentName',
    'gender',
    'hasComputer',
    'learnedBefore',
    'attendancePct',
    ...data.assessments.map((a) => a.id),
    'assessmentStatus',
    'finalExamEligibility',
  ];

  const [selectedSections, setSelectedSections] = useState<SectionId[]>(defaultSections);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>(defaultAssessments);
  const [selectedStudentColumns, setSelectedStudentColumns] = useState<StudentColumnId[]>(defaultColumns);
  const [trainerNotes, setTrainerNotes] = useState<string>(data.defaultTrainerNotes);

  // Load configuration from localStorage on open
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.selectedSections)) setSelectedSections(parsed.selectedSections);
          if (Array.isArray(parsed.selectedAssessmentIds)) setSelectedAssessmentIds(parsed.selectedAssessmentIds);
          if (Array.isArray(parsed.selectedStudentColumns)) setSelectedStudentColumns(parsed.selectedStudentColumns);
          if (typeof parsed.trainerNotes === 'string') setTrainerNotes(parsed.trainerNotes);
        }
      } catch (e) {
        console.warn('Failed to load daily report config from localStorage', e);
      }
    }
  }, [isOpen]);

  const handleToggleSection = (id: SectionId) => {
    setSelectedSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleToggleAssessment = (id: string) => {
    setSelectedAssessmentIds((prev) => {
      const next = prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id];
      
      // Sync student columns if assessment toggled
      if (!prev.includes(id)) {
        if (!selectedStudentColumns.includes(id)) {
          setSelectedStudentColumns((cols) => [...cols, id]);
        }
      } else {
        setSelectedStudentColumns((cols) => cols.filter((c) => c !== id));
      }
      return next;
    });
  };

  const handleToggleColumn = (colId: StudentColumnId) => {
    if (colId === 'registerNo') return; // Register No is mandatory
    setSelectedStudentColumns((prev) => (prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]));
  };

  const handleSelectAllSections = () => {
    setSelectedSections(SECTIONS.map((s) => s.id));
  };

  const handleDeselectAllSections = () => {
    setSelectedSections([]);
  };

  const handleGenerate = () => {
    const config: DailyReportConfig = {
      selectedSections,
      selectedAssessmentIds,
      selectedStudentColumns,
      trainerNotes,
    };

    // Save to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to persist report config', e);
    }

    onGenerate(config);
  };

  if (!isOpen) return null;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="📊 Daily Training Report Builder"
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate}>📊 Generate Daily Report Preview</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
        
        {/* Header Intro */}
        <div style={{ background: 'var(--bg-sunken)', padding: 12, borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Configure sections, assessment filters, and student table columns for <strong>{data.batchCode} ({data.collegeName})</strong>.
        </div>

        {/* GROUP A: SECTION CHECKBOXES */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionHeader title="Group A: Report Sections" />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={handleSelectAllSections} style={{ fontSize: 11 }}>Select All</Button>
              <Button size="sm" variant="ghost" onClick={handleDeselectAllSections} style={{ fontSize: 11 }}>Deselect All</Button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {SECTIONS.map((sec) => {
              const isChecked = selectedSections.includes(sec.id);
              return (
                <label
                  key={sec.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: isChecked ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleSection(sec.id)}
                  />
                  <span>{sec.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* GROUP B: ASSESSMENT PICKER */}
        <div>
          <SectionHeader title="Group B: Assessment Filter (Drives Assessment & Eligibility Sections)" />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            Deselecting all assessments omits Assessment Status, Assessment Charts, Failed/Not-Attended, and Eligibility sections.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.assessments.map((ass) => {
              const isChecked = selectedAssessmentIds.includes(ass.id);
              return (
                <label
                  key={ass.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: isChecked ? 'var(--bg-surface)' : 'var(--bg-sunken)',
                    cursor: 'pointer',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleAssessment(ass.id)}
                    />
                    <strong style={{ color: 'var(--text-primary)' }}>{ass.title}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({ass.type})</span>
                  </div>

                  <Badge tone={ass.isCustomPassMark ? 'warning' : 'success'}>
                    Pass Mark: {ass.passMarkPercent}% {ass.isCustomPassMark ? '(custom)' : '(default 84%)'}
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>

        {/* GROUP C: STUDENT COLUMN PICKER */}
        <div>
          <SectionHeader title="Group C: Student Data Table Columns" />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            First column is fixed to <strong>Register No. (Phone)</strong>. Tick additional columns to include in the Student Data table.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {/* Fixed Register No */}
            <div style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-sunken)', fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
              ✓ Register No. (Phone) [Fixed]
            </div>

            {/* Standard optional columns */}
            {[
              { id: 'studentName', label: 'Student Name' },
              { id: 'gender', label: 'Gender' },
              { id: 'hasComputer', label: 'Has Laptop' },
              { id: 'learnedBefore', label: 'Prior Experience' },
              { id: 'attendancePct', label: 'Attendance %' },
            ].map((col) => {
              const isChecked = selectedStudentColumns.includes(col.id as any);
              return (
                <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: isChecked ? 'var(--bg-surface)' : 'var(--bg-sunken)', cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={isChecked} onChange={() => handleToggleColumn(col.id as any)} />
                  <span>{col.label}</span>
                </label>
              );
            })}

            {/* Assessment Columns for selected assessments */}
            {data.assessments
              .filter((a) => selectedAssessmentIds.includes(a.id))
              .map((ass) => {
                const isChecked = selectedStudentColumns.includes(ass.id);
                return (
                  <label key={ass.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--brand)', background: isChecked ? 'var(--bg-surface)' : 'var(--bg-sunken)', cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={isChecked} onChange={() => handleToggleColumn(ass.id)} />
                    <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{ass.title} Mark</span>
                  </label>
                );
              })}

            {/* Final status columns */}
            {[
              { id: 'assessmentStatus', label: 'Assessment Status' },
              { id: 'finalExamEligibility', label: 'Final Exam Eligibility' },
            ].map((col) => {
              const isChecked = selectedStudentColumns.includes(col.id as any);
              return (
                <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: isChecked ? 'var(--bg-surface)' : 'var(--bg-sunken)', cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={isChecked} onChange={() => handleToggleColumn(col.id as any)} />
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* TRAINER NOTES TEXTAREA */}
        <div>
          <SectionHeader title="Trainer Observations & Remarks (Optional)" />
          <textarea
            className="kvj-input"
            value={trainerNotes}
            onChange={(e) => setTrainerNotes(e.target.value)}
            rows={3}
            placeholder="Enter qualitative notes regarding batch engagement, practical lab progress, or coordinator follow-ups..."
            style={{ width: '100%', fontSize: 12, padding: 10, borderRadius: 6 }}
          />
        </div>

      </div>
    </Drawer>
  );
};
