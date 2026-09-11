import { useState, useEffect } from 'react';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useProject } from '../../../modules/project/hooks/useProject';
import { useEmployee } from '../../../modules/employee/hooks/useEmployee';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../../../modules/attendance/attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../../../modules/finance/finance.repository';
import { LEAVE_REPOSITORY_TOKEN } from '../../../modules/leave/leave.repository';
import { TASK_REPOSITORY_TOKEN } from '../../../modules/project/project.repository';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, StatCard, Card, SectionHeader, Badge, Button } from '../../../shared/ui/components';

function escapeXml(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Supervisor / Manager / CEO workspaces. */
export function RoleWorkspacePage({ role }: { role: Exclude<WorkspaceRole, 'employee'> }) {
  const { toast } = useNotifications();
  const { projects, clients, timesheets } = useProject();
  const { employees } = useEmployee();

  const [presentCount, setPresentCount] = useState(0);
  const [pendingExpenses, setPendingExpenses] = useState(0);

  const handleExportAllData = async () => {
    try {
      toast({ variant: 'info', title: 'Exporting Data', message: 'Fetching all data tables, please wait...' });
      
      const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
      const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      const leaveRepo = container.resolve(LEAVE_REPOSITORY_TOKEN);
      const taskRepo = container.resolve(TASK_REPOSITORY_TOKEN);

      const [attRes, expRes, leaveRes, taskRes] = await Promise.all([
        attRepo.findMany({ pageSize: 2000 }),
        expRepo.findMany({ pageSize: 2000 }),
        leaveRepo.findMany({ pageSize: 2000 }),
        taskRepo.findMany({ pageSize: 2000 }),
      ]);

      const attList = attRes?.data || [];
      const expList = expRes?.data || [];
      const leaveList = leaveRes?.data || [];
      const taskList = taskRes?.data || [];
      const empList = employees || [];

      // Helper to build a table sheet
      const buildSheet = (sheetName: string, headers: string[], rows: any[][]) => {
        let sheetXml = `  <Worksheet ss:Name="${sheetName}">\n    <Table>\n      <Row>\n`;
        headers.forEach(h => {
          sheetXml += `        <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
        });
        sheetXml += `      </Row>\n`;
        
        rows.forEach(r => {
          sheetXml += `      <Row>\n`;
          r.forEach(v => {
            const valStr = escapeXml(v);
            const isNum = typeof v === 'number' && !isNaN(v);
            const typeAttr = isNum ? 'Number' : 'String';
            sheetXml += `        <Cell><Data ss:Type="${typeAttr}">${valStr}</Data></Cell>\n`;
          });
          sheetXml += `      </Row>\n`;
        });
        
        sheetXml += `    </Table>\n  </Worksheet>\n`;
        return sheetXml;
      };

      // 1. Employees Sheet
      const empHeaders = ['ID', 'Employee ID', 'First Name', 'Last Name', 'Email', 'Designation', 'Joining Date'];
      const empRows = empList.map(e => [
        e.id,
        e.employeeId,
        e.firstName,
        e.lastName,
        e.email,
        e.designation,
        e.dateOfJoining
      ]);

      // 2. Attendance Sheet
      const attHeaders = ['Record ID', 'Date', 'Employee ID', 'Status', 'Work Type', 'First Clock In', 'Last Clock Out', 'Total Hours'];
      const attRows = attList.map(a => [
        a.id,
        a.workDate,
        a.employeeId,
        a.status || 'present',
        (a as any).workType || 'office',
        a.firstClockIn || '',
        a.lastClockOut || '',
        (a as any).totalHours != null ? Number((a as any).totalHours) : ''
      ]);

      // 3. Leaves Sheet
      const leaveHeaders = ['Leave ID', 'Employee ID', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'];
      const leaveRows = leaveList.map(l => [
        l.id,
        l.employeeId,
        l.leaveType,
        l.startDate,
        l.endDate,
        (l as any).daysCount || (l.halfDay ? 0.5 : 1),
        l.status,
        l.reason || ''
      ]);

      // 4. Tasks Sheet
      const taskHeaders = ['Task ID', 'Project ID', 'Title', 'Assigned To', 'Status', 'Priority', 'Due Date', 'Est Hours'];
      const taskRows = taskList.map(t => [
        t.id,
        t.projectId,
        t.title,
        t.assigneeId || '',
        t.status,
        t.priority,
        t.dueDate || '',
        t.estimatedHours || 0
      ]);

      // 5. Expenses Sheet
      const expHeaders = ['Claim ID', 'Employee ID', 'Category', 'Expense Date', 'Amount', 'Status', 'KM Travelled', 'Route Details'];
      const expRows = expList.map(x => [
        x.id,
        x.employeeId,
        x.category,
        (x as any).expenseDate || x.createdAt?.slice(0, 10) || '',
        x.amount,
        x.status,
        (x as any).kmTravelled || '',
        (x as any).routeDetails || ''
      ]);

      const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${buildSheet('Employees', empHeaders, empRows)}${buildSheet('Attendance', attHeaders, attRows)}${buildSheet('Leaves', leaveHeaders, leaveRows)}${buildSheet('Tasks', taskHeaders, taskRows)}${buildSheet('Expenses', expHeaders, expRows)}</Workbook>`;

      const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KVJ_All_Entities_Export_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Export Complete', message: 'All tables exported into a multi-tab Excel workbook.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Export Failed', message: err?.message || 'Could not export data.' });
    }
  };

  useEffect(() => {
    try {
      const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
      attRepo.findMany({ pageSize: 500 }).then((res) => {
        if (res && res.data) {
          const today = new Date().toISOString().split('T')[0];
          const todayRecords = res.data.filter((r) => r.workDate === today && r.firstClockIn);
          setPresentCount(todayRecords.length);
        }
      });

      const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      expRepo.findMany({ pageSize: 500 }).then((res) => {
        if (res && res.data) {
          const pending = res.data.filter((e) => e.status === 'submitted');
          setPendingExpenses(pending.length);
        }
      });
    } catch {
      // ignore
    }
  }, []);

  const totalEmployees = employees.length || 1;
  const teamPresent = `${presentCount}/${totalEmployees}`;
  const pendingApprovals = pendingExpenses;
  const atRiskProjects = 0;

  const mappedProjects = (projects || []).slice(0, 5).map((p) => {
    const client = clients?.find((c) => c.id === p.clientId);
    return {
      id: p.id,
      name: p.title,
      client: client ? client.name : 'Internal',
      health: 'On Track',
      healthTone: 'success' as const,
    };
  });

  const titles: Record<Exclude<WorkspaceRole, 'employee'>, { title: string; subtitle: string }> = {
    supervisor: { title: 'Supervisor Workspace', subtitle: 'Team operations · project milestones · approvals' },
    manager: { title: 'Manager Workspace', subtitle: 'Department performance · budgets · resource planning' },
    ceo: { title: 'Executive Overview', subtitle: 'Company health · strategic goals · financial pulse' },
  };

  return (
    <AppShell>
      <WorkspaceShell role={role} regions={{
        greeting: (
          <PageHeader
            title={titles[role].title}
            subtitle={titles[role].subtitle}
            actions={
              role === 'ceo' ? (
                <Button variant="secondary" onClick={handleExportAllData}>
                  📥 Export All Master Data (Excel)
                </Button>
              ) : undefined
            }
          />
        ),
        stats: (
          <>
            <StatCard label="Team present" value={teamPresent} tone="success" icon="●" />
            <StatCard label="Utilization" value="" icon="◔" />
            <StatCard label="Pending approvals" value={pendingApprovals.toString()} tone={pendingApprovals > 0 ? 'warning' : 'neutral'} icon="⚑" />
            <StatCard label="At-risk projects" value={atRiskProjects.toString()} tone={atRiskProjects > 0 ? 'danger' : 'neutral'} icon="▲" />
          </>
        ),
        primary: (
          <>
            <Card>
              <SectionHeader title="Projects" />
              {mappedProjects.length > 0 ? (
                mappedProjects.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client}</div>
                    </div>
                    <Badge tone={p.healthTone}>{p.health}</Badge>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found</div>
              )}
            </Card>
            <Card>
              <SectionHeader title="Attendance trend" />
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No trend data available</div>
            </Card>
          </>
        ),
        side: (
          <>
            <Card>
              <SectionHeader title="Team activity" />
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</div>
            </Card>
          </>
        ),
      }} />
    </AppShell>
  );
}

export default RoleWorkspacePage;
