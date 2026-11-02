import React, { memo, useState, useMemo } from 'react';
import { Card, Badge, Timeline } from '../../../../shared/ui/components';
import { useAuth } from '../../../../modules/auth/AuthProvider';
import { toLocalISODate } from '../../../../shared/utils/date';

export const shiftDateStr = (isoDate: string, days: number): string => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
};

export const getEntryDate = (e: { id: string; date?: string }): string => {
  if (e.date) return e.date.slice(0, 10);
  const ts = Number(e.id);
  if (!isNaN(ts) && ts > 1600000000000) {
    return toLocalISODate(new Date(ts));
  }
  return toLocalISODate(new Date());
};

export const parseTimeToMinutes = (tStr: string): number => {
  if (!tStr) return 0;
  const m = tStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

export const getEntryTimestamp = (e: { id: string; time: string; date?: string; timestamp?: number }): number => {
  if (e.timestamp && !isNaN(e.timestamp)) return e.timestamp;
  const ts = Number(e.id);
  if (!isNaN(ts) && ts > 1600000000000) {
    return ts;
  }
  const dateStr = getEntryDate(e);
  const mins = parseTimeToMinutes(e.time);
  const d = new Date(dateStr + 'T00:00:00');
  d.setMinutes(d.getMinutes() + mins);
  return d.getTime();
};

const dateNavBtnStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'all 140ms ease',
};

export const TimelineWidget = memo(function TimelineWidget({
  entries,
  selectedEmpId,
  onEmpIdChange,
  employeeList = [],
}: {
  entries: Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral'; date?: string; timestamp?: number }>;
  selectedEmpId?: string;
  onEmpIdChange?: (empId: string) => void;
  employeeList?: Array<{ id: string; name: string }>;
}) {
  const { user } = useAuth();
  const isExecutive = user && ['CEO', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(user.role).toUpperCase());
  const todayDate = toLocalISODate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const cleanEntries = entries.filter((e) => !e.title?.includes('System initialized'));
  const filteredEntries = cleanEntries.filter((e) => getEntryDate(e) === selectedDate);
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => getEntryTimestamp(a) - getEntryTimestamp(b));
  }, [filteredEntries]);

  const isToday = selectedDate === todayDate;

  const handlePrevDay = () => setSelectedDate((prev) => shiftDateStr(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => shiftDateStr(prev, 1));
  const handleResetToday = () => setSelectedDate(todayDate);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const formattedDateLabel = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      {/* Widget Header with Status & Navigation Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily Activity Timeline
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Clock In → Work → Clock Out Logs
            </div>
          </div>
          <Badge tone={isToday ? 'success' : 'info'}>
            {isToday ? '🟢 Current Day' : '📅 History Log'}
          </Badge>
        </div>

        {/* User Level Employee Filter Dropdown for Executive Roles */}
        {isExecutive && employeeList.length > 0 && onEmpIdChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>👤 Filter Timeline:</span>
            <select
              value={selectedEmpId || 'me'}
              onChange={(e) => onEmpIdChange?.(e.target.value)}
              className="kvj-input"
              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, flex: 1, background: 'var(--bg-surface)', cursor: 'pointer' }}
            >
              <option value="me">My Timeline ({user?.fullName || 'Me'})</option>
              {employeeList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 10px',
          gap: 6,
        }}>
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            style={dateNavBtnStyle}
          >
            ◀ Prev Day
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isToday ? `Today (${formattedDateLabel.split(', ')[1] || formattedDateLabel})` : formattedDateLabel}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              style={{
                width: 20,
                height: 20,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.7,
              }}
              title="Select date"
            />
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!isToday && (
              <button
                type="button"
                onClick={handleResetToday}
                title="Go to Today"
                aria-label="Go to Today"
                style={{
                  ...dateNavBtnStyle,
                  background: 'var(--brand-muted)',
                  color: 'var(--brand)',
                  fontWeight: 700,
                }}
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isToday}
              title={isToday ? 'Current Day' : 'Next Day'}
              aria-label="Next Day"
              style={{
                ...dateNavBtnStyle,
                opacity: isToday ? 0.4 : 1,
                cursor: isToday ? 'not-allowed' : 'pointer',
              }}
            >
              Next Day ▶
            </button>
          </div>
        </div>
      </div>

      {/* Timeline List or Empty State */}
      {filteredEntries.length === 0 ? (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>No activity logged for {isToday ? 'today yet' : formattedDateLabel}.</span>
          {!isToday && (
            <button
              type="button"
              onClick={handleResetToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              View Today's Status ↗
            </button>
          )}
        </div>
      ) : (
        <Timeline entries={sortedEntries} />
      )}
    </Card>
  );
});

export default TimelineWidget;
