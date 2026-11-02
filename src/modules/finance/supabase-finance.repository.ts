import { SupabaseRepository } from '../../shared/integration/supabase-repository';
import type {
  ExpenseClaim, IExpenseClaimRepository,
  TravelRequest, ITravelRequestRepository
} from './finance.repository';

export class SupabaseExpenseClaimRepository extends SupabaseRepository<ExpenseClaim> implements IExpenseClaimRepository {
  constructor() { super('flwdsk_expense_claims'); }
}

export class SupabaseTravelRequestRepository extends SupabaseRepository<TravelRequest> implements ITravelRequestRepository {
  constructor() { super('flwdsk_travel_requests'); }
}

