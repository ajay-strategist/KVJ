import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import {
  KPI_DEFINITION_REPOSITORY_TOKEN,
  SAVED_REPORT_REPOSITORY_TOKEN,
  type KpiDefinition, type SavedReport
} from './analytics.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { SUMMARY_ENGINE_TOKEN } from '../../core/engines/ai';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../employee/employee.repository';
import { COURSE_REPOSITORY_TOKEN } from '../training/training.repository';
import { PROJECT_REPOSITORY_TOKEN } from '../project/project.repository';
import { BUDGET_REPOSITORY_TOKEN } from '../finance/finance.repository';

export interface CalculatedMetrics {
  totalEmployees: number;
  activeCourses: number;
  activeProjects: number;
  totalBudgetsAllocated: number;
  totalBudgetsSpent: number;
}

export interface IAnalyticsService {
  registerKpi(data: Partial<KpiDefinition>, actor: Actor): Promise<Result<KpiDefinition>>;
  updateKpiValue(code: string, value: number, actor: Actor): Promise<Result<KpiDefinition>>;
  saveReport(data: Partial<SavedReport>, actor: Actor): Promise<Result<SavedReport>>;
  getCalculatedMetrics(actor: Actor): Promise<Result<CalculatedMetrics>>;
  generateAiSummary(actor: Actor): Promise<Result<string>>;
}

export const ANALYTICS_SERVICE_TOKEN = createToken<IAnalyticsService>('AnalyticsService');

export class AnalyticsService implements IAnalyticsService {
  private get kpiRepo() { return container.resolve(KPI_DEFINITION_REPOSITORY_TOKEN); }
  private get reportRepo() { return container.resolve(SAVED_REPORT_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get summaryAi() { return container.resolve(SUMMARY_ENGINE_TOKEN); }

  async registerKpi(data: Partial<KpiDefinition>, actor: Actor): Promise<Result<KpiDefinition>> {
    try {
      const kpi = await this.kpiRepo.create(data, actor);
      await this.activity.log('analytics', kpi.id, actor, 'create', `Registered KPI metric: ${kpi.name}`);
      return Ok(kpi);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateKpiValue(code: string, value: number, actor: Actor): Promise<Result<KpiDefinition>> {
    try {
      const kpi = await this.kpiRepo.findByCode(code);
      if (!kpi) return Err(AppError.notFound(`KPI code ${code} not found.`));

      kpi.currentValue = value;
      const updated = await this.kpiRepo.update(kpi.id, kpi, actor);
      await this.activity.log('analytics', kpi.id, actor, 'update', `Updated KPI ${code} value to ${value}`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async saveReport(data: Partial<SavedReport>, actor: Actor): Promise<Result<SavedReport>> {
    try {
      const report = await this.reportRepo.create(data, actor);
      await this.activity.log('analytics', report.id, actor, 'create', `Saved report parameters: ${report.title}`);
      await this.audit.log(actor, 'create', 'saved_reports', report.id, { newValues: report });
      return Ok(report);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async getCalculatedMetrics(actor: Actor): Promise<Result<CalculatedMetrics>> {
    try {
      const empRepo = container.resolve(EMPLOYEE_REPOSITORY_TOKEN);
      const courseRepo = container.resolve(COURSE_REPOSITORY_TOKEN);
      const projectRepo = container.resolve(PROJECT_REPOSITORY_TOKEN);
      const budgetRepo = container.resolve(BUDGET_REPOSITORY_TOKEN);

      const [emps, courses, projects, budgets] = await Promise.all([
        empRepo.findMany(),
        courseRepo.findMany(),
        projectRepo.findMany(),
        budgetRepo.findMany()
      ]);

      const totalBudgetsAllocated = budgets.data.reduce((sum, b) => sum + b.allocatedAmount, 0);
      const totalBudgetsSpent = budgets.data.reduce((sum, b) => sum + b.spentAmount, 0);

      return Ok({
        totalEmployees: emps.total,
        activeCourses: courses.total,
        activeProjects: projects.total,
        totalBudgetsAllocated,
        totalBudgetsSpent
      });
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async generateAiSummary(actor: Actor): Promise<Result<string>> {
    try {
      const summaryResult = await this.summaryAi.summarizeText('Enterprise operations are stable. Budgets remain within limits, project schedules are on track, and training batches show high student enrollment.', 100);
      if (summaryResult.ok) {
        return Ok(summaryResult.value);
      }
      return Err(summaryResult.error);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

}
