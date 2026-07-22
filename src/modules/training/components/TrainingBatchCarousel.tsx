/**
 * Training Batch Overview Carousel
 *
 * A horizontally scrollable set of premium overview cards — one per assigned
 * training batch — replacing the single Training Batch Overview panel.
 * Selecting a card sets the active batch for the whole workspace; nothing
 * navigates away.
 *
 * Performance: the track is HORIZONTALLY VIRTUALIZED. Only the cards inside
 * the viewport (plus a small overscan) are mounted, so 100+ batches cost the
 * same as a handful. Cards are memoised so scrolling never re-renders them.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Batch, Course, TrainingPhase } from '../training.repository';
import { TRAINING_PHASES } from '../training.repository';
import type { Employee } from '../../employee/employee.repository';

export interface BatchAction {
  id: 'daily' | 'student' | 'final' | 'attendance' | 'assessments' | 'documents';
  label: string;
  icon: string;
}

const ACTIONS: BatchAction[] = [
  { id: 'daily', label: 'Send Daily Report', icon: '📧' },
  { id: 'student', label: 'Student Report', icon: '👨‍🎓' },
  { id: 'final', label: 'Final Report', icon: '📄' },
  { id: 'attendance', label: 'Attendance', icon: '📊' },
  { id: 'assessments', label: 'Assessments', icon: '📝' },
  { id: 'documents', label: 'Documents', icon: '📂' },
];

/** Badge colour per lifecycle phase — never plain text. */
const PHASE_TONE: Record<TrainingPhase, { bg: string; fg: string }> = {
  Preparation: { bg: 'var(--status-neutral-bg)', fg: 'var(--status-neutral)' },
  Scheduled: { bg: 'var(--status-info-bg)', fg: 'var(--status-info)' },
  'In Progress': { bg: 'var(--status-progress-bg)', fg: 'var(--status-progress)' },
  Assessment: { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning)' },
  Feedback: { bg: 'var(--status-info-bg)', fg: 'var(--status-info)' },
  Certificate: { bg: 'var(--status-progress-bg)', fg: 'var(--status-progress)' },
  Completed: { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' },
};

export interface BatchCardVM {
  id: string;
  trainingName: string;
  phase: TrainingPhase;
  college: string;
  course: string;
  academicYear: string;
  batchNo: string;
  trainer: string;
  coordinator: string;
  venue: string;
  startDate: string;
  endDate: string;
  completedTasks: number;
  totalTasks: number;
  progress: number; // 0-100
}

/** Build the card view-model from the repository records. */
export function toCardVM(b: Batch, courses: Course[], trainers: Employee[]): BatchCardVM {
  const course = courses.find((c) => c.id === b.courseId);
  const trainer = trainers.find((t) => t.id === b.trainerId);
  const total = b.totalTasks ?? 0;
  const done = b.completedTasks ?? 0;
  return {
    id: b.id,
    trainingName: b.trainingName || course?.title || b.code,
    phase: b.phase ?? 'Preparation',
    college: b.college || '—',
    course: course?.title || '—',
    academicYear: b.academicYear || '—',
    batchNo: b.batchNo || b.code,
    trainer: trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Unassigned',
    coordinator: b.coordinator || '—',
    venue: b.venue || '—',
    startDate: b.startDate,
    endDate: b.endDate,
    completedTasks: done,
    totalTasks: total,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

const PREFS_KEY = 'kvj.batchCarousel.prefs';
interface Prefs { pinned: string[]; favourites: string[] }
function loadPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{"pinned":[],"favourites":[]}');
  } catch {
    return { pinned: [], favourites: [] };
  }
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  vm: BatchCardVM;
  active: boolean;
  pinned: boolean;
  favourite: boolean;
  width: number;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleFav: (id: string) => void;
  onAction: (id: string, action: BatchAction) => void;
}

const Card = memo(function Card({
  vm, active, pinned, favourite, width, onSelect, onTogglePin, onToggleFav, onAction,
}: CardProps) {
  const tone = PHASE_TONE[vm.phase];
  return (
    <article
      onClick={() => onSelect(vm.id)}
      aria-current={active}
      style={{
        width,
        height: 244,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
        boxShadow: active
          ? '0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent), var(--e3)'
          : 'var(--e1)',
        transform: active ? 'scale(1.015)' : 'scale(1)',
        transition: 'transform 160ms var(--ease-standard), box-shadow 160ms var(--ease-standard), border-color 160ms var(--ease-standard)',
        cursor: 'pointer',
      }}
    >
      {/* Header: name + phase badge + pin/star */}
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vm.trainingName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vm.college} · {vm.academicYear} · {vm.batchNo}
          </div>
        </div>
        <span style={{ background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          {vm.phase}
        </span>
        <button
          type="button"
          aria-label={pinned ? 'Unpin batch' : 'Pin batch'}
          onClick={(e) => { e.stopPropagation(); onTogglePin(vm.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: pinned ? 1 : 0.35, padding: 2 }}
        >📌</button>
        <button
          type="button"
          aria-label={favourite ? 'Remove favourite' : 'Mark favourite'}
          onClick={(e) => { e.stopPropagation(); onToggleFav(vm.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: favourite ? 'var(--status-warning)' : 'var(--text-muted)', opacity: favourite ? 1 : 0.45, padding: 2 }}
        >{favourite ? '★' : '☆'}</button>
      </header>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '4px 12px', marginTop: 10, fontSize: 11.5 }}>
        <Field label="Course" value={vm.course} />
        <Field label="Trainer" value={vm.trainer} />
        <Field label="Coordinator" value={vm.coordinator} />
        <Field label="Venue" value={vm.venue} />
        <Field label="Start" value={vm.startDate} mono />
        <Field label="Expected End" value={vm.endDate} mono />
      </div>

      {/* Progress */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Overall Completion</span>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{vm.progress}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden', margin: '5px 0 4px' }}>
          <div style={{ width: `${vm.progress}%`, height: '100%', borderRadius: 999, background: 'var(--brand)', transition: 'width 200ms var(--ease-standard)' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>✅ {vm.completedTasks} completed</span>
          <span>⏳ {Math.max(0, vm.totalTasks - vm.completedTasks)} remaining</span>
        </div>
      </div>

      {/* Quick actions — always visible */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.label}
            onClick={(e) => { e.stopPropagation(); onAction(vm.id, a); }}
            style={{
              fontSize: 10.5, padding: '3px 7px', borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)', background: 'var(--bg-sunken)',
              color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </article>
  );
});

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>
        {value}
      </div>
    </div>
  );
}

// ── Carousel ─────────────────────────────────────────────────────────────────

const GAP = 16;
const OVERSCAN = 2;

export function TrainingBatchCarousel({
  batches, courses, trainers, activeId, onSelect, onAction,
}: {
  batches: Batch[];
  courses: Course[];
  trainers: Employee[];
  activeId: string;
  onSelect: (id: string) => void;
  onAction: (batchId: string, action: BatchAction) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportW, setViewportW] = useState(1200);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  const [query, setQuery] = useState('');
  const [fCollege, setFCollege] = useState('all');
  const [fPhase, setFPhase] = useState('all');
  const [fTrainer, setFTrainer] = useState('all');
  const [fCourse, setFCourse] = useState('all');
  const [fYear, setFYear] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'progress' | 'start' | 'end'>('newest');

  const vms = useMemo(
    () => batches.map((b) => toCardVM(b, courses, trainers)),
    [batches, courses, trainers],
  );

  // Responsive card width: one full-width card on mobile, wider cards on desktop.
  const cardWidth = useMemo(() => {
    if (viewportW < 640) return Math.max(260, viewportW - 8);
    if (viewportW < 1024) return 520;
    return 560;
  }, [viewportW]);
  const step = cardWidth + GAP;

  const filterOptions = useMemo(() => ({
    colleges: [...new Set(vms.map((v) => v.college))].sort(),
    trainers: [...new Set(vms.map((v) => v.trainer))].sort(),
    courses: [...new Set(vms.map((v) => v.course))].sort(),
    years: [...new Set(vms.map((v) => v.academicYear))].sort(),
  }), [vms]);

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = vms.filter((v) => {
      if (q && !`${v.trainingName} ${v.college} ${v.batchNo} ${v.course} ${v.trainer}`.toLowerCase().includes(q)) return false;
      if (fCollege !== 'all' && v.college !== fCollege) return false;
      if (fPhase !== 'all' && v.phase !== fPhase) return false;
      if (fTrainer !== 'all' && v.trainer !== fTrainer) return false;
      if (fCourse !== 'all' && v.course !== fCourse) return false;
      if (fYear !== 'all' && v.academicYear !== fYear) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'oldest': return a.startDate.localeCompare(b.startDate);
        case 'progress': return b.progress - a.progress;
        case 'start': return a.startDate.localeCompare(b.startDate);
        case 'end': return a.endDate.localeCompare(b.endDate);
        default: return b.startDate.localeCompare(a.startDate); // newest
      }
    });

    // Pinned batches always lead, preserving the sort within each group.
    const pinnedSet = new Set(prefs.pinned);
    return [...sorted.filter((v) => pinnedSet.has(v.id)), ...sorted.filter((v) => !pinnedSet.has(v.id))];
  }, [vms, query, fCollege, fPhase, fTrainer, fCourse, fYear, sort, prefs.pinned]);

  // Track viewport width for responsive card sizing + virtualization maths.
  // ResizeObserver delivery is tied to the rendering lifecycle and stalls in
  // hidden/background tabs, so a window resize listener backs it up — otherwise
  // the card width can stay stuck at a stale breakpoint.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Scroll position drives which cards are mounted.
  //
  // Deliberately NOT rAF-throttled: requestAnimationFrame is paused in
  // background/hidden tabs, which would freeze the window and leave the wrong
  // cards mounted. React batches these updates and only ~6 memoised cards ever
  // re-render, so updating straight from the event is both cheaper and safer.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // sync initial position
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Vertical wheel → horizontal scroll (trackpads already scroll horizontally).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // genuine horizontal gesture
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-scroll via pointer events (mouse only; touch already pans natively).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if ((e.target as HTMLElement).closest('button')) return;
      down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) { moved = true; el.style.cursor = 'grabbing'; }
      el.scrollLeft = startScroll - dx;
    };
    const onUp = () => { down = false; el.style.cursor = ''; };
    // Suppress the click that ends a drag so dragging never selects a card.
    const onClick = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  const togglePin = useCallback((id: string) => {
    setPrefs((p) => {
      const next = { ...p, pinned: p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [...p.pinned, id] };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleFav = useCallback((id: string) => {
    setPrefs((p) => {
      const next = { ...p, favourites: p.favourites.includes(id) ? p.favourites.filter((x) => x !== id) : [...p.favourites, id] };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const nudge = (dir: -1 | 1) => scrollerRef.current?.scrollBy({ left: dir * step, behavior: 'smooth' });

  // ── Virtualization window ──
  const total = visibleList.length;
  const first = Math.max(0, Math.floor(scrollLeft / step) - OVERSCAN);
  const last = Math.min(total, Math.ceil((scrollLeft + viewportW) / step) + OVERSCAN);
  const window_ = visibleList.slice(first, last);

  const selectStyle: React.CSSProperties = {
    fontSize: 12, padding: '5px 8px', borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)',
  };

  return (
    <section style={{ marginBottom: 20 }}>
      {/* Search / filter / sort toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search batch, college, trainer…"
          aria-label="Search batches"
          style={{ ...selectStyle, minWidth: 220, flex: '1 1 220px' }}
        />
        <select aria-label="Filter by college" value={fCollege} onChange={(e) => setFCollege(e.target.value)} style={selectStyle}>
          <option value="all">All Colleges</option>
          {filterOptions.colleges.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by status" value={fPhase} onChange={(e) => setFPhase(e.target.value)} style={selectStyle}>
          <option value="all">All Status</option>
          {TRAINING_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Filter by trainer" value={fTrainer} onChange={(e) => setFTrainer(e.target.value)} style={selectStyle}>
          <option value="all">All Trainers</option>
          {filterOptions.trainers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Filter by course" value={fCourse} onChange={(e) => setFCourse(e.target.value)} style={selectStyle}>
          <option value="all">All Courses</option>
          {filterOptions.courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by academic year" value={fYear} onChange={(e) => setFYear(e.target.value)} style={selectStyle}>
          <option value="all">All Years</option>
          {filterOptions.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Sort batches" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={selectStyle}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="progress">Progress</option>
          <option value="start">Start Date</option>
          <option value="end">End Date</option>
        </select>
      </div>

      {/* Carousel. The gutter keeps the arrows clear of the cards instead of
          floating on top of them. */}
      <div style={{ position: 'relative', paddingInline: 34 }}>
        <ArrowButton dir="prev" onClick={() => nudge(-1)} />
        <ArrowButton dir="next" onClick={() => nudge(1)} />

        <div
          ref={scrollerRef}
          className="kvj-batch-carousel"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x proximity',
            cursor: 'grab',
            paddingBottom: 6,
          }}
        >
          {/* Spacer sized to the full list; only the window is mounted. */}
          <div style={{ position: 'relative', height: 244, width: Math.max(total * step - GAP, 0) }}>
            {window_.map((vm, i) => {
              const index = first + i;
              return (
                <div
                  key={vm.id}
                  style={{ position: 'absolute', left: index * step, top: 0, scrollSnapAlign: 'start' }}
                >
                  <Card
                    vm={vm}
                    active={vm.id === activeId}
                    pinned={prefs.pinned.includes(vm.id)}
                    favourite={prefs.favourites.includes(vm.id)}
                    width={cardWidth}
                    onSelect={onSelect}
                    onTogglePin={togglePin}
                    onToggleFav={toggleFav}
                    onAction={onAction}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Showing {total} batch{total === 1 ? '' : 'es'} · {window_.length} card{window_.length === 1 ? '' : 's'} rendered (virtualized)
        {prefs.pinned.length > 0 && ` · ${prefs.pinned.length} pinned`}
      </div>
    </section>
  );
}

function ArrowButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous batches' : 'Next batches'}
      onClick={onClick}
      style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [dir === 'prev' ? 'left' : 'right']: 0,
        zIndex: 3, width: 32, height: 32, borderRadius: '50%',
        border: '1px solid var(--border)', background: 'var(--bg-panel)',
        color: 'var(--text-primary)', cursor: 'pointer', boxShadow: 'var(--e2)',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}

export default TrainingBatchCarousel;
