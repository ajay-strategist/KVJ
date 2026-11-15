import { useMemo } from 'react';
import { Button, Badge } from '../../../shared/ui/components';
import { ChecklistMultiSelect, type ChecklistOption } from '../../../shared/ui/ChecklistMultiSelect';
import { SearchableSelect, type SearchableOption } from '../../../shared/ui/SearchableSelect';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';

export interface ProjectCommonFiltersState {
  searchQuery: string;
  selectedProjectId: string;
  selectedEmployeeId?: string;
  selectedSupervisorId?: string;
  selectedMemberId?: string;
  selectedTaskName: string;
  selectedStatuses: string[];
  selectedClient: string;
  fromDate: string;
  toDate: string;
}

export interface ProjectCommonFilterHeaderProps {
  activeTab: string; // 'projects' | 'tasks' | 'worklog'
  filters: ProjectCommonFiltersState;
  onFilterChange: (updated: Partial<ProjectCommonFiltersState>) => void;
  onResetFilters: () => void;
  projects?: any[];
  tasks?: any[];
  clients?: any[];
}

export function ProjectCommonFilterHeader({
  activeTab,
  filters,
  onFilterChange,
  onResetFilters,
  projects = [],
  tasks = [],
  clients = [],
}: ProjectCommonFilterHeaderProps) {
  const { user } = useAuth();
  const empHook = useEmployee() || {};
  const employees = Array.isArray(empHook.employees) ? empHook.employees : [];

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeClients = Array.isArray(clients) ? clients : [];

  // Options for ChecklistMultiSelect based on active tab
  const statusOptions: ChecklistOption[] = useMemo(() => {
    if (activeTab === 'projects') {
      return [
        { value: 'Not Started', label: 'Not Started' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Completed', label: 'Completed' },
      ];
    }
    if (activeTab === 'tasks') {
      return [
        { value: 'Pending Approval', label: '⚡ Pending Approval' },
        { value: 'To Do', label: '📝 To Do' },
        { value: 'In Progress', label: '⚙️ In Progress' },
        { value: 'Under Review', label: '🔍 Under Review' },
        { value: 'Completed', label: '✅ Completed' },
        { value: 'Rework', label: '🔄 Rework' },
      ];
    }
    return [
      { value: 'Approved', label: 'Approved' },
      { value: 'Pending Review', label: 'Pending Review' },
      { value: 'Rework', label: 'Rework' },
    ];
  }, [activeTab]);

  // Extract unique clients
  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    safeClients.forEach((c) => {
      if (typeof c === 'string' && c) set.add(c);
      else if (c && c.name) set.add(c.name);
    });
    safeProjects.forEach((p) => {
      if (p && p.client) set.add(p.client);
    });
    return Array.from(set).sort();
  }, [safeClients, safeProjects]);

  // Extract unique projects
  const projectOptions = useMemo(() => {
    return safeProjects.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      label: `${p.code ? `${p.code} - ` : ''}${p.title || 'Untitled Project'}`,
    }));
  }, [safeProjects]);

  // Extract unique task names
  const taskOptions = useMemo(() => {
    const set = new Set<string>();
    safeTasks.forEach((t) => {
      const name = t.title || t.name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [safeTasks]);

  // Searchable options for Supervisor filter
  const supervisorOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [];
    if (user) {
      list.push({
        value: user.id,
        label: `Me (${user.fullName || 'User'})`,
        subLabel: user.role || user.email,
      });
    }
    employees
      .filter((e) => e && e.id && e.id !== user?.id)
      .forEach((e) => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.id;
        list.push({
          value: e.id,
          label: name,
          subLabel: e.designation || e.department || e.email,
        });
      });
    return list;
  }, [employees, user]);

  // Searchable options for Member filter
  const memberOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [];
    if (user) {
      list.push({
        value: user.id,
        label: `Me (${user.fullName || 'User'})`,
        subLabel: user.role || user.email,
      });
    }
    employees
      .filter((e) => e && e.id && e.id !== user?.id)
      .forEach((e) => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.id;
        list.push({
          value: e.id,
          label: name,
          subLabel: e.designation || e.department || e.email,
        });
      });
    return list;
  }, [employees, user]);

  // Searchable options for Project Name filter
  const projectSelectOptions: SearchableOption[] = useMemo(() => {
    return safeProjects.map((p) => ({
      value: p.id,
      label: `${p.code ? `${p.code} - ` : ''}${p.title || 'Untitled Project'}`,
      subLabel: p.client || undefined,
    }));
  }, [safeProjects]);

  // Searchable options for Task Name filter
  const taskSelectOptions: SearchableOption[] = useMemo(() => {
    return taskOptions.map((name) => ({
      value: name,
      label: name,
    }));
  }, [taskOptions]);

  // Searchable options for Client filter
  const clientSelectOptions: SearchableOption[] = useMemo(() => {
    return clientOptions.map((c) => ({
      value: c,
      label: c,
    }));
  }, [clientOptions]);

  const currentStatuses = Array.isArray(filters.selectedStatuses) ? filters.selectedStatuses : [];

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.selectedProjectId && filters.selectedProjectId !== 'all') count++;
    if (filters.selectedSupervisorId && filters.selectedSupervisorId !== 'all') count++;
    if (filters.selectedMemberId && filters.selectedMemberId !== 'all') count++;
    if (!filters.selectedSupervisorId && !filters.selectedMemberId && filters.selectedEmployeeId && filters.selectedEmployeeId !== 'all') count++;
    if (filters.selectedTaskName && filters.selectedTaskName !== 'all') count++;
    if (currentStatuses.length > 0 && !currentStatuses.includes('all')) count++;
    if (filters.selectedClient && filters.selectedClient !== 'all') count++;
    if (filters.fromDate || filters.toDate) count++;
    return count;
  }, [filters, currentStatuses]);

  const selectedSupName = useMemo(() => {
    if (!filters.selectedSupervisorId || filters.selectedSupervisorId === 'all') return null;
    if (user && filters.selectedSupervisorId === user.id) return `Me (${user.fullName || 'User'})`;
    const emp = employees.find((e) => e && e.id === filters.selectedSupervisorId);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : filters.selectedSupervisorId;
  }, [filters.selectedSupervisorId, employees, user]);

  const selectedMemberName = useMemo(() => {
    if (!filters.selectedMemberId || filters.selectedMemberId === 'all') return null;
    if (user && filters.selectedMemberId === user.id) return `Me (${user.fullName || 'User'})`;
    const emp = employees.find((e) => e && e.id === filters.selectedMemberId);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : filters.selectedMemberId;
  }, [filters.selectedMemberId, employees, user]);

  const selectedEmpName = useMemo(() => {
    if (!filters.selectedEmployeeId || filters.selectedEmployeeId === 'all') return null;
    if (user && filters.selectedEmployeeId === user.id) return `Me (${user.fullName || 'User'})`;
    const emp = employees.find((e) => e && e.id === filters.selectedEmployeeId);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : filters.selectedEmployeeId;
  }, [filters.selectedEmployeeId, employees, user]);

  const selectedProjTitle = useMemo(() => {
    if (!filters.selectedProjectId || filters.selectedProjectId === 'all') return null;
    const proj = safeProjects.find((p) => p && p.id === filters.selectedProjectId);
    return proj ? `${proj.code ? `${proj.code} - ` : ''}${proj.title}` : filters.selectedProjectId;
  }, [filters.selectedProjectId, safeProjects]);

  return (
    <div
      style={{
        padding: '16px 20px',
        marginBottom: 20,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--e1)',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            🔍 Filters
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
              ({activeTab === 'projects' ? 'Projects View' : activeTab === 'tasks' ? 'Tasks View' : 'Task Worklog View'})
            </span>
          </span>

          {activeFiltersCount > 0 && (
            <Badge tone="brand" style={{ fontSize: 11, flexShrink: 0 }}>
              {activeFiltersCount} Active Filter{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
          )}

          {/* Active / Applied Filter Chips in the Top Row */}
          {filters.selectedSupervisorId && filters.selectedSupervisorId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Supervisor: {selectedSupName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedSupervisorId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedMemberId && filters.selectedMemberId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Member: {selectedMemberName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedMemberId: 'all' })}>×</span>
            </Badge>
          )}
          {!filters.selectedSupervisorId && !filters.selectedMemberId && filters.selectedEmployeeId && filters.selectedEmployeeId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Employee: {selectedEmpName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedEmployeeId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedProjectId && filters.selectedProjectId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Project: {selectedProjTitle}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedProjectId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedTaskName && filters.selectedTaskName !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Task: {filters.selectedTaskName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedTaskName: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedClient && filters.selectedClient !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Client: {filters.selectedClient}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedClient: 'all' })}>×</span>
            </Badge>
          )}
          {currentStatuses.length > 0 && !currentStatuses.includes('all') && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Status: {currentStatuses.join(', ')}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedStatuses: [] })}>×</span>
            </Badge>
          )}
          {(filters.fromDate || filters.toDate) && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Date Range: {filters.fromDate || 'Start'} to {filters.toDate || 'End'}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ fromDate: '', toDate: '' })}>×</span>
            </Badge>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
            ↺ Reset All Filters
          </Button>
        )}
      </div>

      {/* Filter Items Flex Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {/* 1. Supervisor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Supervisor
          </label>
          <SearchableSelect
            options={supervisorOptions}
            value={filters.selectedSupervisorId || 'all'}
            onChange={(val) => onFilterChange({ selectedSupervisorId: val })}
            allOptionLabel="👔 All Supervisors"
            searchPlaceholder="Search supervisors..."
            emptyMessage="No matching supervisors found"
          />
        </div>

        {/* 2. Member */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Member
          </label>
          <SearchableSelect
            options={memberOptions}
            value={filters.selectedMemberId || 'all'}
            onChange={(val) => onFilterChange({ selectedMemberId: val })}
            allOptionLabel="👥 All Members"
            searchPlaceholder="Search members..."
            emptyMessage="No matching members found"
          />
        </div>

        {/* 3. Project Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Project Name
          </label>
          <SearchableSelect
            options={projectSelectOptions}
            value={filters.selectedProjectId || 'all'}
            onChange={(val) => onFilterChange({ selectedProjectId: val })}
            allOptionLabel="📁 All Projects"
            searchPlaceholder="Search projects..."
            emptyMessage="No matching projects found"
          />
        </div>

        {/* 4. Task Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Task Name
          </label>
          <SearchableSelect
            options={taskSelectOptions}
            value={filters.selectedTaskName || 'all'}
            onChange={(val) => onFilterChange({ selectedTaskName: val })}
            allOptionLabel="✅ All Tasks"
            searchPlaceholder="Search tasks..."
            emptyMessage="No matching tasks found"
          />
        </div>

        {/* 5. Client */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Client
          </label>
          <SearchableSelect
            options={clientSelectOptions}
            value={filters.selectedClient || 'all'}
            onChange={(val) => onFilterChange({ selectedClient: val })}
            allOptionLabel="🏢 All Clients"
            searchPlaceholder="Search clients..."
            emptyMessage="No matching clients found"
          />
        </div>

        {/* 6. Context-Aware Status Checklist MultiSelect */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Status ({activeTab.toUpperCase()})
          </label>
          <ChecklistMultiSelect
            options={statusOptions}
            selectedValues={currentStatuses}
            onChange={(vals) => onFilterChange({ selectedStatuses: vals })}
            placeholder="All Statuses"
            searchPlaceholder="Search statuses..."
            style={{ width: '100%' }}
          />
        </div>

        {/* 7. Custom Date Range (From - To) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 260px', minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Custom Date Range (From - To)
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              className="kvj-input"
              value={filters.fromDate || ''}
              onChange={(e) => onFilterChange({ fromDate: e.target.value })}
              style={{ flex: 1, fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="kvj-input"
              value={filters.toDate || ''}
              onChange={(e) => onFilterChange({ toDate: e.target.value })}
              style={{ flex: 1, fontSize: 12 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
