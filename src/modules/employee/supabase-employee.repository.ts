import { SupabaseRepository } from '../../shared/integration/supabase-repository';
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
      .is('deletedAt', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as Employee | null;
  }

  async findTeamMembers(managerId: UUID): Promise<Employee[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('managerId', managerId)
      .is('deletedAt', null);

    if (error) throw new Error(error.message);
    return (data ?? []) as Employee[];
  }
}
