import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { Employee, IEmployeeRepository } from './employee.repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseEmployeeRepository extends SupabaseRepository<Employee> implements IEmployeeRepository {
  constructor() {
    super('employees');
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.warn(`Supabase findByEmail warning on ${this.tableName}:`, error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as Employee) : null;
  }

  async findTeamMembers(managerId: UUID): Promise<Employee[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('reporting_manager_id', managerId)
      .is('deleted_at', null);

    if (error) {
      console.warn(`Supabase findTeamMembers warning on ${this.tableName}:`, error.message);
      return [];
    }
    return (data ?? []).map((row) => toCamelCaseObject(row) as Employee);
  }
}

