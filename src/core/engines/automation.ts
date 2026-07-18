import { createToken } from '../registry';
import { eventBus } from '../event-bus';
import type { UUID } from '../types';

export interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: string;
  condition?: (payload: any) => boolean;
  action: (payload: any) => Promise<void> | void;
  delayMinutes?: number;
  isRecurring?: boolean;
  intervalMinutes?: number;
}

export interface IAutomationEngine {
  registerRule(rule: AutomationRule): void;
  getRules(): AutomationRule[];
  triggerAutomation(eventName: string, payload: any): Promise<void>;
}

export const AUTOMATION_ENGINE_TOKEN = createToken<IAutomationEngine>('AutomationEngine');

export class AutomationEngine implements IAutomationEngine {
  private rules: AutomationRule[] = [];
  private activeIntervals = new Map<string, any>();

  registerRule(rule: AutomationRule): void {
    this.rules.push(rule);

    // Dynamic subscription to the EventBus
    eventBus.on(rule.triggerEvent as any, (payload: any) => {
      this.handleEventTrigger(rule, payload);
    });

    // If recurring and has interval, trigger right away
    if (rule.isRecurring && rule.intervalMinutes) {
      const intervalMs = rule.intervalMinutes * 60000;
      const intervalId = setInterval(() => {
        this.executeRule(rule, {});
      }, intervalMs);
      this.activeIntervals.set(rule.id, intervalId);
    }
  }

  getRules(): AutomationRule[] {
    return this.rules;
  }

  private handleEventTrigger(rule: AutomationRule, payload: any): void {
    if (rule.condition && !rule.condition(payload)) {
      return;
    }

    if (rule.delayMinutes && rule.delayMinutes > 0) {
      setTimeout(() => {
        this.executeRule(rule, payload);
      }, rule.delayMinutes * 60000);
    } else {
      this.executeRule(rule, payload);
    }
  }

  private async executeRule(rule: AutomationRule, payload: any): Promise<void> {
    try {
      console.log(`[Automation Engine] Executing rule "${rule.name}" (${rule.id})`);
      await rule.action(payload);
    } catch (err) {
      console.error(`[Automation Engine] Error executing rule "${rule.id}":`, err);
    }
  }

  async triggerAutomation(eventName: string, payload: any): Promise<void> {
    const matching = this.rules.filter((r) => r.triggerEvent === eventName);
    for (const rule of matching) {
      this.handleEventTrigger(rule, payload);
    }
  }

  // Helper to clear resources
  shutdown(): void {
    for (const intervalId of this.activeIntervals.values()) {
      clearInterval(intervalId);
    }
    this.activeIntervals.clear();
  }
}
