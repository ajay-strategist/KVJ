import { useMemo } from 'react';
import { Button, Badge } from '../../../shared/ui/components';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';

export interface ProjectCommonFiltersState {
  searchQuery: string;
  selectedProjectId: string;
  selectedEmployeeId: string;
  selectedTaskName: string;
  selectedStatus: string;
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

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.selectedProjectId && filters.selectedProjectId !== 'all') count++;
    if (filters.selectedEmployeeId && filters.selectedEmployeeId !== 'all') count++;
    if (filters.selectedTaskName && filters.selectedTaskName !== 'all') count++;
    if (filters.selectedStatus && filters.selectedStatus !== 'all') count++;
    if (filters.selectedClient && filters.selectedClient !== 'all') count++;
    if (filters.fromDate || filters.toDate) count++;
    return count;
  }, [filters]);

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
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔍 Common Filters
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted, #64748b)' }}>
              ({activeTab === 'projects' ? 'Projects View' : activeTab === 'tasks' ? 'Tasks View' : 'Task Worklog View'})
            </span>
          </span>
          {activeFiltersCount > 0 && (
            <Badge tone="brand" style={{ fontSize: 11 }}>
              {activeFiltersCount} Active Filter{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ↺ Reset All Filters
          </Button>
        )}
      </div>

      {/* Filter Items Flex Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {/* 1. Search Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Search Bar
          </label>
          <input
            type="text"
            className="kvj-input"
            value={filters.searchQuery || ''}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search title, code, client…"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          />
        </div>

        {/* 2. Employee (Supervisor / Member) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Employee (Supervisor / Member)
          </label>
          <select
            className="kvj-select"
            value={filters.selectedEmployeeId || 'all'}
            onChange={(e) => onFilterChange({ selectedEmployeeId: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          >
            <option value="all">👥 All Employees</option>
            {user && <option value={user.id}>Me ({user.fullName})</option>}
            {employees.filter((e) => e && e.id && e.id !== user?.id).map((e) => {
              const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.id;
              return <option key={e.id} value={e.id}>{name}</option>;
            })}
          </select>
        </div>

        {/* 3. Project Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Project Name
          </label>
          <select
            className="kvj-select"
            value={filters.selectedProjectId || 'all'}
            onChange={(e) => onFilterChange({ selectedProjectId: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          >
            <option value="all">📁 All Projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Task Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Task Name
          </label>
          <select
            className="kvj-select"
            value={filters.selectedTaskName || 'all'}
            onChange={(e) => onFilterChange({ selectedTaskName: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          >
            <option value="all">✅ All Tasks</option>
            {taskOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Client */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Client
          </label>
          <select
            className="kvj-select"
            value={filters.selectedClient || 'all'}
            onChange={(e) => onFilterChange({ selectedClient: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          >
            <option value="all">🏢 All Clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 6. Context-Aware Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Status ({activeTab.toUpperCase()})
          </label>
          <select
            className="kvj-select"
            value={filters.selectedStatus || 'all'}
            onChange={(e) => onFilterChange({ selectedStatus: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
          >
            <option value="all">🏷️ All Statuses</option>
            {activeTab === 'projects' ? (
              <>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </>
            ) : activeTab === 'tasks' ? (
              <>
                <option value="Pending Approval">Pending Approval</option>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Under Review">Under Review</option>
                <option value="Completed">Completed</option>
                <option value="Rework">Rework</option>
              </>
            ) : (
              <>
                <option value="Approved">Approved</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Rework">Rework</option>
              </>
            )}
          </select>
        </div>

        {/* 7. Custom Date Range (From - To) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 260px', minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Custom Date Range (From - To)
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              className="kvj-input"
              value={filters.fromDate || ''}
              onChange={(e) => onFilterChange({ fromDate: e.target.value })}
              style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>to</span>
            <input
              type="date"
              className="kvj-input"
              value={filters.toDate || ''}
              onChange={(e) => onFilterChange({ toDate: e.target.value })}
              style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-surface, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
            />
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--border, #e2e8f0)' }}>
          {filters.searchQuery && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Search: "{filters.searchQuery}"
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ searchQuery: '' })}>×</span>
            </Badge>
          )}
          {filters.selectedEmployeeId && filters.selectedEmployeeId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Employee: {selectedEmpName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedEmployeeId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedProjectId && filters.selectedProjectId !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Project: {selectedProjTitle}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedProjectId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedTaskName && filters.selectedTaskName !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Task: {filters.selectedTaskName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedTaskName: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedClient && filters.selectedClient !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Client: {filters.selectedClient}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedClient: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedStatus && filters.selectedStatus !== 'all' && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Status: {filters.selectedStatus}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedStatus: 'all' })}>×</span>
            </Badge>
          )}
          {(filters.fromDate || filters.toDate) && (
            <Badge tone="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Date Range: {filters.fromDate || 'Start'} to {filters.toDate || 'End'}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ fromDate: '', toDate: '' })}>×</span>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
