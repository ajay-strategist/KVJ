import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';

export interface Template {
  id: string;
  name: string;
  category: 'email' | 'certificate' | 'report' | 'notification' | 'letter' | 'whatsapp';
  subjectTemplate?: string;
  bodyTemplate: string;
}

export interface ITemplateEngine {
  registerTemplate(template: Template): void;
  getTemplate(id: string): Template | null;
  render(templateId: string, context: Record<string, string>): Result<{ subject?: string; body: string }>;
}

export const TEMPLATE_ENGINE_TOKEN = createToken<ITemplateEngine>('TemplateEngine');

export class TemplateEngine implements ITemplateEngine {
  private templates = new Map<string, Template>();

  constructor() {
    // Seed some standard platform templates
    this.registerTemplate({
      id: 'leave-applied',
      name: 'Leave Applied Notification',
      category: 'notification',
      bodyTemplate: 'Dear {{managerName}}, employee {{employeeName}} has applied for {{leaveType}} leave from {{startDate}} to {{endDate}}.',
    });
    this.registerTemplate({
      id: 'leave-approved',
      name: 'Leave Approved Notification',
      category: 'email',
      subjectTemplate: 'Your leave has been approved',
      bodyTemplate: 'Hi {{employeeName}}, your request for {{leaveType}} leave has been approved by {{approverName}}.',
    });
  }

  registerTemplate(template: Template): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): Template | null {
    return this.templates.get(id) ?? null;
  }

  render(templateId: string, context: Record<string, string>): Result<{ subject?: string; body: string }> {
    const tmpl = this.templates.get(templateId);
    if (!tmpl) return Err(AppError.notFound(`Template ${templateId} not found.`));

    const compile = (text: string) => {
      return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
        return context[key] !== undefined ? context[key] : `{{${key}}}`;
      });
    };

    const body = compile(tmpl.bodyTemplate);
    const subject = tmpl.subjectTemplate ? compile(tmpl.subjectTemplate) : undefined;

    return Ok({ subject, body });
  }
}
