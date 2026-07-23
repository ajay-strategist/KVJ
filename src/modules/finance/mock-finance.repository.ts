import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type {
  Budget, IBudgetRepository,
  ExpenseClaim, IExpenseClaimRepository,
  TravelRequest, ITravelRequestRepository,
  Vendor, IVendorRepository,
  PurchaseOrder, IPurchaseOrderRepository,
  Asset, IAssetRepository,
  SalaryStructure, ISalaryStructureRepository
} from './finance.repository';

export class MockBudgetRepository extends MemoryRepository<Budget> implements IBudgetRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockBudgetRepository'); }
}

export class MockExpenseClaimRepository extends MemoryRepository<ExpenseClaim> implements IExpenseClaimRepository {
  constructor() { super({ defaultStatus: 'submitted', pageSize: 20 }, [], 'MockExpenseClaimRepository'); }
}

export class MockTravelRequestRepository extends MemoryRepository<TravelRequest> implements ITravelRequestRepository {
  constructor() { super({ defaultStatus: 'submitted', pageSize: 20 }, [], 'MockTravelRequestRepository'); }
}

export class MockVendorRepository extends MemoryRepository<Vendor> implements IVendorRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, [], 'MockVendorRepository'); }
}

export class MockPurchaseOrderRepository extends MemoryRepository<PurchaseOrder> implements IPurchaseOrderRepository {
  constructor() { super({ defaultStatus: 'submitted', pageSize: 20 }, [], 'MockPurchaseOrderRepository'); }
}

export class MockAssetRepository extends MemoryRepository<Asset> implements IAssetRepository {
  constructor() { super({ defaultStatus: 'available', pageSize: 20 }, [], 'MockAssetRepository'); }
}

export class MockSalaryStructureRepository extends MemoryRepository<SalaryStructure> implements ISalaryStructureRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 50 }, [], 'MockSalaryStructureRepository'); }

  async findByEmployee(employeeId: UUID): Promise<SalaryStructure | null> {
    return [...this.store.values()].find((s) => s.employeeId === employeeId && !s.deletedAt) ?? null;
  }
}
