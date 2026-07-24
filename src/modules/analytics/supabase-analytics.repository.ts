import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import { supabase } from '../../shared/integration/supabase';
import type {
  KpiDefinition, IKpiDefinitionRepository,
  SavedReport, ISavedReportRepository
} from './analytics.repository';

export class SupabaseKpiDefinitionRepository extends SupabaseRepository<KpiDefinition> implements IKpiDefinitionRepository {
  constructor() { super('kpi_definitions'); }

  async findByCode(code: string): Promise<KpiDefinition | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('code', code)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.warn(`Supabase findByCode warning on ${this.tableName}:`, error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as KpiDefinition) : null;
  }
}

export class SupabaseSavedReportRepository extends SupabaseRepository<SavedReport> implements ISavedReportRepository {
  constructor() { super('saved_reports'); }
}

