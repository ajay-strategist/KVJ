/**
 * Training Calendar (Batches → tab 2)
 * Mirrors the existing Google Sheet: rows are dates (Date / Day / Holiday),
 * columns are trainers, and each cell holds the training that trainer runs
 * that day. A blank cell means the trainer is NOT allocated, and therefore
 * defaults to Office. Sundays and holidays are shaded non-working rows, and
 * today's row is highlighted.
 */

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, Button } from '../../../shared/ui/components';
import { useTraining } from '../hooks/useTraining';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';

/** A day's allocation for one trainer. Blank ⇒ unallocated ⇒ Office. */
export type Allocation = string | undefined;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function TrainingCalendar() {
  const { batches } = useTraining();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = new Date();

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((res) => {
      if (res.ok) setTrainers(res.value);
    });
  }, []);

  const rows = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const dayName = DAY_NAMES[date.getDay()];
      return {
        date,
        dayName,
        // Sundays are the standing non-working day; the Holidays module feeds
        // additional dates in here once it is built.
        isHoliday: date.getDay() === 0,
        isToday: isSameDay(date, today),
      };
    });
  }, [cursor, today]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const cellBase: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    fontSize: 13,
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <PageHeader
        title="Training Calendar"
        subtitle="Daily trainer allocation · an unallocated trainer defaults to Office"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)}>← Prev</Button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)}>Next →</Button>
          </div>
        }
      />

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }} className="kvj-table">
            <thead>
              <tr>
                <th style={{ ...cellBase, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-surface)' }}>Date</th>
                <th style={{ ...cellBase, textAlign: 'left' }}>Day</th>
                <th style={{ ...cellBase, textAlign: 'left' }}>Holiday</th>
                {trainers.map((t) => (
                  <th key={t.id} style={{ ...cellBase, textAlign: 'left' }}>
                    {t.firstName} {t.lastName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowBg = r.isHoliday
                  ? 'var(--status-danger-bg)'
                  : r.isToday
                    ? 'var(--status-success-bg)'
                    : 'transparent';
                return (
                  <tr key={r.date.toISOString()} style={{ background: rowBg }}>
                    <td style={{ ...cellBase, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: 0, background: rowBg === 'transparent' ? 'var(--bg-surface)' : rowBg }}>
                      {r.date.toLocaleDateString()}
                    </td>
                    <td style={cellBase}>{r.dayName}</td>
                    <td style={{ ...cellBase, color: 'var(--status-danger)', fontWeight: 600 }}>
                      {r.isHoliday ? 'Sunday' : ''}
                    </td>
                    {trainers.map((t) => (
                      <td key={t.id} style={cellBase}>
                        {r.isHoliday ? (
                          ''
                        ) : (
                          // No allocation yet ⇒ the trainer is in Office that day.
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Office</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        {trainers.length} trainer(s) · {batches.length} batch(es) available to allocate. Assigning a
        batch to a trainer/day, Leave and one-off events, holiday feed and the month-wise
        previous-year history are wired up with the Training Calendar module.
      </p>
    </>
  );
}

export default TrainingCalendar;
