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
  const [allLeaves, setAllLeaves] = useState<LeaveRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyLeaves = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await service.getEmployeeLeaves(user.id);
    if (res.ok) {
      setLeaves(Array.isArray(res.value) ? res.value : []);
      setError(null);
    } else {
      setLeaves([]);
      setError(res.error.message);
    }
    setLoading(false);
  }, [service, user]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!can(principal, 'leave', 'approve')) return;
    setLoading(true);
    const res = await service.listPendingApprovals();
    if (res.ok) {
      setPendingApprovals(Array.isArray(res.value) ? res.value : []);
      setError(null);
    } else {
      setPendingApprovals([]);
      setError(res.error.message);
    }
    setLoading(false);
  }, [service, principal]);

  const fetchAllLeaves = useCallback(async () => {
    if (!can(principal, 'leave', 'approve')) return;
    setLoading(true);
    const res = await service.listAllLeaves();
    if (res.ok) {
      setAllLeaves(Array.isArray(res.value) ? res.value : []);
      setError(null);
    } else {
      setAllLeaves([]);
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
    const empId = user?.id || 'emp-user';
    setLoading(true);
    const res = await service.applyLeave(empId, type, start, end, reason, halfDay, medUrl);
    setLoading(false);
    if (res.ok) {
      setLeaves((prev) => [res.value, ...(Array.isArray(prev) ? prev : [])]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error?.message || 'Failed to submit leave request.' };
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

  const uploadMedicalCertificate = useCallback(async (leaveId: string, medicalCertUrl: string) => {
    setLoading(true);
    const res = await service.updateMedicalCertificate(leaveId, medicalCertUrl);
    setLoading(false);
    if (res.ok) {
      setLeaves((prev) => prev.map((l) => (l.id === leaveId ? res.value : l)));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service]);

  useEffect(() => {
    fetchMyLeaves();
    fetchPendingApprovals();
    fetchAllLeaves();
  }, [fetchMyLeaves, fetchPendingApprovals, fetchAllLeaves]);

  return {
    leaves,
    allLeaves,
    pendingApprovals,
    loading,
    error,
    applyLeave,
    uploadMedicalCertificate,
    approveLeave,
    rejectLeave,
    refreshMyLeaves: fetchMyLeaves,
    refreshPending: fetchPendingApprovals,
    refreshAll: fetchAllLeaves,
  };
}
