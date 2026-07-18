import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { Actor, UUID } from '../types';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'delegated';

export interface ApprovalStep {
  id: string;
  name: string;
  approverRoles: string[];
  approverIds?: UUID[];
  type: 'single' | 'sequential' | 'parallel';
  status: ApprovalRequestStatus;
  decisions: {
    approverId: UUID;
    action: 'approved' | 'rejected';
    timestamp: string;
    comments?: string;
  }[];
}

export interface ApprovalRequest {
  id: UUID;
  entityId: UUID;
  entityType: string;
  steps: ApprovalStep[];
  currentStepIndex: number;
  status: ApprovalRequestStatus;
  delegations: {
    fromApproverId: UUID;
    toApproverId: UUID;
    expiryDate?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface IApprovalEngine {
  createRequest(entityId: UUID, entityType: string, steps: ApprovalStep[]): Promise<Result<ApprovalRequest>>;
  submitDecision(
    requestId: UUID,
    approver: Actor,
    action: 'approved' | 'rejected',
    comments?: string
  ): Promise<Result<ApprovalRequest>>;
  delegateApproval(requestId: UUID, fromApproverId: UUID, toApproverId: UUID, expiryDate?: string): Promise<Result<ApprovalRequest>>;
  getPendingApprovals(approver: Actor): Promise<ApprovalRequest[]>;
}

export const APPROVAL_ENGINE_TOKEN = createToken<IApprovalEngine>('ApprovalEngine');

export class ApprovalEngine implements IApprovalEngine {
  private requests = new Map<UUID, ApprovalRequest>();

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async createRequest(entityId: UUID, entityType: string, steps: ApprovalStep[]): Promise<Result<ApprovalRequest>> {
    const ts = new Date().toISOString();
    const request: ApprovalRequest = {
      id: this.uuid(),
      entityId,
      entityType,
      steps: steps.map((s) => ({ ...s, status: 'pending', decisions: [] })),
      currentStepIndex: 0,
      status: 'pending',
      delegations: [],
      createdAt: ts,
      updatedAt: ts,
    };
    this.requests.set(request.id, request);
    return Ok(request);
  }

  async submitDecision(
    requestId: UUID,
    approver: Actor,
    action: 'approved' | 'rejected',
    comments?: string
  ): Promise<Result<ApprovalRequest>> {
    const req = this.requests.get(requestId);
    if (!req) return Err(AppError.notFound('Approval request not found.'));

    if (req.status !== 'pending') {
      return Err(AppError.businessRule('This approval request is already completed.'));
    }

    const currentStep = req.steps[req.currentStepIndex];
    if (!currentStep) return Err(AppError.internal('Current approval step is undefined.'));

    // Check if the approver is authorized for this step (or delegated to)
    const isDelegated = req.delegations.some((d) => d.toApproverId === approver.id && d.fromApproverId === currentStep.approverIds?.[0]);
    const isAuthorizedRole = currentStep.approverRoles.includes(approver.role);
    const isAuthorizedId = currentStep.approverIds?.includes(approver.id);

    if (!isAuthorizedRole && !isAuthorizedId && !isDelegated) {
      return Err(AppError.forbidden('You are not authorized to approve this step.'));
    }

    const ts = new Date().toISOString();
    currentStep.decisions.push({
      approverId: approver.id,
      action,
      timestamp: ts,
      comments,
    });

    if (action === 'rejected') {
      // Rejection immediately fails the entire approval request
      currentStep.status = 'rejected';
      req.status = 'rejected';
    } else {
      // Check if step is completed based on type
      if (currentStep.type === 'single') {
        currentStep.status = 'approved';
      } else if (currentStep.type === 'parallel') {
        // Unanimous parallel check: all designated approver IDs must have approved
        const approvedIds = currentStep.decisions.filter((d) => d.action === 'approved').map((d) => d.approverId);
        const allApproved = currentStep.approverIds?.every((id) => approvedIds.includes(id));
        if (allApproved) currentStep.status = 'approved';
      }

      // If current step is approved, advance
      if (currentStep.status === 'approved') {
        if (req.currentStepIndex + 1 < req.steps.length) {
          req.currentStepIndex++;
        } else {
          req.status = 'approved';
        }
      }
    }

    req.updatedAt = ts;
    this.requests.set(req.id, req);
    return Ok(req);
  }

  async delegateApproval(requestId: UUID, fromApproverId: UUID, toApproverId: UUID, expiryDate?: string): Promise<Result<ApprovalRequest>> {
    const req = this.requests.get(requestId);
    if (!req) return Err(AppError.notFound('Approval request not found.'));

    req.delegations.push({ fromApproverId, toApproverId, expiryDate });
    req.updatedAt = new Date().toISOString();
    this.requests.set(req.id, req);
    return Ok(req);
  }

  async getPendingApprovals(approver: Actor): Promise<ApprovalRequest[]> {
    const all = [...this.requests.values()];
    return all.filter((req) => {
      if (req.status !== 'pending') return false;
      const currentStep = req.steps[req.currentStepIndex];
      if (!currentStep) return false;

      const isDelegated = req.delegations.some((d) => d.toApproverId === approver.id && d.fromApproverId === currentStep.approverIds?.[0]);
      const matchesRole = currentStep.approverRoles.includes(approver.role);
      const matchesId = currentStep.approverIds?.includes(approver.id);

      return matchesRole || matchesId || isDelegated;
    });
  }
}
