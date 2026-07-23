import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import { EMPLOYEE_REPOSITORY_TOKEN, type Employee } from './employee.repository';

export interface IEmployeeService {
  getProfile(employeeId: UUID): Promise<Result<Employee>>;
  createEmployee(data: Partial<Employee>, actor: Actor): Promise<Result<Employee>>;
  updateProfile(employeeId: UUID, patch: Partial<Employee>, actor: Actor): Promise<Result<Employee>>;
  getHierarchy(employeeId: UUID): Promise<Result<{ manager?: Employee; directReports: Employee[] }>>;
  listEmployees(): Promise<Result<Employee[]>>;
}

export class EmployeeService implements IEmployeeService {
  private get repo() {
    return container.resolve(EMPLOYEE_REPOSITORY_TOKEN);
  }

  async getProfile(employeeId: UUID): Promise<Result<Employee>> {
    try {
      const emp = await this.repo.findById(employeeId);
      if (!emp) return Err(AppError.notFound('Employee profile not found.'));
      return Ok(emp);
    } catch (err) {
      return Err(AppError.internal());
    }
  }

  async createEmployee(data: Partial<Employee>, actor: Actor): Promise<Result<Employee>> {
    try {
      const emp = await this.repo.create(data, actor);
      return Ok(emp);
    } catch (err) {
      return Err(AppError.internal());
    }
  }

  async updateProfile(employeeId: UUID, patch: Partial<Employee>, actor: Actor): Promise<Result<Employee>> {
    try {
      const existing = await this.repo.findById(employeeId);
      if (!existing) return Err(AppError.notFound('Employee profile not found.'));

      const updated = await this.repo.update(employeeId, patch, actor);
      return Ok(updated);
    } catch (err) {
      return Err(AppError.internal());
    }
  }

  async getHierarchy(employeeId: UUID): Promise<Result<{ manager?: Employee; directReports: Employee[] }>> {
    try {
      const emp = await this.repo.findById(employeeId);
      if (!emp) return Err(AppError.notFound('Employee profile not found.'));

      let manager: Employee | undefined;
      if (emp.reportingManagerId) {
        const mgr = await this.repo.findById(emp.reportingManagerId);
        if (mgr) manager = mgr;
      }

      const directReports = await this.repo.findTeamMembers(employeeId);
      return Ok({ manager, directReports });
    } catch (err) {
      return Err(AppError.internal());
    }
  }

  async listEmployees(): Promise<Result<Employee[]>> {
    try {
      const page = await this.repo.findMany({ pageSize: 100 });
      return Ok(page.data);
    } catch (err) {
      return Err(AppError.internal());
    }
  }
}

export const EMPLOYEE_SERVICE_TOKEN = createToken<IEmployeeService>('EmployeeService');
