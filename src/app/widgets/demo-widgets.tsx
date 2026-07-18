/**
 * KVJ Analytics — Demo dashboard widgets (Phase-1 §5)
 * Placeholder widgets registered into the dashboard registry to demonstrate the
 * infrastructure. All data comes from the mock engine — NO business logic.
 * These are removed/replaced when real module widgets arrive in later phases.
 */

import { useState } from 'react';
import { Card, StatCard, SectionHeader, Timeline, ActivityCard, Badge } from '../../shared/ui/components';
import { widgetRegistry } from '../../shared/dashboard/dashboard';
import { mock } from '../../shared/mock/factories';

// ── Dependency-free mini charts (SVG) ────────────────────────────────────────
export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, padding: '8px 0' }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: '100%', height: `${(d.value / max) * 110}px`, background: 'linear-gradient(180deg, var(--brand), var(--accent))', borderRadius: '6px 6px 0 0', transition: 'height var(--dur-base)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
export function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${40 - (d.value / max) * 36}`).join(' ');
  return (
    <svg viewBox="0 0 100 44" preserveAspectRatio="none" style={{ width: '100%', height: 120 }}>
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Widgets ──────────────────────────────────────────────────────────────────
function KpiRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
      <StatCard label="Hours this month" value="168.5" delta={{ value: '4.2%', up: true }} icon="◷" />
      <StatCard label="Attendance" value="94%" tone="success" delta={{ value: '1.1%', up: true }} icon="✓" />
      <StatCard label="Open tasks" value="12" tone="warning" icon="◧" />
      <StatCard label="Approvals" value="3" tone="info" icon="⚑" />
    </div>
  );
}
function TrainingTrendWidget() {
  const [data] = useState(() => mock.series(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']));
  return <Card><SectionHeader title="Training hours (last 6 weeks)" /><BarChart data={data} /></Card>;
}
function AttendanceTrendWidget() {
  const [data] = useState(() => mock.series(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']));
  return <Card><SectionHeader title="Attendance trend" /><LineChart data={data} /></Card>;
}
function ActivityWidget() {
  const [activities] = useState(() => mock.activity(5));
  return <Card><SectionHeader title="Recent activity" />{activities.map((a) => <ActivityCard key={a.id} actor={a.actor} action={a.action} time={a.time} />)}</Card>;
}
function TimelineWidget() {
  return <Card><SectionHeader title="Today's timeline" /><Timeline entries={[
    { id: '1', title: 'Clocked in', time: '09:32', tone: 'success' },
    { id: '2', title: 'Power BI session', time: '10:00 – 12:00', tone: 'progress', description: 'Batch B-3 · NIT Calicut' },
    { id: '3', title: 'Assessment review', time: '14:00', tone: 'info' },
  ]} /></Card>;
}
function CalendarWidget() {
  const [events] = useState(() => mock.calendar(5));
  const toneFor = { training: 'progress', meeting: 'info', leave: 'warning', holiday: 'neutral' } as const;
  return <Card><SectionHeader title="Upcoming" />{events.map((e) => (
    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 13 }}>
      <span>{e.title}</span><Badge tone={toneFor[e.type]}>{e.date}</Badge>
    </div>
  ))}</Card>;
}

/** Register demo widgets once. Real modules register their own later. */
export function registerDemoWidgets() {
  if (widgetRegistry.all().length) return; // idempotent
  widgetRegistry.register({ id: 'kpi-row', title: 'KPIs', component: KpiRow, defaultSize: { w: 12, h: 1 } });
  widgetRegistry.register({ id: 'training-trend', title: 'Training trend', component: TrainingTrendWidget, defaultSize: { w: 6, h: 2 } });
  widgetRegistry.register({ id: 'attendance-trend', title: 'Attendance trend', component: AttendanceTrendWidget, defaultSize: { w: 6, h: 2 } });
  widgetRegistry.register({ id: 'activity', title: 'Activity', component: ActivityWidget, defaultSize: { w: 6, h: 2 } });
  widgetRegistry.register({ id: 'timeline', title: 'Timeline', component: TimelineWidget, defaultSize: { w: 6, h: 2 } });
  widgetRegistry.register({ id: 'calendar', title: 'Calendar', component: CalendarWidget, defaultSize: { w: 6, h: 2 } });
}
