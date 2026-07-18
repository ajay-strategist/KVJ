import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { ANALYTICS_SERVICE_TOKEN, type CalculatedMetrics } from '../analytics.service';
import {
  KPI_DEFINITION_REPOSITORY_TOKEN,
  SAVED_REPORT_REPOSITORY_TOKEN,
  type KpiDefinition, type SavedReport
} from '../analytics.repository';
import { useAuth } from '../../auth/AuthProvider';

type CallbackResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function useAnalytics() {
  const service = useMemo(() => container.resolve(ANALYTICS_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const kpiRepo = container.resolve(KPI_DEFINITION_REPOSITORY_TOKEN);
      const reportRepo = container.resolve(SAVED_REPORT_REPOSITORY_TOKEN);

      const [kpiPage, reportPage] = await Promise.all([
        kpiRepo.findMany(),
        reportRepo.findMany()
      ]);

      setKpis(kpiPage.data);
      setSavedReports(reportPage.data);

      if (user) {
        const metricsRes = await service.getCalculatedMetrics({ id: user.id, role: user.role });
        if (metricsRes.ok) setMetrics(metricsRes.value);

        const aiRes = await service.generateAiSummary({ id: user.id, role: user.role });
        if (aiRes.ok) setAiSummary(aiRes.value);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [service, user]);

  const registerKpi = useCallback(async (data: Partial<KpiDefinition>): Promise<CallbackResult<KpiDefinition>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.registerKpi(data, { id: user.id, role: user.role });
    if (res.ok) {
      setKpis((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateKpiValue = useCallback(async (code: string, value: number): Promise<CallbackResult<KpiDefinition>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateKpiValue(code, value, { id: user.id, role: user.role });
    if (res.ok) {
      setKpis((prev) => prev.map((k) => k.code === code ? res.value : k));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const saveReport = useCallback(async (data: Partial<SavedReport>): Promise<CallbackResult<SavedReport>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.saveReport({ ...data, creatorId: user.id }, { id: user.id, role: user.role });
    if (res.ok) {
      setSavedReports((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    kpis,
    savedReports,
    metrics,
    aiSummary,
    loading,
    error,
    registerKpi,
    updateKpiValue,
    saveReport,
    refresh: fetchAll,
  };
}
