import { useMemo } from 'react';

export interface CalendarEvent {
  date: string; // 'YYYY-MM-DD'
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'progress' | 'neutral';
  label?: string;
  tooltip?: string;
}

export interface CalendarGridProps {
  year: number;
  month: number; // 1-12
  events?: CalendarEvent[];
  onDayClick?: (date: string) => void;
}

export function CalendarGrid({ year, month, events = [], onDayClick }: CalendarGridProps) {
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const startDayOfWeek = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]); // 0=Sun, 1=Mon...

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    events.forEach((e) => map.set(e.date, e));
    return map;
  }, [events]);

  const days = useMemo(() => {
    const result: { dateStr: string | null; dayNum: number | null; event?: CalendarEvent }[] = [];
    
    // Empty offsets before 1st day of month
    for (let i = 0; i < startDayOfWeek; i++) {
      result.push({ dateStr: null, dayNum: null });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({
        dateStr,
        dayNum: d,
        event: eventMap.get(dateStr),
      });
    }

    return result;
  }, [year, month, daysInMonth, startDayOfWeek, eventMap]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toneColors = {
    success: 'var(--status-success-bg)',
    warning: 'var(--status-warning-bg)',
    danger: 'var(--status-danger-bg)',
    info: 'var(--status-info-bg)',
    progress: 'var(--status-progress-bg)',
    neutral: 'var(--status-neutral-bg)',
  };

  const toneTextColors = {
    success: 'var(--status-success)',
    warning: 'var(--status-warning)',
    danger: 'var(--status-danger)',
    info: 'var(--status-info)',
    progress: 'var(--status-progress)',
    neutral: 'var(--text-secondary)',
  };

  return (
    <div className="kvj-calendar-grid" style={{ width: '100%' }}>
      {/* Week Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 8 }}>
        {weekDays.map((wd) => (
          <div key={wd} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map((day, idx) => {
          if (day.dayNum === null) {
            return <div key={`empty-${idx}`} style={{ aspectRatio: '1', background: 'transparent' }} />;
          }

          const hasEvent = !!day.event;
          const bg = hasEvent && day.event!.tone ? toneColors[day.event!.tone!] : 'var(--bg-sunken)';
          const color = hasEvent && day.event!.tone ? toneTextColors[day.event!.tone!] : 'var(--text-primary)';

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => day.dateStr && onDayClick?.(day.dateStr)}
              disabled={!day.dateStr}
              title={day.event?.tooltip ?? day.dateStr ?? undefined}
              style={{
                aspectRatio: '1',
                borderRadius: 'var(--radius-md)',
                background: bg,
                color,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onDayClick ? 'pointer' : 'default',
                position: 'relative',
                padding: 4,
                transition: 'transform var(--dur-fast)',
              }}
              onMouseEnter={(e) => {
                if (onDayClick) e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{day.dayNum}</span>
              {day.event?.label && (
                <span style={{ fontSize: 9, fontWeight: 500, marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                  {day.event.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default CalendarGrid;
