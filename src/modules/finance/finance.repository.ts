import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type FinancialStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed' | 'paid';

export interface ExpenseClaim extends Entity {
  employeeId: UUID;
  category: string;
  amount: number;
  notes?: string;
  receiptUrl?: string;
  status: FinancialStatus;
  approvedBy?: UUID;
  approvedAt?: string;
}

export interface TravelRequest extends Entity {
  employeeId: UUID;
  destination: string;
  startDate: string;
  endDate: string;
  hotelBookingDetails?: string;
  advanceRequested?: number;
  status: FinancialStatus;
}

export interface IExpenseClaimRepository extends IRepository<ExpenseClaim> {}
export interface ITravelRequestRepository extends IRepository<TravelRequest> {}

export const EXPENSE_CLAIM_REPOSITORY_TOKEN = createToken<IExpenseClaimRepository>('ExpenseClaimRepository');
export const TRAVEL_REQUEST_REPOSITORY_TOKEN = createToken<ITravelRequestRepository>('TravelRequestRepository');
