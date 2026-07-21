import { useState } from 'react';
import { Card, SectionHeader, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

export interface AttendanceSummaryPanelsProps {
  startDate: string;
  endDate: string;
  employeeName: string;
  userRole?: string;
  onFilterChange?: (filters: { startDate: string; endDate: string; filterPreset: string; employeeId?: string }) => void;
  onDeclareHoliday?: (holiday: { date: string; name: string }) => void;
  onRequestEmergencyApproval?: (req: { date: string; batch: string; reason: string }) => void;
}

export function AttendanceSummaryPanels({
  startDate,
  endDate,
  employeeName,
  userRole = 'EMPLOYEE',
  onFilterChange,
  onDeclareHoliday,
  onRequestEmergencyApproval,
}: AttendanceSummaryPanelsProps) {
  const { toast } = useNotifications();

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [activeFilterPreset, setActiveFilterPreset] = useState('current_month');

  // Excel mock aggregated stats (matching screenshot specs)
  const stats = {
    workingDaysInMonth: 26,
    daysToBeWorked: 26,
    noOfLeaves: 1,
    holidayWorked: 0,
    workingDays: 25,
    lateReporting: 1,
    earlyLeaving: 0,
    breakHrs: 0.73,
    avgBreakTime: 0.02,
    overBreakTime: '0 (0.73 hr)',
    joinedDate: '01/12/24',
    accumulatedLeave: 34,
    accumulatedHolidayWorked: 2,
    overallAvgDuration: 6.92,
    totalExpenses: 4806.0,
  };

  const orgBreakdown = [
    { organization: 'Vimala College', avgDuration: 5.0 },
    { organization: 'Office', avgDuration: 7.7 },
    { organization: 'Nehru College', avgDuration: 8.0 },
    { organization: 'Christ Irinjalakkuda', avgDuration: 8.5 },
  ];

  const classSupervisionSummary = [
    { institution: 'Christ Irinjalakkuda', physicalClasses: 22, physicalSupervision: 0, totalPhysical: 22, onlineClasses: 0, physicalClassDuration: 187, physicalSupervisionDuration: 0, totalPhysicalDuration: 187, onlineDuration: 0 },
    { institution: 'Vimala College', physicalClasses: 4, physicalSupervision: 0, totalPhysical: 4, onlineClasses: 0, physicalClassDuration: 20, physicalSupervisionDuration: 0, totalPhysicalDuration: 20, onlineDuration: 0 },
  ];

  const handlePresetClick = (preset: string) => {
    setActiveFilterPreset(preset);
    let start = '2026-06-01';
    let end = '2026-06-30';
    if (preset === 'last_month') { start = '2026-05-01'; end = '2026-05-31'; }
    else if (preset === 'last_1_year') { start = '2025-06-01'; end = '2026-05-31'; }
    if (onFilterChange) onFilterChange({ startDate: start, endDate: end, filterPreset: preset });
  };

  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtering Toolbar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Date Range:</span>
            {[
              { id: 'current_month', label: 'Current Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_1_year', label: 'Last 1 Year (Excl. Current)' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <Button
                key={p.id}
                variant={activeFilterPreset === p.id ? 'primary' : 'secondary'}
                onClick={() => handlePresetClick(p.id)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setHolidayOpen(true)} style={{ fontSize: 12 }}>
                🎉 Declare Holiday
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEmergencyOpen(true)} style={{ fontSize: 12 }}>
              🚨 Request Emergency Attendance
            </Button>
          </div>
        </div>
      </Card>

      {/* Grid of Summary Blocks matching Screenshot 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Input Summary */}
        <Card>
          <SectionHeader title="Input Specs" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Start Date:</span> <strong>{startDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>End Date:</span> <strong>{endDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Employee Name:</span> <strong>{employeeName}</strong></div>
          </div>
        </Card>

        {/* Monthly Summary */}
        <Card>
          <SectionHeader title="Monthly Summary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Working Days in Month:</span> <strong>{stats.workingDaysInMonth}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Days to be Worked:</span> <strong>{stats.daysToBeWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-danger)' }}><span>No. of Leaves:</span> <strong>{stats.noOfLeaves}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand)' }}><span>Holiday Worked:</span> <strong>{stats.holidayWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Working Days:</span> <strong>{stats.workingDays}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Late Reporting:</span> <strong>{stats.lateReporting}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Break Total:</span> <strong>{stats.breakHrs} hrs</strong></div>
          </div>
        </Card>

        {/* Accumulated Stats */}
        <Card>
          <SectionHeader title="Accumulated & Expenses" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Joined Date:</span> <strong>{stats.joinedDate}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-danger)' }}><span>Accumulated Leave:</span> <strong>{stats.accumulatedLeave}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand)' }}><span>Holiday Worked Total:</span> <strong>{stats.accumulatedHolidayWorked}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Overall Avg Duration:</span> <strong>{stats.overallAvgDuration} hrs/day</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              <span>Total Expenses:</span> <strong style={{ color: 'var(--status-success)' }}>₹ {stats.totalExpenses.toLocaleString()}</strong>
            </div>
          </div>
        </Card>

        {/* Organization vs Avg Duration */}
        <Card>
          <SectionHeader title="Organization vs Avg Duration" />
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '4px 0' }}>Organization</th>
                <th style={{ textAlign: 'right' }}>Avg Duration (hr)</th>
              </tr>
            </thead>
            <tbody>
              {orgBreakdown.map((row) => (
                <tr key={row.organization} style={{ borderBottom: '1px dashed var(--border)' }}>
                  <td style={{ padding: '6px 0' }}>{row.organization}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.avgDuration} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Class / Supervision Summary (Screenshot 3) */}
      <Card>
        <SectionHeader title="Class & Supervision Training Summary" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-primary)' }}>
                <th style={{ padding: 8 }}>Institution</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Physical Classes</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Online Classes</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Physical Duration (hr)</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Online Duration (hr)</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {classSupervisionSummary.map((c) => (
                <tr key={c.institution} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{c.institution}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.physicalClasses}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.onlineClasses}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.physicalClassDuration}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{c.onlineDuration}</td>
                  <td style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: 'var(--brand)' }}>{c.totalPhysicalDuration} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Declare Holiday Modal */}
      <Drawer open={holidayOpen} onClose={() => setHolidayOpen(false)} title="Declare Company / Public Holiday">
        <Form
          initial={{ date: '', name: '' }}
          onSubmit={(values) => {
            if (onDeclareHoliday) onDeclareHoliday(values as any);
            toast({ variant: 'success', title: 'Holiday Declared', message: `Holiday '${values.name}' declared for ${values.date}` });
            setHolidayOpen(false);
          }}
        >
          <TextField name="date" label="Holiday Date (YYYY-MM-DD)" placeholder="2026-08-15" />
          <TextField name="name" label="Holiday Occasion / Name" placeholder="Independence Day, Onam, Bakrid..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setHolidayOpen(false)}>Cancel</Button>
            <Button type="submit">Declare Holiday</Button>
          </div>
        </Form>
      </Drawer>

      {/* Emergency Attendance Approval Request Modal */}
      <Drawer open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Emergency Attendance Request (Training Sessions)">
        <Form
          initial={{ date: '', batch: '', reason: '' }}
          onSubmit={(values) => {
            if (onRequestEmergencyApproval) onRequestEmergencyApproval(values as any);
            toast({ variant: 'info', title: 'Emergency Request Sent', message: 'Submitted for CEO & Manager approval.' });
            setEmergencyOpen(false);
          }}
        >
          <TextField name="date" label="Missed Clock-In Date" placeholder="2026-06-25" />
          <TextField name="batch" label="Training Batch Name" placeholder="Christ 3BBA Data Analytics B1" />
          <TextField name="reason" label="Emergency Reason" placeholder="Network issue, travel delay, urgent college entry..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setEmergencyOpen(false)}>Cancel</Button>
            <Button type="submit">Send for Approval</Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
