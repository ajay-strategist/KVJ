import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { Employee, IEmployeeRepository } from './employee.repository';
import type { Actor, QuerySpec, Page, UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';

export class SupabaseEmployeeRepository extends SupabaseRepository<Employee> implements IEmployeeRepository {
  constructor() {
    super('flwdsk_employees');
  }

  /**
   * Bi-directional mapping between application status vocabulary and PostgreSQL
   * check constraint values ('active', 'suspended', 'terminated').
   */
  private toAppEmployee(emp: Employee | null): Employee | null {
    if (!emp) return null;
    if ((emp.status as string) === 'terminated') {
      return { ...emp, status: 'relieved' };
    }
    return emp;
  }

  private sanitizeEmployeeData<D extends Partial<Employee>>(data: D): D {
    const sanitized = { ...data };
    if (sanitized.status) {
      const s = String(sanitized.status).toLowerCase();
      if (s === 'relieved' || s === 'resigned') {
        sanitized.status = 'terminated' as any;
      } else if (s === 'on_notice') {
        sanitized.status = 'active' as any;
      }
    }
    return sanitized;
  }

  override async create(data: Partial<Employee>, actor: Actor): Promise<Employee> {
    const created = await super.create(this.sanitizeEmployeeData(data), actor);
    return this.toAppEmployee(created)!;
  }

  override async update(id: UUID, patch: Partial<Employee>, actor: Actor): Promise<Employee> {
    const updated = await super.update(id, this.sanitizeEmployeeData(patch), actor);
    return this.toAppEmployee(updated)!;
  }

  override async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<Employee | null> {
    const emp = await super.findById(id, opts);
    return this.toAppEmployee(emp);
  }

  override async findMany(query: QuerySpec = {}): Promise<Page<Employee>> {
    const page = await super.findMany(query);
    return {
      ...page,
      data: (page.data || []).map((e) => this.toAppEmployee(e)!),
    };
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
    return data ? this.toAppEmployee(toCamelCaseObject(data) as Employee) : null;
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
    return (data ?? []).map((row) => this.toAppEmployee(toCamelCaseObject(row) as Employee)!);
  }
}

