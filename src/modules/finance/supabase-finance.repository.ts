import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
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
  constructor() { super('flwdsk_budgets'); }
}

export class SupabaseExpenseClaimRepository extends SupabaseRepository<ExpenseClaim> implements IExpenseClaimRepository {
  constructor() { super('flwdsk_expense_claims'); }
}

export class SupabaseTravelRequestRepository extends SupabaseRepository<TravelRequest> implements ITravelRequestRepository {
  constructor() { super('flwdsk_travel_requests'); }
}

export class SupabaseVendorRepository extends SupabaseRepository<Vendor> implements IVendorRepository {
  constructor() { super('flwdsk_vendors'); }
}

export class SupabasePurchaseOrderRepository extends SupabaseRepository<PurchaseOrder> implements IPurchaseOrderRepository {
  constructor() { super('flwdsk_purchase_orders'); }
}

export class SupabaseAssetRepository extends SupabaseRepository<Asset> implements IAssetRepository {
  constructor() { super('flwdsk_assets'); }
}

export class SupabaseSalaryStructureRepository extends SupabaseRepository<SalaryStructure> implements ISalaryStructureRepository {
  constructor() { super('flwdsk_salary_structures'); }

  async findByEmployee(employeeId: UUID): Promise<SalaryStructure | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.warn(`Supabase findByEmployee warning on ${this.tableName}:`, error.message);
      return null;
    }
    return data ? (toCamelCaseObject(data) as SalaryStructure) : null;
  }
}

