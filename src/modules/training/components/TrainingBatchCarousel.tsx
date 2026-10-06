/**
 * KVJ Analytics — Training Batch Overview Cards (Phase 2 Redesign)
 *
 * Replaces the horizontal carousel with VERTICALLY STACKED cards matching spec & user images.
 * Each card displays College, Course, Program, Academic Year, Batch No., Coordinator,
 * Trainer (in place of Venue), Start Date, End Date.
 *
 * Quick Actions: Student Data | Daily Report | Final Report | Attendance | Assessments | Certificate Receipt
 * Workflow Checklist: Styled per Image 2 with "CHECKLIST", "Show done (N)", and green check icon for complete tasks.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Batch, Course, TrainingPhase } from '../training.repository';
import { TRAINING_PHASES } from '../training.repository';
import type { Employee } from '../../employee/employee.repository';
import { Button, Badge, FilterChip, ProgressBar, SearchInput } from '../../../shared/ui/components';
import { cleanBatchCode } from '../utils/batch-formatter';

export interface BatchAction {
  id: 'daily' | 'student' | 'final' | 'attendance' | 'assessments' | 'documents' | 'expense-details';
  label: string;
  icon: string;
}

const ACTIONS: BatchAction[] = [
  { id: 'student',          label: 'Student Data',        icon: '👨‍🎓' },
  { id: 'daily',            label: 'Daily Report',        icon: '📊' },
  { id: 'documents',        label: 'Certificate Receipt', icon: '📜' },
  { id: 'expense-details',  label: 'Expense Details',     icon: '💰' },
];

/** Phase → tone map */
const PHASE_TONE: Record<TrainingPhase, { bg: string; fg: string; border: string }> = {
  'Not Started': { bg: 'var(--status-neutral-bg, rgba(148,163,184,0.14))', fg: 'var(--status-neutral, #64748b)', border: 'var(--status-neutral-border, rgba(148,163,184,0.3))' },
  Scheduled:    { bg: 'var(--status-info-bg)',     fg: 'var(--status-info)',     border: 'var(--status-info-border)' },
  Preparation:  { bg: 'var(--status-neutral-bg)',  fg: 'var(--status-neutral)',  border: 'var(--status-neutral-border)' },
  'In Progress':{ bg: 'var(--status-progress-bg)', fg: 'var(--status-progress)', border: 'var(--status-progress-border)' },
  Assessment:   { bg: 'var(--status-warning-bg)',  fg: 'var(--status-warning)',  border: 'var(--status-warning-border)' },
  Feedback:     { bg: 'var(--status-info-bg)',     fg: 'var(--status-info)',     border: 'var(--status-info-border)' },
  Certificate:  { bg: 'var(--status-purple-bg)',   fg: 'var(--status-purple)',   border: 'var(--status-purple-border)' },
  Completed:    { bg: 'var(--status-success-bg, #ecfdf5)',  fg: 'var(--status-success, #059669)',  border: 'var(--status-success-border, #a7f3d0)' },
};

export interface BatchCardVM {
  id: string;
  trainingName: string;
  /** Composed batch code shown as the card title: College-Program-AcademicYear-Batch-Course. */
  batchCode: string;
  phase: TrainingPhase;
  college: string;
  course: string;
  program: string;
  academicYear: string;
  batchNo: string;
  trainer: string;
  coordinator: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  capacity?: number;
  completedTasks: number;
  totalTasks: number;
  progress: number; // 0–100
  courseChecklist?: string[];
}

function parseDateMs(d?: string | null): number {
  if (!d || d === '—' || String(d).trim() === '') return 0;
  const ms = new Date(d).getTime();
  return isNaN(ms) ? 0 : ms;
}

function getBatchDateMs(vm: BatchCardVM): number {
  const cMs = parseDateMs(vm.createdAt);
  if (cMs > 0) return cMs;
  return parseDateMs(vm.startDate);
}

function compareDates(dateA: number, dateB: number, dir: 'asc' | 'desc'): number {
  if (dateA === 0 && dateB === 0) return 0;
  if (dateA === 0) return 1;
  if (dateB === 0) return -1;
  return dir === 'desc' ? dateB - dateA : dateA - dateB;
}

export function toCardVM(b: Batch, courses: Course[], trainers: Employee[]): BatchCardVM {
  const course = courses.find((c) => c.id === b.courseId);
  const trainer = trainers.find((t) => t.id === b.trainerId);
  const total = b.totalTasks ?? 0;
  const done  = b.completedTasks ?? 0;

  const college = b.college || (b.code?.includes('-') ? b.code.split('-')[0] : undefined) || '—';
  const courseTitle = course?.title || b.trainingName || '—';
  const program = b.program || (b as any).collegeCourse || (course as any)?.program || (b.code?.includes('-') ? b.code.split('-')[1] : undefined) || '—';
  const academicYear = b.academicYear || (b.code?.match(/20\d\d-20\d\d/)?.[0]) || '—';
  const rawBatchNo = b.batchNo && b.batchNo !== b.code ? b.batchNo : undefined;
  const batchNo = rawBatchNo || (b.code?.match(/Batch\s*\d+/i)?.[0]) || (b.code && !b.code.includes('-') ? b.code : '—');

  const parts = [college, program, academicYear, batchNo].filter((p) => p && p !== '—');
  const dynamicCode = parts.length >= 2 ? parts.join(' - ') : undefined;
  const batchCode = dynamicCode || cleanBatchCode(b.code, b.batchNo) || (b.trainingName || 'Batch');

  return {
    id:            b.id,
    trainingName:  b.trainingName || course?.title || b.code,
    batchCode,
    phase:         b.phase ?? 'Scheduled',
    college,
    course:        courseTitle,
    program,
    academicYear,
    batchNo,
    capacity:      b.capacity,
    trainer:       trainer ? `${trainer.firstName} ${trainer.lastName}` : (b as any).trainer || '—',
    coordinator:   b.coordinator || '—',
    startDate:     b.startDate || (b as any).start_date || '—',
    endDate:       b.endDate || (b as any).end_date || '—',
    createdAt:     b.createdAt || (b as any).created_at || (b.startDate && b.startDate !== '—' ? b.startDate : '') || '',
    completedTasks: done,
    totalTasks:     total,
    progress:       total > 0 ? Math.round((done / total) * 100) : 0,
    courseChecklist: course?.checklist && course.checklist.length > 0 ? course.checklist : undefined,
  };
}

const PREFS_KEY = 'kvj.batchCards.prefs.v3';
interface Prefs { pinned: string[]; favourites: string[]; hiddenChecklist: string[] }
function loadPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{"pinned":[],"favourites":[],"hiddenChecklist":[]}'); }
  catch { return { pinned: [], favourites: [], hiddenChecklist: [] }; }
}

// ── Workflow Checklist Items (per card) ────────────────────────────
interface ChecklistTask { id: string; label: string; done: boolean }

function getBatchChecklist(batchId: string, courseChecklist?: string[]): ChecklistTask[] {
  if (!courseChecklist || courseChecklist.length === 0) return [];
  return courseChecklist.map((label, idx) => ({
    id: `${batchId}-cl-${idx + 1}`,
    label,
    done: false,
  }));
}

const CHECKLIST_DONE_KEY = 'kvj.batchCards.checklistDone.v1';
function loadChecklistDoneState(batchId: string): Record<string, boolean> {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKLIST_DONE_KEY) ?? '{}');
    return all[batchId] ?? {};
  } catch { return {}; }
}
function saveChecklistDoneState(batchId: string, state: Record<string, boolean>) {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKLIST_DONE_KEY) ?? '{}');
    all[batchId] = state;
    localStorage.setItem(CHECKLIST_DONE_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

// ── Individual Batch Card Component (Side-by-Side with Right Checklist Panel) ──
const BatchCard = memo(function BatchCard({
  vm, active, pinned, favourite,
  onSelect, onTogglePin, onToggleFav, onAction, onEdit, onCopy, onDelete, onToggleComplete,
}: {
  vm: BatchCardVM;
  active: boolean;
  pinned: boolean;
  favourite: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleFav: (id: string) => void;
  onAction: (id: string, action: BatchAction) => void;
  onEdit?: (id: string) => void;
  onCopy?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string) => void;
}) {
  const [showAllChecklist, setShowAllChecklist] = useState(false);
  const [checklist, setChecklist] = useState(() => {
    const base = getBatchChecklist(vm.id, vm.courseChecklist);
    const saved = loadChecklistDoneState(vm.id);
    return base.map((t) => ({ ...t, done: saved[t.label] ?? false }));
  });

  useEffect(() => {
    const base = getBatchChecklist(vm.id, vm.courseChecklist);
    const saved = loadChecklistDoneState(vm.id);
    setChecklist(base.map((t) => ({ ...t, done: saved[t.label] ?? false })));
  }, [vm.id, vm.courseChecklist]);

  const tone = PHASE_TONE[vm.phase];

  const visibleChecklist = showAllChecklist
    ? checklist
    : checklist.filter((t) => !t.done);
  const doneCount = checklist.filter((t) => t.done).length;
  const totalCount = checklist.length;

  const toggleTask = (id: string) => {
    setChecklist((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, done: !t.done } : t);
      const stateObj: Record<string, boolean> = {};
      next.forEach((t) => { stateObj[t.label] = t.done; });
      saveChecklistDoneState(vm.id, stateObj);
      return next;
    });
  };

  const borderColor = active
    ? 'var(--brand)'
    : pinned
    ? 'rgba(245, 158, 11, 0.45)'
    : 'var(--border)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: 16,
        marginBottom: 18,
        alignItems: 'stretch',
      }}
      onClick={() => onSelect(vm.id)}
    >
      {/* ── Main Training Details Card (Left Column) ── */}
      <article
        style={{
          background: 'var(--bg-surface)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 'var(--radius-xl, 20px)',
          backdropFilter: 'blur(var(--glass-blur, 12px))',
          WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
          boxShadow: active
            ? '0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent), var(--e3)'
            : pinned
            ? '0 4px 20px rgba(245,158,11,0.12), var(--e2)'
            : 'var(--e1)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'border-color 160ms, box-shadow 200ms, transform 160ms',
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        {/* Active indicator bar */}
        {active && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: 'linear-gradient(180deg, var(--brand), var(--accent))',
            borderRadius: '16px 0 0 16px',
          }} />
        )}

        <div>
          {/* ── Header Row ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            {/* Title Block */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h3 style={{
                  margin: 0, fontSize: 16, fontWeight: 700,
                  color: 'var(--text-primary)', letterSpacing: '-0.01em',
                }}>
                  {vm.batchCode}
                </h3>
                <span style={{
                  background: tone.bg, color: tone.fg,
                  border: `1px solid ${tone.border}`,
                  fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {vm.phase}
                </span>
                {pinned && <span title="Pinned" style={{ fontSize: 13 }}>📌</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {vm.college} · {vm.batchNo} · {vm.academicYear}
              </div>
            </div>

            {/* Edit + Copy + Fav + Pin controls */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(vm.id)}
                  title="Edit Training Details"
                  style={{
                    background: 'var(--bg-sunken)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 8, color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  ✏️ Edit
                </button>
              )}
              {onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(vm.id)}
                  title="Make a Copy of Training Details Card"
                  style={{
                    background: 'var(--bg-sunken)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 8, color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  📋 Copy
                </button>
              )}
              <button
                type="button"
                aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
                onClick={() => onToggleFav(vm.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, padding: '4px 6px', borderRadius: 8,
                  color: favourite ? 'var(--status-warning)' : 'var(--text-muted)',
                }}
              >
                {favourite ? '★' : '☆'}
              </button>
              <button
                type="button"
                aria-label={pinned ? 'Unpin' : 'Pin batch'}
                onClick={() => onTogglePin(vm.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, padding: '4px 6px', borderRadius: 8,
                  opacity: pinned ? 1 : 0.35,
                }}
              >
                📌
              </button>
            </div>
          </div>

          {/* ── Details Grid (Row 1: COLLEGE, COURSE, PROGRAM, ACADEMIC YEAR, COORDINATOR | Row 2: TRAINER, START DATE, END DATE) ── */}
          <div style={{
            display: 'grid',
            // Wraps on narrow/mobile screens instead of squeezing 5 fields across.
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px 16px',
            marginBottom: 18,
          }}>
            <InfoField label="COLLEGE"       value={vm.college} />
            <InfoField label="COURSE"        value={vm.course} />
            <InfoField label="PROGRAM"       value={vm.program} />
            <InfoField label="ACADEMIC YEAR" value={vm.academicYear} />
            <InfoField label="NO. OF STUDENTS" value={vm.capacity ? `${vm.capacity} Students` : '—'} />
            <InfoField label="COORDINATOR"   value={vm.coordinator} />

            <InfoField label="TRAINER"       value={vm.trainer} />
            <InfoField label="START DATE"    value={vm.startDate} mono />
            <InfoField label="END DATE"      value={vm.endDate} mono />
          </div>

          {/* ── Workflow Completion Row ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                WORKFLOW COMPLETION
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} / {totalCount}
              </span>
            </div>
            <ProgressBar value={doneCount} max={totalCount} size="sm" />
          </div>
        </div>

        {/* ── Quick Action Buttons Row ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.label}
                onClick={(e) => { e.stopPropagation(); onAction(vm.id, a); }}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onToggleComplete && (
              <button
                type="button"
                title={vm.phase === 'Completed' ? 'Reopen this batch (set to In Progress)' : 'Close this batch (mark as Completed)'}
                onClick={(e) => { e.stopPropagation(); onToggleComplete(vm.id); }}
                style={{
                  fontSize: 12, fontWeight: 700,
                  padding: '6px 14px', borderRadius: 'var(--radius-sm, 8px)',
                  border: vm.phase === 'Completed'
                    ? '1px solid var(--border)'
                    : '1px solid var(--status-success, #10b981)',
                  background: vm.phase === 'Completed'
                    ? 'var(--bg-sunken)'
                    : 'rgba(16, 185, 129, 0.1)',
                  color: vm.phase === 'Completed'
                    ? 'var(--text-secondary)'
                    : 'var(--status-success, #059669)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 150ms',
                }}
              >
                {vm.phase === 'Completed' ? '↩️ Reopen Batch' : '✅ Close Batch'}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                title="Delete this batch permanently"
                onClick={(e) => { e.stopPropagation(); onDelete(vm.id); }}
                style={{
                  fontSize: 12, fontWeight: 700,
                  padding: '6px 14px', borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--status-danger, var(--status-danger))',
                  background: 'transparent',
                  color: 'var(--status-danger, var(--status-danger))',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--status-danger, var(--status-danger))';
                  (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--status-danger, var(--status-danger))';
                }}
              >
                🗑️ Delete Batch
              </button>
            )}
          </div>
        </div>
      </article>

      {/* ── Right Side Checklist Card Panel (Scrollable when items increase) ── */}
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'color-mix(in srgb, var(--brand) 6%, var(--bg-surface))',
          borderRadius: 'var(--radius-xl, 20px)',
          border: '1px solid var(--border)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--e1)',
          maxHeight: 280,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              CHECKLIST
            </span>
            {checklist.length > 0 && (showAllChecklist || doneCount > 0) && (
              <button
                type="button"
                onClick={() => setShowAllChecklist((s) => !s)}
                style={{
                  fontSize: 12, fontWeight: 700,
                  background: 'var(--bg-surface)', border: '1px solid var(--brand)',
                  borderRadius: 999, color: 'var(--brand)',
                  padding: '2px 10px', cursor: 'pointer',
                }}
              >
                {showAllChecklist ? 'Hide done' : `Show done (${doneCount})`}
              </button>
            )}
          </div>

          {checklist.length === 0 ? (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)',
              textAlign: 'center', padding: '20px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <span>No checklist configured.<br />Add tasks in <strong>Course Catalog</strong>.</span>
            </div>
          ) : visibleChecklist.length === 0 ? (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)',
              textAlign: 'center', padding: '20px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 22 }}>🎉</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>All checklist tasks completed!</span>
              <button
                type="button"
                onClick={() => setShowAllChecklist(true)}
                style={{
                  background: 'none', border: 'none', color: 'var(--brand)',
                  cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, marginTop: 4,
                  fontWeight: 600,
                }}
              >
                View completed tasks ({doneCount})
              </button>
            </div>
          ) : (
            <ul style={{
              listStyle: 'none', margin: 0, padding: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
              overflowY: 'auto', maxHeight: 210, paddingRight: 4,
            }}>
              {visibleChecklist.map((task) => (
                <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    style={{
                      width: 20, height: 20, flexShrink: 0,
                      borderRadius: 5,
                      border: task.done ? 'none' : '1.5px solid var(--border)',
                      background: task.done ? 'var(--status-success, var(--status-success))' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                      padding: 0,
                    }}
                  >
                    {task.done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </button>
                  <span style={{
                    fontSize: 12,
                    color: task.done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: task.done ? 'line-through' : 'none',
                    fontWeight: task.done ? 500 : 600,
                    lineHeight: 1.3,
                  }}>
                    {task.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
});

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Batch Overview List (vertical, virtualized) ─────────────────────────────
const PREFS_KEY_STORE = 'kvj.batchCards.prefs.v3';

export function TrainingBatchCarousel({
  batches, courses, trainers, activeId, onSelect, onAction, onEdit, onCopy, onDelete, onToggleComplete,
}: {
  batches: Batch[];
  courses: Course[];
  trainers: Employee[];
  activeId: string;
  onSelect: (id: string) => void;
  onAction: (batchId: string, action: BatchAction) => void;
  onEdit?: (batchId: string) => void;
  onCopy?: (batchId: string) => void;
  onDelete?: (batchId: string) => void;
  onToggleComplete?: (batchId: string) => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [query, setQuery] = useState('');
  const [fCollege, setFCollege] = useState('all');
  const [fPhase, setFPhase] = useState('active');
  const [fCourse, setFCourse] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'progress' | 'name'>('newest');

  const vms = useMemo(() => batches.map((b) => toCardVM(b, courses, trainers)), [batches, courses, trainers]);

  const completedCount = useMemo(() => vms.filter((v) => v.phase === 'Completed').length, [vms]);
  const notStartedCount = useMemo(() => vms.filter((v) => v.phase === 'Not Started' || v.phase === 'Scheduled' || v.phase === 'Preparation').length, [vms]);
  const inProgressCount = useMemo(() => vms.filter((v) => v.phase === 'In Progress' || v.phase === 'Assessment' || v.phase === 'Feedback' || v.phase === 'Certificate').length, [vms]);
  const activeCount = useMemo(() => vms.filter((v) => v.phase !== 'Completed').length, [vms]);

  const filterOptions = useMemo(() => ({
    colleges: [...new Set(vms.map((v) => v.college))].sort(),
    courses:  [...new Set(vms.map((v) => v.course))].sort(),
    phases:   TRAINING_PHASES,
  }), [vms]);

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = vms.filter((v) => {
      if (q && !`${v.trainingName} ${v.college} ${v.batchNo} ${v.course} ${v.trainer} ${v.coordinator}`.toLowerCase().includes(q)) return false;
      if (fCollege !== 'all' && v.college !== fCollege) return false;
      if (fCourse !== 'all' && v.course !== fCourse) return false;

      if (fPhase === 'active') {
        // Default: show only In Progress and Not Started batches (hide Completed)
        if (v.phase === 'Completed') return false;
      } else if (fPhase === 'Not Started') {
        if (v.phase !== 'Not Started' && v.phase !== 'Scheduled' && v.phase !== 'Preparation') return false;
      } else if (fPhase === 'In Progress') {
        if (v.phase !== 'In Progress' && v.phase !== 'Assessment' && v.phase !== 'Feedback' && v.phase !== 'Certificate') return false;
      } else if (fPhase === 'Completed') {
        if (v.phase !== 'Completed') return false;
      } else if (fPhase !== 'all') {
        if (v.phase !== fPhase) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'oldest': {
          const diff = compareDates(getBatchDateMs(a), getBatchDateMs(b), 'asc');
          if (diff !== 0) return diff;
          return (a.batchCode || a.trainingName).localeCompare(b.batchCode || b.trainingName);
        }
        case 'progress': {
          const diff = b.progress - a.progress;
          if (diff !== 0) return diff;
          return compareDates(getBatchDateMs(a), getBatchDateMs(b), 'desc');
        }
        case 'name':
          return (a.batchCode || a.trainingName).localeCompare(b.batchCode || b.trainingName);
        case 'newest':
        default: {
          const diff = compareDates(getBatchDateMs(a), getBatchDateMs(b), 'desc');
          if (diff !== 0) return diff;
          return (a.batchCode || a.trainingName).localeCompare(b.batchCode || b.trainingName);
        }
      }
    });

    const pinnedSet = new Set(prefs.pinned);
    return [...sorted.filter((v) => pinnedSet.has(v.id)), ...sorted.filter((v) => !pinnedSet.has(v.id))];
  }, [vms, query, fCollege, fPhase, fCourse, sort, prefs.pinned]);

  const togglePin = useCallback((id: string) => {
    setPrefs((p) => {
      const next = { ...p, pinned: p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [...p.pinned, id] };
      try { localStorage.setItem(PREFS_KEY_STORE, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const toggleFav = useCallback((id: string) => {
    setPrefs((p) => {
      const next = { ...p, favourites: p.favourites.includes(id) ? p.favourites.filter((x) => x !== id) : [...p.favourites, id] };
      try { localStorage.setItem(PREFS_KEY_STORE, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const selectStyle: React.CSSProperties = {
    fontSize: 12.5, padding: '7px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--bg-sunken)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
    outline: 'none', cursor: 'pointer',
  };

  return (
    <section style={{ marginBottom: 16 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search batch, college, trainer…"
          style={{ minWidth: 220, flex: '1 1 220px' }}
        />
        <select aria-label="Filter by college" value={fCollege} onChange={(e) => setFCollege(e.target.value)} style={selectStyle}>
          <option value="all">All Colleges</option>
          {filterOptions.colleges.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by course" value={fCourse} onChange={(e) => setFCourse(e.target.value)} style={selectStyle}>
          <option value="all">All Courses</option>
          {filterOptions.courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by status" value={fPhase} onChange={(e) => setFPhase(e.target.value)} style={selectStyle}>
          <option value="active">Active (In Progress & Not Started) ({activeCount})</option>
          <option value="all">All Batches ({vms.length})</option>
          <option value="In Progress">In Progress ({inProgressCount})</option>
          <option value="Not Started">Not Started ({notStartedCount})</option>
          <option value="Completed">Completed ({completedCount})</option>
          {filterOptions.phases
            .filter((p) => !['In Progress', 'Not Started', 'Completed'].includes(p))
            .map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Sort batches" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={selectStyle}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="progress">Progress</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {/* ── Batch count summary ── */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Showing {visibleList.length} of {vms.length} batch{vms.length === 1 ? '' : 'es'}
        {fPhase === 'active' && completedCount > 0 && ` (${completedCount} completed hidden)`}
        {prefs.pinned.length > 0 && ` · ${prefs.pinned.length} pinned`}
        {prefs.favourites.length > 0 && ` · ${prefs.favourites.length} starred`}
      </div>

      {/* ── Card List ── */}
      {visibleList.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>No batches found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            {query ? 'Try adjusting your search or filters.' : 'No training batches match the selected filter.'}
          </div>
        </div>
      ) : (
        <div>
          {visibleList.map((vm) => (
            <BatchCard
              key={vm.id}
              vm={vm}
              active={vm.id === activeId}
              pinned={prefs.pinned.includes(vm.id)}
              favourite={prefs.favourites.includes(vm.id)}
              onSelect={onSelect}
              onTogglePin={togglePin}
              onToggleFav={toggleFav}
              onAction={onAction}
              onEdit={onEdit}
              onCopy={onCopy}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TrainingBatchCarousel;
