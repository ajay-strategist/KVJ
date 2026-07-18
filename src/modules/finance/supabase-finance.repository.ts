import { SupabaseRepository } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import type {
  Budget, IBudgetRepository,
  ExpenseClaim, IExpenseClaimRepository,
  TravelRequest, ITravelRequestRepository,
  Vendor, IVendorRepository,
  PurchaseOrder, IPurchaseOrderRepository,
  Asset, IAssetRepository,
  SalaryStructure, ISalaryStructureRepository
} from './finance.repository';

export class SupabaseBudgetRepository extends SupabaseRepository<Budget> implements IBudgetRepository {
  constructor() { super('budgets'); }
}

export class SupabaseExpenseClaimRepository extends SupabaseRepository<ExpenseClaim> implements IExpenseClaimRepository {
  constructor() { super('expense_claims'); }
}

export class SupabaseTravelRequestRepository extends SupabaseRepository<TravelRequest> implements ITravelRequestRepository {
  constructor() { super('travel_requests'); }
}

export class SupabaseVendorRepository extends SupabaseRepository<Vendor> implements IVendorRepository {
  constructor() { super('vendors'); }
}

export class SupabasePurchaseOrderRepository extends SupabaseRepository<PurchaseOrder> implements IPurchaseOrderRepository {
  constructor() { super('purchase_orders'); }
}

export class SupabaseAssetRepository extends SupabaseRepository<Asset> implements IAssetRepository {
  constructor() { super('assets'); }
}

export class SupabaseSalaryStructureRepository extends SupabaseRepository<SalaryStructure> implements ISalaryStructureRepository {
  constructor() { super('salary_structures'); }

  async findByEmployee(employeeId: UUID): Promise<SalaryStructure | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employeeId', employeeId)
      .is('deletedAt', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as SalaryStructure | null;
  }
}
