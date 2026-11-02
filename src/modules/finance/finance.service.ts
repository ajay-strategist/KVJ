import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import {
  EXPENSE_CLAIM_REPOSITORY_TOKEN,
  TRAVEL_REQUEST_REPOSITORY_TOKEN,
  type ExpenseClaim, type TravelRequest
} from './finance.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { NOTIFICATION_ENGINE_TOKEN } from '../../core/engines/notification';

export interface IFinanceService {
  createExpenseClaim(data: Partial<ExpenseClaim>, actor: Actor): Promise<Result<ExpenseClaim>>;
  approveExpenseClaim(claimId: UUID, actor: Actor): Promise<Result<ExpenseClaim>>;
  createTravelRequest(data: Partial<TravelRequest>, actor: Actor): Promise<Result<TravelRequest>>;
}

export const FINANCE_SERVICE_TOKEN = createToken<IFinanceService>('FinanceService');

export class FinanceService implements IFinanceService {
  private get expenseRepo() { return container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN); }
  private get travelRepo() { return container.resolve(TRAVEL_REQUEST_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get notification() { return container.resolve(NOTIFICATION_ENGINE_TOKEN); }

  async createExpenseClaim(data: Partial<ExpenseClaim>, actor: Actor): Promise<Result<ExpenseClaim>> {
    try {
      const claim = await this.expenseRepo.create({ ...data, status: 'submitted' }, actor);
      await this.activity.log('finance', claim.id, actor, 'create', `Submitted expense claim of ${claim.amount}`);
      await this.audit.log(actor, 'create', 'expense_claims', claim.id, { newValues: claim });
      return Ok(claim);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async approveExpenseClaim(claimId: UUID, actor: Actor): Promise<Result<ExpenseClaim>> {
    try {
      const claim = await this.expenseRepo.findById(claimId);
      if (!claim) return Err(AppError.notFound('Claim not found.'));

      claim.status = 'approved';
      claim.approvedBy = actor.id;
      claim.approvedAt = new Date().toISOString();

      const updated = await this.expenseRepo.update(claimId, claim, actor);
      await this.activity.log('finance', claimId, actor, 'approve', `Approved expense claim of ${claim.amount}`);
      await this.notification.send({
        recipientId: claim.employeeId,
        title: 'Expense Claim Approved',
        body: `Your claim of $${claim.amount} has been approved.`,
        channels: ['in_app']
      });
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createTravelRequest(data: Partial<TravelRequest>, actor: Actor): Promise<Result<TravelRequest>> {
    try {
      const travel = await this.travelRepo.create({ ...data, status: 'submitted' }, actor);
      await this.activity.log('finance', travel.id, actor, 'create', `Submitted travel request to ${travel.destination}`);
      return Ok(travel);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }
}
