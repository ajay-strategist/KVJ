import { useMemo } from 'react';
import { Card, Button, Badge } from '../../../shared/ui/components';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { useAuth } from '../../auth/AuthProvider';

export interface ProjectCommonFiltersState {
  searchQuery: string;
  selectedProjectId: string;
  selectedEmployeeId: string;
  selectedStatus: string;
  selectedClient: string;
  selectedDate: string;
}

export interface ProjectCommonFilterHeaderProps {
  filters: ProjectCommonFiltersState;
  onFilterChange: (updated: Partial<ProjectCommonFiltersState>) => void;
  onResetFilters: () => void;
  projects?: any[];
  clients?: any[];
}

export function ProjectCommonFilterHeader({
  filters,
  onFilterChange,
  onResetFilters,
  projects = [],
  clients = [],
}: ProjectCommonFilterHeaderProps) {
  const { user } = useAuth();
  const { employees = [] } = useEmployee() || {};

  // Extract unique clients
  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.name) set.add(c.name);
    });
    projects.forEach((p) => {
      if (p.client) set.add(p.client);
    });
    return Array.from(set).sort();
  }, [clients, projects]);

  // Extract unique project list
  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      label: `${p.code ? `${p.code} - ` : ''}${p.title}`,
    }));
  }, [projects]);

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.selectedProjectId !== 'all') count++;
    if (filters.selectedEmployeeId !== 'all') count++;
    if (filters.selectedStatus !== 'all') count++;
    if (filters.selectedClient !== 'all') count++;
    if (filters.selectedDate) count++;
    return count;
  }, [filters]);

  const selectedEmpName = useMemo(() => {
    if (filters.selectedEmployeeId === 'all') return null;
    if (user && filters.selectedEmployeeId === user.id) return `Me (${user.fullName})`;
    const emp = employees.find((e) => e.id === filters.selectedEmployeeId);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : filters.selectedEmployeeId;
  }, [filters.selectedEmployeeId, employees, user]);

  const selectedProjTitle = useMemo(() => {
    if (filters.selectedProjectId === 'all') return null;
    const proj = projects.find((p) => p.id === filters.selectedProjectId);
    return proj ? `${proj.code} - ${proj.title}` : filters.selectedProjectId;
  }, [filters.selectedProjectId, projects]);

  return (
    <Card style={{ padding: '14px 18px', marginBottom: 18, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔍 Common Filters
          </span>
          {activeFiltersCount > 0 && (
            <Badge variant="primary" style={{ fontSize: 11 }}>
              {activeFiltersCount} Active
            </Badge>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ↺ Reset All Filters
          </Button>
        )}
      </div>

      {/* Filter Form Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
        {/* Search Query */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SEARCH
          </label>
          <input
            type="text"
            className="kvj-input"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search project, task, client…"
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Project Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            PROJECT NAME
          </label>
          <select
            className="kvj-select"
            value={filters.selectedProjectId}
            onChange={(e) => onFilterChange({ selectedProjectId: e.target.value })}
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="all">📁 All Projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            EMPLOYEE (SUPERVISOR / MEMBER)
          </label>
          <select
            className="kvj-select"
            value={filters.selectedEmployeeId}
            onChange={(e) => onFilterChange({ selectedEmployeeId: e.target.value })}
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="all">👥 All Employees</option>
            {user && <option value={user.id}>Me ({user.fullName})</option>}
            {(employees || []).filter(e => e.id !== user?.id).map((e) => {
              const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
              return <option key={e.id} value={e.id}>{name}</option>;
            })}
          </select>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            STATUS
          </label>
          <select
            className="kvj-select"
            value={filters.selectedStatus}
            onChange={(e) => onFilterChange({ selectedStatus: e.target.value })}
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="all">🏷️ All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Under Review">Under Review</option>
            <option value="Completed">Completed</option>
            <option value="Rework">Rework</option>
          </select>
        </div>

        {/* Client */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            CLIENT
          </label>
          <select
            className="kvj-select"
            value={filters.selectedClient}
            onChange={(e) => onFilterChange({ selectedClient: e.target.value })}
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="all">🏢 All Clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            DATE / ACTIVITY DATE
          </label>
          <input
            type="date"
            className="kvj-input"
            value={filters.selectedDate}
            onChange={(e) => onFilterChange({ selectedDate: e.target.value })}
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          {filters.searchQuery && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Search: "{filters.searchQuery}"
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ searchQuery: '' })}>×</span>
            </Badge>
          )}
          {filters.selectedProjectId !== 'all' && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Project: {selectedProjTitle}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedProjectId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedEmployeeId !== 'all' && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Employee: {selectedEmpName}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedEmployeeId: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedStatus !== 'all' && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Status: {filters.selectedStatus}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedStatus: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedClient !== 'all' && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Client: {filters.selectedClient}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedClient: 'all' })}>×</span>
            </Badge>
          )}
          {filters.selectedDate && (
            <Badge variant="neutral" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              Date: {filters.selectedDate}
              <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => onFilterChange({ selectedDate: '' })}>×</span>
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
