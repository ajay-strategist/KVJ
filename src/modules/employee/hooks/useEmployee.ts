import { useEffect, useState, useCallback } from 'react';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../employee.service';
import type { Employee } from '../employee.repository';
import { useAuth } from '../../auth/AuthProvider';

export function useEmployee() {
  const service = container.resolve(EMPLOYEE_SERVICE_TOKEN);
  const { principal, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const res = await service.listEmployees();
    if (res.ok) {
      setEmployees(res.value);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, [service]);

  const createEmployee = useCallback(async (data: Partial<Employee>) => {
    const actor = principal || { id: user?.id || 'u-admin', role: user?.role || 'ADMIN' };
    const res = await service.createEmployee(data, actor);
    if (res.ok) {
      setEmployees((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, principal, user]);

  const updateProfile = useCallback(async (id: string, patch: Partial<Employee>) => {
    if (!principal) return { ok: false, error: 'Unauthorized' };
    const res = await service.updateProfile(id, patch, { id: principal.id, role: principal.role });
    if (res.ok) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? res.value : e)));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, principal]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return { employees, loading, error, refresh: fetchEmployees, createEmployee, updateProfile };
}

export function useEmployeeProfile(employeeId?: string) {
  const service = container.resolve(EMPLOYEE_SERVICE_TOKEN);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [manager, setManager] = useState<Employee | undefined>(undefined);
  const [reports, setReports] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const pRes = await service.getProfile(employeeId);
    if (pRes.ok) {
      setProfile(pRes.value);
      const hRes = await service.getHierarchy(employeeId);
      if (hRes.ok) {
        setManager(hRes.value.manager);
        setReports(hRes.value.directReports);
      }
      setError(null);
    } else {
      setError(pRes.error.message);
    }
    setLoading(false);
  }, [service, employeeId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, manager, reports, loading, error, refresh: fetchProfile };
}
