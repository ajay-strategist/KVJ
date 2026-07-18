import { MemoryRepository } from '../../core/repository';
import type {
  KpiDefinition, IKpiDefinitionRepository,
  SavedReport, ISavedReportRepository
} from './analytics.repository';

export class MockKpiDefinitionRepository extends MemoryRepository<KpiDefinition> implements IKpiDefinitionRepository {
  constructor() {
    super({ defaultStatus: 'active', pageSize: 50 }, [
      { id: '1', code: 'REV_GROWTH', name: 'Revenue Growth Rate', category: 'Finance', formula: 'Revenue / PrevRevenue - 1', currentValue: 12.5, targetValue: 15.0, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: null, updatedBy: null, deletedAt: null, deletedBy: null },
      { id: '2', code: 'BILL_UTIL', name: 'Billable Utilization', category: 'Projects', formula: 'Billable Hours / Total Hours', currentValue: 78, targetValue: 85, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: null, updatedBy: null, deletedAt: null, deletedBy: null },
      { id: '3', code: 'EMP_TURNOVER', name: 'Employee Turnover Rate', category: 'HR', formula: 'Departed / Avg Employees', currentValue: 4.2, targetValue: 5.0, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: null, updatedBy: null, deletedAt: null, deletedBy: null }
    ]);


  }

  async findByCode(code: string): Promise<KpiDefinition | null> {
    return [...this.store.values()].find((k) => k.code === code && !k.deletedAt) ?? null;
  }
}

export class MockSavedReportRepository extends MemoryRepository<SavedReport> implements ISavedReportRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, []); }
}
