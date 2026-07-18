import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export interface KpiDefinition extends Entity {
  code: string;
  name: string;
  category: string;
  formula: string;
  currentValue: number;
  targetValue: number;
}

export interface SavedReport extends Entity {
  title: string;
  creatorId: UUID;
  filters: Record<string, any>;
  groupingBy?: string;
  sortingBy?: string;
}

export interface IKpiDefinitionRepository extends IRepository<KpiDefinition> {
  findByCode(code: string): Promise<KpiDefinition | null>;
}
export interface ISavedReportRepository extends IRepository<SavedReport> {}

export const KPI_DEFINITION_REPOSITORY_TOKEN = createToken<IKpiDefinitionRepository>('KpiDefinitionRepository');
export const SAVED_REPORT_REPOSITORY_TOKEN = createToken<ISavedReportRepository>('SavedReportRepository');
