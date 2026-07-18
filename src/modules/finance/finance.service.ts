import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import {
  BUDGET_REPOSITORY_TOKEN,
  EXPENSE_CLAIM_REPOSITORY_TOKEN,
  TRAVEL_REQUEST_REPOSITORY_TOKEN,
  VENDOR_REPOSITORY_TOKEN,
  PURCHASE_ORDER_REPOSITORY_TOKEN,
  ASSET_REPOSITORY_TOKEN,
  SALARY_STRUCTURE_REPOSITORY_TOKEN,
  type Budget, type ExpenseClaim, type TravelRequest, type Vendor,
  type PurchaseOrder, type Asset, type SalaryStructure
} from './finance.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { APPROVAL_ENGINE_TOKEN } from '../../core/engines/approval';
import { NOTIFICATION_ENGINE_TOKEN } from '../../core/engines/notification';

export interface IFinanceService {
  createBudget(data: Partial<Budget>, actor: Actor): Promise<Result<Budget>>;
  createExpenseClaim(data: Partial<ExpenseClaim>, actor: Actor): Promise<Result<ExpenseClaim>>;
  approveExpenseClaim(claimId: UUID, actor: Actor): Promise<Result<ExpenseClaim>>;
  createTravelRequest(data: Partial<TravelRequest>, actor: Actor): Promise<Result<TravelRequest>>;
  createVendor(data: Partial<Vendor>, actor: Actor): Promise<Result<Vendor>>;
  createPurchaseOrder(data: Partial<PurchaseOrder>, actor: Actor): Promise<Result<PurchaseOrder>>;
  registerAsset(data: Partial<Asset>, actor: Actor): Promise<Result<Asset>>;
  assignAsset(assetId: UUID, employeeId: UUID, actor: Actor): Promise<Result<Asset>>;
  updateSalaryStructure(data: Partial<SalaryStructure>, actor: Actor): Promise<Result<SalaryStructure>>;
}

export const FINANCE_SERVICE_TOKEN = createToken<IFinanceService>('FinanceService');

export class FinanceService implements IFinanceService {
  private get budgetRepo() { return container.resolve(BUDGET_REPOSITORY_TOKEN); }
  private get expenseRepo() { return container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN); }
  private get travelRepo() { return container.resolve(TRAVEL_REQUEST_REPOSITORY_TOKEN); }
  private get vendorRepo() { return container.resolve(VENDOR_REPOSITORY_TOKEN); }
  private get poRepo() { return container.resolve(PURCHASE_ORDER_REPOSITORY_TOKEN); }
  private get assetRepo() { return container.resolve(ASSET_REPOSITORY_TOKEN); }
  private get salaryRepo() { return container.resolve(SALARY_STRUCTURE_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get approval() { return container.resolve(APPROVAL_ENGINE_TOKEN); }
  private get notification() { return container.resolve(NOTIFICATION_ENGINE_TOKEN); }

  async createBudget(data: Partial<Budget>, actor: Actor): Promise<Result<Budget>> {
    try {
      const budget = await this.budgetRepo.create(data, actor);
      await this.activity.log('finance', budget.id, actor, 'create', `Created budget for ${budget.department} FY: ${budget.fiscalYear}`);
      return Ok(budget);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

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

  async createVendor(data: Partial<Vendor>, actor: Actor): Promise<Result<Vendor>> {
    try {
      const vendor = await this.vendorRepo.create(data, actor);
      await this.activity.log('finance', vendor.id, actor, 'create', `Registered vendor ${vendor.name}`);
      return Ok(vendor);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async createPurchaseOrder(data: Partial<PurchaseOrder>, actor: Actor): Promise<Result<PurchaseOrder>> {
    try {
      const po = await this.poRepo.create({ ...data, status: 'submitted' }, actor);
      await this.activity.log('finance', po.id, actor, 'create', `Generated purchase order ${po.poNumber}`);
      await this.audit.log(actor, 'create', 'purchase_orders', po.id, { newValues: po });
      return Ok(po);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async registerAsset(data: Partial<Asset>, actor: Actor): Promise<Result<Asset>> {
    try {
      const asset = await this.assetRepo.create(data, actor);
      await this.activity.log('finance', asset.id, actor, 'create', `Registered hardware/software asset ${asset.name}`);
      return Ok(asset);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async assignAsset(assetId: UUID, employeeId: UUID, actor: Actor): Promise<Result<Asset>> {
    try {
      const asset = await this.assetRepo.findById(assetId);
      if (!asset) return Err(AppError.notFound('Asset not found.'));

      asset.assignedEmployeeId = employeeId;
      asset.status = 'assigned';

      const updated = await this.assetRepo.update(assetId, asset, actor);
      await this.activity.log('finance', assetId, actor, 'assign', `Assigned asset ${asset.name} to employee`);
      return Ok(updated);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updateSalaryStructure(data: Partial<SalaryStructure>, actor: Actor): Promise<Result<SalaryStructure>> {
    try {
      if (!data.employeeId) return Err(AppError.validation('Employee ID is required.'));
      const existing = await this.salaryRepo.findByEmployee(data.employeeId);
      
      let structure: SalaryStructure;
      if (existing) {
        structure = await this.salaryRepo.update(existing.id, { ...existing, ...data }, actor);
      } else {
        structure = await this.salaryRepo.create(data, actor);
      }

      await this.activity.log('finance', structure.id, actor, 'update', 'Updated employee salary structure details.');
      await this.audit.log(actor, 'update', 'salary_structures', structure.id, { newValues: structure });
      return Ok(structure);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }
}
