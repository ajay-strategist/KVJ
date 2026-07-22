/**
 * Training Resource Planner — a single Resource Matrix workspace.
 *
 * There is deliberately NO view switcher. Every workflow that used to need a
 * separate Month / Week / Trainer / Batch / Holiday / Leave page is now served
 * by the date range selector and the filter bar over one matrix.
 *
 * Data is range-scoped: `fetchScheduleRange` only ever materializes the
 * selected window, so widening the range is the only way to increase the row
 * count. Rows AND trainer columns are virtualized with TanStack Virtual.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { todayISO } from '../../../shared/utils/date';
import {
  fetchScheduleRange, detectConflicts, eachDate, presetRange, PRESETS, CONFLICT_META,
  type ScheduleRangeResult, type ScheduleSession, type ScheduleConflict,
  type ConflictStatus, type PresetId,
} from '../schedule.data';

const EMPTY: ScheduleRangeResult = { sessions: [], leaves: [], holidays: [], daysLoaded: 0 };

const FROZEN = { date: 116, day: 56, holiday: 132 };
const FROZEN_W = FROZEN.date + FROZEN.day + FROZEN.holiday;
const COL_W = 250;
const ROW_BASE = 48;

interface FilterState {
  search: string; trainer: string; college: string; course: string; batch: string;
  status: string; leave: string; holiday: string; venue: string; coordinator: string; year: string;
}
const EMPTY_FILTERS: FilterState = {
  search: '', trainer: 'all', college: 'all', course: 'all', batch: 'all',
  status: 'all', leave: 'all', holiday: 'all', venue: 'all', coordinator: 'all', year: 'all',
};
const SAVED_KEY = 'kvj.planner.savedFilters';

export function TrainingCalendar() {
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);

  // ── Date range (default: current month) ──
  const [preset, setPreset] = useState<PresetId>('current_month');
  const [range, setRange] = useState(() => presetRange('current_month'));

  const [data, setData] = useState<ScheduleRangeResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [savedFilters, setSavedFilters] = useState<Record<string, FilterState>>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}'); } catch { return {}; }
  });

  const [conflictOverrides, setConflictOverrides] = useState<Record<string, ConflictStatus>>({});
  const [conflictFilter, setConflictFilter] = useState({ trainer: 'all', severity: 'all', status: 'Open', date: 'all' });
  const [showConflictsPanel, setShowConflictsPanel] = useState(true);
  const [detailConflict, setDetailConflict] = useState<ScheduleConflict | null>(null);
  const [detailSession, setDetailSession] = useState<ScheduleSession | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((r) => {
      if (r.ok) setTrainers(r.value);
    });
  }, []);

  const trainerIds = useMemo(() => trainers.map((t) => t.id), [trainers]);
  const trainerName = useCallback(
    (id: string) => {
      const t = trainers.find((x) => x.id === id);
      return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
    },
    [trainers],
  );

  // Reload ONLY when the range (or trainer set) changes — never preload.
  useEffect(() => {
    if (trainerIds.length === 0) return;
    let alive = true;
    setLoading(true);
    fetchScheduleRange({ from: range.from, to: range.to }, trainerIds).then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [range.from, range.to, trainerIds]);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    if (id !== 'custom') setRange(presetRange(id));
  };

  // ── Filtering ──
  const visibleTrainers = useMemo(
    () => (filters.trainer === 'all' ? trainers : trainers.filter((t) => t.id === filters.trainer)),
    [trainers, filters.trainer],
  );

  const opts = useMemo(() => ({
    colleges: [...new Set(data.sessions.map((s) => s.college))].sort(),
    courses: [...new Set(data.sessions.map((s) => s.course))].sort(),
    batches: [...new Set(data.sessions.map((s) => s.batchCode))].sort(),
    venues: [...new Set(data.sessions.map((s) => s.venue))].sort(),
    coordinators: [...new Set(data.sessions.map((s) => s.coordinator))].sort(),
    years: [...new Set(data.sessions.map((s) => s.academicYear))].sort(),
  }), [data.sessions]);

  const sessionMatches = useCallback((s: ScheduleSession) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !`${s.name} ${s.batchCode} ${s.college} ${s.course} ${s.venue} ${s.coordinator}`.toLowerCase().includes(q)) return false;
    if (filters.college !== 'all' && s.college !== filters.college) return false;
    if (filters.course !== 'all' && s.course !== filters.course) return false;
    if (filters.batch !== 'all' && s.batchCode !== filters.batch) return false;
    if (filters.venue !== 'all' && s.venue !== filters.venue) return false;
    if (filters.coordinator !== 'all' && s.coordinator !== filters.coordinator) return false;
    if (filters.year !== 'all' && s.academicYear !== filters.year) return false;
    if (filters.status !== 'all' && s.status !== filters.status) return false;
    return true;
  }, [filters]);

  /** Indexed lookups so a cell never scans the full arrays. */
  const index = useMemo(() => {
    const sessions = new Map<string, ScheduleSession[]>();
    for (const s of data.sessions) {
      if (!sessionMatches(s)) continue;
      const k = `${s.date}|${s.trainerId}`;
      const list = sessions.get(k);
      if (list) list.push(s); else sessions.set(k, [s]);
    }
    const leaves = new Map<string, typeof data.leaves[number]>();
    for (const l of data.leaves) {
      if (filters.leave !== 'all' && l.status !== filters.leave) continue;
      leaves.set(`${l.date}|${l.trainerId}`, l);
    }
    const holidays = new Map(data.holidays.map((h) => [h.date, h]));
    return { sessions, leaves, holidays };
  }, [data, sessionMatches, filters.leave]);

  const rows = useMemo(() => {
    const all = eachDate(range.from, range.to);
    return all
      .filter((d) => {
        if (filters.holiday === 'only') return index.holidays.has(d);
        if (filters.holiday === 'exclude') return !index.holidays.has(d);
        return true;
      })
      .map((date) => {
        const dt = new Date(`${date}T00:00:00`);
        return {
          date,
          dayName: dt.toLocaleDateString(undefined, { weekday: 'short' }),
          holiday: index.holidays.get(date),
          isToday: date === todayISO(),
        };
      });
  }, [range.from, range.to, index.holidays, filters.holiday]);

  // ── Conflicts (range-scoped) ──
  const conflicts = useMemo(
    () => detectConflicts(data, trainerName).map((c) => ({ ...c, status: conflictOverrides[c.id] ?? c.status })),
    [data, trainerName, conflictOverrides],
  );

  const shownConflicts = useMemo(() => conflicts.filter((c) => {
    if (conflictFilter.status !== 'all' && c.status !== conflictFilter.status) return false;
    if (conflictFilter.trainer !== 'all' && c.trainerId !== conflictFilter.trainer) return false;
    if (conflictFilter.severity !== 'all' && c.severity !== conflictFilter.severity) return false;
    if (conflictFilter.date !== 'all' && c.date !== conflictFilter.date) return false;
    return true;
  }), [conflicts, conflictFilter]);

  // ── KPIs (follow the selected range) ──
  const kpis = useMemo(() => {
    const t = todayISO();
    const inRange = t >= range.from && t <= range.to;
    return {
      todaySessions: inRange ? data.sessions.filter((s) => s.date === t).length : 0,
      todayInRange: inRange,
      availableTrainers: Math.max(0, visibleTrainers.length - (inRange ? data.leaves.filter((l) => l.date === t && l.status === 'Approved').length : 0)),
      pendingLeaves: data.leaves.filter((l) => l.status === 'Pending').length,
      openConflicts: conflicts.filter((c) => c.status === 'Open').length,
    };
  }, [data, conflicts, range, visibleTrainers.length]);

  // ── Dynamic Row Height Estimation ──
  const getRowEstimate = useCallback(
    (indexIdx: number) => {
      const r = rows[indexIdx];
      if (!r) return 48;
      if (expanded[r.date]) return 110;
      let maxCnt = 1;
      for (const t of visibleTrainers) {
        const cnt = (index.sessions.get(`${r.date}|${t.id}`) ?? []).length;
        if (cnt > maxCnt) maxCnt = cnt;
      }
      if (maxCnt <= 1) return 48;
      if (maxCnt === 2) return 84;
      return 48 + maxCnt * 36;
    },
    [rows, expanded, visibleTrainers, index],
  );

  // ── Virtualization ──
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getRowEstimate,
    overscan: 6,
  });
  const colVirt = useVirtualizer({
    horizontal: true,
    count: visibleTrainers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COL_W,
    overscan: 2,
  });

  const vRows = rowVirt.getVirtualItems();
  const vCols = colVirt.getVirtualItems();
  const bodyW = FROZEN_W + colVirt.getTotalSize();

  const setConflictStatus = (id: string, status: ConflictStatus, msg: string) => {
    setConflictOverrides((p) => ({ ...p, [id]: status }));
    toast({ variant: status === 'Resolved' ? 'success' : 'info', title: msg });
  };

  const saveCurrentFilters = () => {
    const name = `Filter ${Object.keys(savedFilters).length + 1}`;
    const next = { ...savedFilters, [name]: filters };
    setSavedFilters(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    toast({ variant: 'success', title: 'Filter saved', message: name });
  };

  const sel: React.CSSProperties = {
    fontSize: 12, padding: '5px 8px', borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)',
  };

  return (
    <AppShell>
      {/* ── Sticky Header Toolbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl, 16px)',
        padding: '14px 20px',
        marginBottom: 16,
        boxShadow: 'var(--e1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          {/* Title Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-grid', placeItems: 'center',
              width: 36, height: 36, borderRadius: 'var(--radius-md, 10px)',
              background: 'color-mix(in srgb, var(--brand) 12%, var(--bg-sunken))',
              color: 'var(--brand)', fontSize: 18, fontWeight: 800,
            }}>
              📅
            </span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Training Resource Planner
              </h1>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                Resource Allocation & Matrix Scheduling
              </div>
            </div>
          </div>

          {/* Action & Filter Controls Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Date Range Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-sunken)', padding: '4px 6px', borderRadius: 'var(--radius-md, 10px)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, paddingLeft: 6, color: 'var(--text-muted)' }}>📅</span>
              <select
                aria-label="Date range preset"
                value={preset}
                onChange={(e) => applyPreset(e.target.value as PresetId)}
                style={{
                  height: 32,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  paddingRight: 6,
                }}
              >
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>

              {preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4, borderLeft: '1px solid var(--border)' }}>
                  <input
                    type="date"
                    value={range.from}
                    style={{
                      height: 28, fontSize: 12, border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs, 6px)', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)', padding: '0 6px', outline: 'none',
                    }}
                    onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={range.to}
                    style={{
                      height: 28, fontSize: 12, border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs, 6px)', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)', padding: '0 6px', outline: 'none',
                    }}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Undo / Redo Actions */}
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toast({ variant: 'info', title: 'Undo', message: 'Reverted last allocation.' })}
                style={{ height: 36, padding: '0 12px', fontSize: 12.5, fontWeight: 600 }}
              >
                ↶ Undo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toast({ variant: 'info', title: 'Redo', message: 'Re-applied last allocation.' })}
                style={{ height: 36, padding: '0 12px', fontSize: 12.5, fontWeight: 600 }}
              >
                ↷ Redo
              </Button>
            </div>

            {/* Toggle Conflicts Panel button (when conflicts exist) */}
            {conflicts.length > 0 && (
              <Button
                size="sm"
                variant={showConflictsPanel ? 'secondary' : 'danger'}
                onClick={() => setShowConflictsPanel((v) => !v)}
                style={{ height: 36, padding: '0 12px', fontSize: 12.5, fontWeight: 600 }}
              >
                ⚠ {showConflictsPanel ? 'Hide Conflicts' : `Show Conflicts (${shownConflicts.length})`}
              </Button>
            )}

            {/* Assign Schedule Primary Action */}
            <Button
              size="sm"
              onClick={() => toast({ variant: 'success', title: 'Assign Schedule', message: 'Pick a matrix cell to allocate a batch.' })}
              style={{
                height: 36,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--radius-md, 10px)',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--brand) 25%, transparent)',
              }}
            >
              ➕ Assign Schedule
            </Button>
          </div>
        </div>
      </div>


      {/* ── Conflicts Panel (Collapsible to free up full page height) ── */}
      {showConflictsPanel && conflicts.length > 0 && (
        <section style={{ border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-lg)', background: 'var(--status-danger-bg)', padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-danger)' }}>⚠ Schedule Conflicts</span>
            <span style={{ fontSize: 11, background: 'var(--status-danger)', color: '#fff', borderRadius: 999, padding: '1px 8px', fontWeight: 700 }}>{shownConflicts.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select aria-label="Filter conflicts by trainer" style={sel} value={conflictFilter.trainer} onChange={(e) => setConflictFilter((f) => ({ ...f, trainer: e.target.value }))}>
                <option value="all">All Trainers</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
              <select aria-label="Filter conflicts by severity" style={sel} value={conflictFilter.severity} onChange={(e) => setConflictFilter((f) => ({ ...f, severity: e.target.value }))}>
                <option value="all">All Severity</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
              <select aria-label="Filter conflicts by status" style={sel} value={conflictFilter.status} onChange={(e) => setConflictFilter((f) => ({ ...f, status: e.target.value }))}>
                <option value="all">All Status</option><option>Open</option><option>Resolved</option><option>Ignored</option>
              </select>

              {/* Close Panel Button */}
              <button
                type="button"
                onClick={() => setShowConflictsPanel(false)}
                title="Close Conflicts Panel to expand matrix view"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-xs, 6px)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--status-danger)',
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background 120ms',
                }}
              >
                <span>✕</span> Close
              </button>
            </div>
          </div>
          {shownConflicts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No conflicts match current filters.</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {shownConflicts.slice(0, 40).map((c) => (
                <ConflictCard
                  key={c.id}
                  c={c}
                  onDetails={() => setDetailConflict(c)}
                  onResolve={() => setConflictStatus(c.id, 'Resolved', 'Conflict resolved')}
                  onReassign={() => setConflictStatus(c.id, 'Resolved', 'Trainer reassigned')}
                  onIgnore={() => setConflictStatus(c.id, 'Ignored', 'Conflict ignored')}
                />
              ))}
            </div>
          )}
        </section>
      )}



      {/* ── Resource Matrix (Expands dynamically to utilize all bottom vertical space) ── */}
      <div
        ref={scrollRef}
        className="kvj-matrix"
        style={{
          position: 'relative', overflow: 'auto',
          height: showConflictsPanel && conflicts.length > 0 ? 'calc(100vh - 240px)' : 'calc(100vh - 150px)',
          minHeight: 550,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--e1)',
        }}
      >
        {/* Sticky matrix header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 6, display: 'flex', width: bodyW, height: 38, background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
          <HeadCell w={FROZEN.date} left={0}>Date</HeadCell>
          <HeadCell w={FROZEN.day} left={FROZEN.date}>Day</HeadCell>
          <HeadCell w={FROZEN.holiday} left={FROZEN.date + FROZEN.day}>Holiday</HeadCell>
          <div style={{ position: 'relative', width: colVirt.getTotalSize(), height: '100%' }}>
            {vCols.map((vc) => {
              const t = visibleTrainers[vc.index];
              return (
                <div key={t.id} style={{
                  position: 'absolute', left: vc.start, width: vc.size, height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 700, borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                  👤 {t.firstName} {t.lastName}
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtualized body — only the visible rows × visible trainer columns */}
        <div style={{ height: rowVirt.getTotalSize(), width: bodyW, position: 'relative' }}>
          {vRows.map((vr) => {
            const r = rows[vr.index];
            const tint = r.holiday ? 'var(--status-danger-bg)' : r.isToday ? 'var(--status-success-bg)' : 'transparent';
            const isOpen = !!expanded[r.date];
            return (
              <div
                key={r.date}
                data-index={vr.index}
                ref={rowVirt.measureElement}
                style={{
                  position: 'absolute', top: 0, left: 0, transform: `translateY(${vr.start}px)`,
                  width: bodyW, display: 'flex', background: tint,
                  borderBottom: '1px solid var(--border)', minHeight: 44,
                }}
              >
                <FrozenCell w={FROZEN.date} left={0} bg={tint}>
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [r.date]: !p[r.date] }))}
                    aria-label={isOpen ? 'Collapse day' : 'Expand day'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginRight: 4 }}
                  >{isOpen ? '▾' : '▸'}</button>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: r.isToday ? 700 : 500 }}>{r.date}</span>
                </FrozenCell>
                <FrozenCell w={FROZEN.day} left={FROZEN.date} bg={tint}>{r.dayName}</FrozenCell>
                <FrozenCell w={FROZEN.holiday} left={FROZEN.date + FROZEN.day} bg={tint}>
                  {r.holiday
                    ? <span style={{ fontSize: 11, color: 'var(--status-danger)', fontWeight: 700 }}>{r.holiday.name}</span>
                    : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                </FrozenCell>

                <div style={{ position: 'relative', width: colVirt.getTotalSize() }}>
                  {vCols.map((vc) => {
                    const t = visibleTrainers[vc.index];
                    const key = `${r.date}|${t.id}`;
                    return (
                      <MatrixCell
                        key={t.id}
                        left={vc.start}
                        width={vc.size}
                        sessions={index.sessions.get(key) ?? []}
                        leave={index.leaves.get(key)}
                        expanded={isOpen}
                        onOpen={setDetailSession}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>



      {/* Conflict detail */}
      <Drawer open={!!detailConflict} onClose={() => setDetailConflict(null)} title="Conflict Details">
        {detailConflict && (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row k="Type" v={`${CONFLICT_META[detailConflict.type].icon} ${detailConflict.type}`} />
            <Row k="Severity" v={detailConflict.severity} />
            <Row k="Trainer" v={detailConflict.trainerName} />
            <Row k="Date" v={detailConflict.date} />
            <Row k="Time" v={detailConflict.time} />
            <Row k="Batches" v={detailConflict.batches.join(', ')} />
            <Row k="Status" v={detailConflict.status} />
            <p style={{ color: 'var(--text-secondary)' }}>{detailConflict.detail}</p>
          </div>
        )}
      </Drawer>

      {/* Session detail */}
      <Drawer open={!!detailSession} onClose={() => setDetailSession(null)} title="Session Details">
        {detailSession && (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row k="Session" v={detailSession.name} />
            <Row k="Batch" v={detailSession.batchCode} />
            <Row k="College" v={detailSession.college} />
            <Row k="Course" v={detailSession.course} />
            <Row k="Coordinator" v={detailSession.coordinator} />
            <Row k="Trainer" v={trainerName(detailSession.trainerId)} />
            <Row k="Date" v={detailSession.date} />
            <Row k="Time" v={`${detailSession.startTime} – ${detailSession.endTime}`} />
            <Row k="Venue" v={`${detailSession.venue} (${detailSession.mode})`} />
            <Row k="Students" v={String(detailSession.studentCount)} />
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${tone}`, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', padding: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: tone, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  );
}

function Sel({ label, value, onChange, options, style }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; style: React.CSSProperties;
}) {
  return (
    <select aria-label={`Filter by ${label}`} style={style} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All {label}s</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function HeadCell({ w, left, children }: { w: number; left: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 12,
      background: 'var(--bg-sunken)', borderRight: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 10px',
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--text-secondary)', boxSizing: 'border-box',
    }}>{children}</div>
  );
}

function FrozenCell({ w, left, bg, children }: { w: number; left: number; bg: string; children: React.ReactNode }) {
  // Ensure solid opaque background so underneath content never bleeds through during scroll
  const isSpecialBg = bg && bg !== 'transparent';
  const solidBg = isSpecialBg
    ? `color-mix(in srgb, ${bg} 25%, var(--bg-surface))`
    : 'var(--bg-surface)';

  return (
    <div style={{
      position: 'sticky', left, width: w, minWidth: w, zIndex: 8,
      background: solidBg,
      backgroundColor: solidBg,
      borderRight: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>{children}</div>
  );
}

const ConflictCard = memo(function ConflictCard({ c, onDetails, onResolve, onReassign, onIgnore }: {
  c: ScheduleConflict; onDetails: () => void; onResolve: () => void; onReassign: () => void; onIgnore: () => void;
}) {
  const meta = CONFLICT_META[c.type];
  return (
    <div style={{
      minWidth: 300, flex: '0 0 auto', border: '1px solid var(--border)',
      borderLeft: `4px solid ${c.severity === 'High' ? 'var(--status-danger)' : c.severity === 'Medium' ? 'var(--status-warning)' : 'var(--status-info)'}`,
      borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--bg-panel)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{meta.icon} {c.type}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
        {c.trainerName} · {c.date}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.time}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Batches: {c.batches.join(', ')}</div>
      <div style={{ fontSize: 10.5, marginTop: 4 }}>
        Severity <strong>{c.severity}</strong> · Status <strong>{c.status}</strong>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        <MiniBtn onClick={onDetails}>View Details</MiniBtn>
        <MiniBtn onClick={onResolve}>Resolve</MiniBtn>
        <MiniBtn onClick={onReassign}>Reassign</MiniBtn>
        <MiniBtn onClick={onIgnore}>Ignore</MiniBtn>
      </div>
    </div>
  );
});

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      fontSize: 10.5, padding: '3px 7px', borderRadius: 'var(--radius-xs)',
      border: '1px solid var(--border)', background: 'var(--bg-sunken)',
      color: 'var(--text-secondary)', cursor: 'pointer',
    }}>{children}</button>
  );
}

/** One trainer/day cell. Memoised so scrolling never re-renders idle cells. */
const MatrixCell = memo(function MatrixCell({ left, width, sessions, leave, expanded, onOpen }: {
  left: number; width: number;
  sessions: ScheduleSession[];
  leave?: { duration: string; type: string; status: string };
  expanded: boolean;
  onOpen: (s: ScheduleSession) => void;
}) {
  return (
    <div style={{
      position: 'absolute', left, width, top: 0, height: '100%',
      borderRight: '1px solid var(--border)', padding: 6,
      display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box',
    }}>
      {leave && (
        <div style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: 'var(--status-warning-bg)', color: 'var(--status-warning)' }}>
          🟧 {leave.duration} {leave.type} ({leave.status})
        </div>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(s)}
          style={{
            textAlign: 'left', borderLeft: `3px solid ${s.color}`, background: 'var(--bg-panel)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '4px 7px',
            cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)',
          }}
        >
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{s.startTime}–{s.endTime} · {s.batchCode}</div>
          {expanded && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
              📍 {s.venue} · {s.mode} · 👥 {s.studentCount}<br />🎓 {s.college} · {s.coordinator}
            </div>
          )}
        </button>
      ))}
      {!leave && sessions.length === 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' }}>Office</div>
      )}
    </div>
  );
});

export default TrainingCalendar;
