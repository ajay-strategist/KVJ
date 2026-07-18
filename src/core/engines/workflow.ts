import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { Actor, UUID } from '../types';

export interface WorkflowState {
  id: string;
  name: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface WorkflowTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  name: string;
  requiredRole?: string[];
  condition?: (instance: WorkflowInstance, actor: Actor) => boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  escalationRules?: {
    fromStateId: string;
    escalateAfterHours: number;
    toStateId: string;
    escalationAction: string;
  }[];
}

export interface WorkflowHistoryEntry {
  fromStateId: string;
  toStateId: string;
  transitionId: string;
  transitionName: string;
  actor: Actor;
  timestamp: string;
  comments?: string;
}

export interface WorkflowInstance {
  id: UUID;
  definitionId: string;
  entityId: UUID;
  currentStateId: string;
  history: WorkflowHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface IWorkflowEngine {
  registerDefinition(def: WorkflowDefinition): void;
  getDefinition(id: string): WorkflowDefinition | null;
  startWorkflow(definitionId: string, entityId: UUID, actor: Actor): Promise<Result<WorkflowInstance>>;
  triggerTransition(
    instanceId: UUID,
    transitionId: string,
    actor: Actor,
    comments?: string
  ): Promise<Result<WorkflowInstance>>;
  getActiveInstance(entityId: UUID): Promise<WorkflowInstance | null>;
  checkEscalations(): Promise<void>;
}

export const WORKFLOW_ENGINE_TOKEN = createToken<IWorkflowEngine>('WorkflowEngine');

export class WorkflowEngine implements IWorkflowEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private instances = new Map<UUID, WorkflowInstance>();

  registerDefinition(def: WorkflowDefinition): void {
    this.definitions.set(def.id, def);
  }

  getDefinition(id: string): WorkflowDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async startWorkflow(definitionId: string, entityId: UUID, actor: Actor): Promise<Result<WorkflowInstance>> {
    const def = this.definitions.get(definitionId);
    if (!def) return Err(AppError.notFound(`Workflow definition ${definitionId} not found.`));

    const initial = def.states.find((s) => s.isInitial);
    if (!initial) return Err(AppError.internal('Initial state not defined in workflow definition.'));

    const ts = new Date().toISOString();
    const instance: WorkflowInstance = {
      id: this.uuid(),
      definitionId,
      entityId,
      currentStateId: initial.id,
      history: [],
      createdAt: ts,
      updatedAt: ts,
    };

    this.instances.set(instance.id, instance);
    return Ok(instance);
  }

  async triggerTransition(
    instanceId: UUID,
    transitionId: string,
    actor: Actor,
    comments?: string
  ): Promise<Result<WorkflowInstance>> {
    const instance = this.instances.get(instanceId);
    if (!instance) return Err(AppError.notFound('Workflow instance not found.'));

    const def = this.definitions.get(instance.definitionId);
    if (!def) return Err(AppError.notFound('Workflow definition not found.'));

    const transition = def.transitions.find(
      (t) => t.id === transitionId && t.fromStateId === instance.currentStateId
    );
    if (!transition) {
      return Err(
        AppError.businessRule(
          `Invalid transition ${transitionId} from current state ${instance.currentStateId}.`
        )
      );
    }

    if (transition.requiredRole && transition.requiredRole.length > 0) {
      if (!transition.requiredRole.includes(actor.role)) {
        return Err(AppError.forbidden('You do not have the required role to trigger this transition.'));
      }
    }

    if (transition.condition && !transition.condition(instance, actor)) {
      return Err(AppError.businessRule('Transition conditions were not met.'));
    }

    const ts = new Date().toISOString();
    const entry: WorkflowHistoryEntry = {
      fromStateId: instance.currentStateId,
      toStateId: transition.toStateId,
      transitionId: transition.id,
      transitionName: transition.name,
      actor,
      timestamp: ts,
      comments,
    };

    instance.currentStateId = transition.toStateId;
    instance.history.push(entry);
    instance.updatedAt = ts;

    this.instances.set(instance.id, instance);
    return Ok(instance);
  }

  async getActiveInstance(entityId: UUID): Promise<WorkflowInstance | null> {
    const all = [...this.instances.values()];
    const active = all.find((inst) => inst.entityId === entityId);
    if (!active) return null;

    const def = this.definitions.get(active.definitionId);
    const currState = def?.states.find((s) => s.id === active.currentStateId);
    if (currState?.isFinal) return null;

    return active;
  }

  async checkEscalations(): Promise<void> {
    const nowTime = new Date().getTime();
    for (const instance of this.instances.values()) {
      const def = this.definitions.get(instance.definitionId);
      if (!def || !def.escalationRules) continue;

      const rule = def.escalationRules.find((r) => r.fromStateId === instance.currentStateId);
      if (!rule) continue;

      const updatedTime = new Date(instance.updatedAt).getTime();
      const elapsedHours = (nowTime - updatedTime) / 3600000;

      if (elapsedHours >= rule.escalateAfterHours) {
        console.log(`[Workflow Escalation] Escalating instance ${instance.id} to ${rule.toStateId}`);
        const systemActor: Actor = { id: '00000000-0000-0000-0000-000000000000' as UUID, role: 'SYSTEM', name: 'System Scheduler' };
        
        const transition = def.transitions.find(
          (t) => t.fromStateId === instance.currentStateId && t.toStateId === rule.toStateId
        );
        if (transition) {
          await this.triggerTransition(instance.id, transition.id, systemActor, `Auto-escalation: ${rule.escalationAction}`);
        }
      }
    }
  }
}
