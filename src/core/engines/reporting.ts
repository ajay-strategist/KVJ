import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';

export interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  dataSourceName: string;
  fields: { key: string; label: string; type: 'string' | 'number' | 'date' }[];
  filters: { key: string; label: string; type: 'select' | 'date' | 'text'; options?: string[] }[];
}

export interface IReportingEngine {
  registerReport(report: ReportDefinition): void;
  getReport(id: string): ReportDefinition | null;
  registerDataSource(name: string, fetcher: (filters: Record<string, any>) => Promise<any[]>): void;
  runReport(reportId: string, filters: Record<string, any>): Promise<Result<any[]>>;
  exportCSV(data: any[], fields: string[]): string;
}

export const REPORTING_ENGINE_TOKEN = createToken<IReportingEngine>('ReportingEngine');

export class ReportingEngine implements IReportingEngine {
  private reports = new Map<string, ReportDefinition>();
  private dataSources = new Map<string, (filters: Record<string, any>) => Promise<any[]>>();

  registerReport(report: ReportDefinition): void {
    this.reports.set(report.id, report);
  }

  getReport(id: string): ReportDefinition | null {
    return this.reports.get(id) ?? null;
  }

  registerDataSource(name: string, fetcher: (filters: Record<string, any>) => Promise<any[]>) {
    this.dataSources.set(name, fetcher);
  }

  async runReport(reportId: string, filters: Record<string, any>): Promise<Result<any[]>> {
    const report = this.reports.get(reportId);
    if (!report) return Err(AppError.notFound(`Report definition ${reportId} not found.`));

    const fetcher = this.dataSources.get(report.dataSourceName);
    if (!fetcher) return Err(AppError.notFound(`Data source ${report.dataSourceName} not registered.`));

    try {
      const data = await fetcher(filters);
      return Ok(data);
    } catch (e: any) {
      return Err(AppError.internal(`Failed running report: ${e.message}`));
    }
  }

  exportCSV(data: any[], fields: string[]): string {
    if (data.length === 0) return '';
    
    // Header
    const csvRows = [fields.join(',')];

    for (const row of data) {
      const values = fields.map((f) => {
        const val = row[f];
        const escaped = String(val ?? '').replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
