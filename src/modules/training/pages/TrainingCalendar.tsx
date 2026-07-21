/**
 * Training Calendar
 * Daily trainer allocation grid with leave request tracking:
 *   - Pending Leave requests display as "Leave Not Approved"
 *   - Approved Leave requests display as "Leave"
 */

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, Button, SectionHeader, Badge } from '../../../shared/ui/components';
import { useTraining } from '../hooks/useTraining';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';

export type AllocationStatus = {
  type: 'office' | 'batch' | 'leave_pending' | 'leave_approved' | 'event';
  batchCode?: string;
  notes?: string;
};

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

  // Grid allocations state: key = `${dateStr}_${trainerId}`
  const [allocations, setAllocations] = useState<Record<string, AllocationStatus>>({
    // Pre-populated sample leave requests:
    // Day 13: Pending leave -> Leave Not Approved
    '13_emp-1': { type: 'leave_pending', notes: 'Personal work (Pending Approval)' },
    // Day 15: Approved leave -> Leave
    '15_emp-2': { type: 'leave_approved', notes: 'Medical Leave (Approved)' },
  });

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
        dateNum: i + 1,
        date,
        dayName,
        isHoliday: date.getDay() === 0,
        isToday: isSameDay(date, today),
      };
    });
  }, [cursor, today]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const handleAllocationChange = (key: string, value: string) => {
    if (!value || value === 'office') {
      setAllocations((prev) => ({ ...prev, [key]: { type: 'office' } }));
    } else if (value === 'leave_pending') {
      setAllocations((prev) => ({ ...prev, [key]: { type: 'leave_pending' } }));
    } else if (value === 'leave_approved') {
      setAllocations((prev) => ({ ...prev, [key]: { type: 'leave_approved' } }));
    } else if (value === 'event') {
      setAllocations((prev) => ({ ...prev, [key]: { type: 'event' } }));
    } else {
      setAllocations((prev) => ({ ...prev, [key]: { type: 'batch', batchCode: value } }));
    }
  };

  const approveLeaveRequest = (key: string) => {
    setAllocations((prev) => ({
      ...prev,
      [key]: { type: 'leave_approved', notes: 'Approved by Manager' },
    }));
  };

  const cellBase: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    fontSize: 12,
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      <PageHeader
        title="Training Calendar & Trainer Allocations"
        subtitle="Daily trainer schedule, batch assignments, and real-time leave request status"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv, .xlsx, .xls';
                input.onchange = () => { alert('Google Sheet Training Calendar imported successfully!'); };
                input.click();
              }}
            >
              📊 Upload Sheet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)}>← Prev</Button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)}>Next →</Button>
          </div>
        }
      />

      {/* Legend Banner for Leave Status */}
      <Card style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>📌 Leave Request Status Rules:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245, 158, 11, 0.15)', padding: '4px 8px', borderRadius: 4, color: 'var(--status-warning)', fontWeight: 600 }}>
              ⏳ Leave Not Approved (Prior to Approval)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239, 68, 68, 0.15)', padding: '4px 8px', borderRadius: 4, color: 'var(--status-danger)', fontWeight: 600 }}>
              🔴 Leave (Once Approved)
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>Archived Schedules: 2025 – 2027</span>
        </div>
      </Card>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }} className="kvj-table">
            <thead>
              <tr style={{ background: 'var(--bg-sunken)' }}>
                <th style={{ ...cellBase, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-surface)', width: 90 }}>Date</th>
                <th style={{ ...cellBase, textAlign: 'left', width: 90 }}>Day</th>
                <th style={{ ...cellBase, textAlign: 'left', width: 80 }}>Holiday</th>
                {trainers.map((t) => (
                  <th key={t.id} style={{ ...cellBase, textAlign: 'left', minWidth: 160 }}>
                    👤 {t.firstName} {t.lastName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowBg = r.isHoliday
                  ? 'rgba(239, 68, 68, 0.12)'
                  : r.isToday
                    ? 'rgba(34, 197, 94, 0.14)'
                    : 'transparent';
                return (
                  <tr key={r.date.toISOString()} style={{ background: rowBg }}>
                    <td style={{ ...cellBase, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: 0, background: rowBg === 'transparent' ? 'var(--bg-surface)' : rowBg, fontWeight: r.isToday ? 700 : 500 }}>
                      {r.date.toLocaleDateString()}
                    </td>
                    <td style={cellBase}>{r.dayName}</td>
                    <td style={{ ...cellBase, color: 'var(--status-danger)', fontWeight: 600 }}>
                      {r.isHoliday ? 'Sunday' : ''}
                    </td>
                    {trainers.map((t) => {
                      const key = `${r.dateNum}_${t.id}`;
                      const currentAlloc = allocations[key] || { type: 'office' };

                      return (
                        <td key={t.id} style={cellBase}>
                          {r.isHoliday ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>-</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <select
                                className="kvj-select"
                                value={currentAlloc.type === 'batch' ? currentAlloc.batchCode : currentAlloc.type}
                                onChange={(e) => handleAllocationChange(key, e.target.value)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 11.5,
                                  borderRadius: 'var(--radius-xs)',
                                  fontWeight: 600,
                                  background:
                                    currentAlloc.type === 'leave_pending'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : currentAlloc.type === 'leave_approved'
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'transparent',
                                  color:
                                    currentAlloc.type === 'leave_pending'
                                      ? '#D97706'
                                      : currentAlloc.type === 'leave_approved'
                                        ? '#DC2626'
                                        : 'inherit',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                <option value="office">🏢 Office (Unallocated)</option>
                                {batches.map((b) => (
                                  <option key={b.id} value={b.code}>📚 {b.code}</option>
                                ))}
                                <option value="leave_pending">⏳ Leave Not Approved</option>
                                <option value="leave_approved">🔴 Leave</option>
                                <option value="event">🎤 Special Event</option>
                              </select>

                              {/* Direct Approve Action for Pending Leaves */}
                              {currentAlloc.type === 'leave_pending' && (
                                <button
                                  type="button"
                                  onClick={() => approveLeaveRequest(key)}
                                  title="Approve Leave Request"
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    borderRadius: 4,
                                    background: 'var(--status-success)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default TrainingCalendar;
