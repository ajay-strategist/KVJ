import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { LEAVE_SERVICE_TOKEN } from '../leave.service';
import type { LeaveRecord } from '../leave.repository';
import { useAuth } from '../../auth/AuthProvider';
import { can } from '../../../shared/permissions/permission-engine';

export function useLeave() {
  const service = useMemo(() => container.resolve(LEAVE_SERVICE_TOKEN), []);
  const { user, principal } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyLeaves = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await service.getEmployeeLeaves(user.id);
    if (res.ok) {
      setLeaves(res.value);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, [service, user]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!can(principal, 'leave', 'approve')) return;
    setLoading(true);
    const res = await service.listPendingApprovals();
    if (res.ok) {
      setPendingApprovals(res.value);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, [service, principal]);

  const applyLeave = useCallback(async (
    type: string,
    start: string,
    end: string,
    reason: string,
    halfDay?: boolean,
    medUrl?: string
  ) => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    setLoading(true);
    const res = await service.applyLeave(user.id, type, start, end, reason, halfDay, medUrl);
    setLoading(false);
    if (res.ok) {
      setLeaves((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const approveLeave = useCallback(async (id: string, notes?: string) => {
    if (!principal) return { ok: false, error: 'Unauthorized' };
    setLoading(true);
    const res = await service.approveLeave(id, { id: principal.id, role: principal.role }, notes);
    setLoading(false);
    if (res.ok) {
      setPendingApprovals((prev) => prev.filter((l) => l.id !== id));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, principal]);

  const rejectLeave = useCallback(async (id: string, notes?: string) => {
    if (!principal) return { ok: false, error: 'Unauthorized' };
    setLoading(true);
    const res = await service.rejectLeave(id, { id: principal.id, role: principal.role }, notes);
    setLoading(false);
    if (res.ok) {
      setPendingApprovals((prev) => prev.filter((l) => l.id !== id));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, principal]);

  useEffect(() => {
    fetchMyLeaves();
    fetchPendingApprovals();
  }, [fetchMyLeaves, fetchPendingApprovals]);

  return {
    leaves,
    pendingApprovals,
    loading,
    error,
    applyLeave,
    approveLeave,
    rejectLeave,
    refreshMyLeaves: fetchMyLeaves,
    refreshPending: fetchPendingApprovals,
  };
}
