import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type FinancialStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed' | 'paid';
export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'disposed';

export interface Budget extends Entity {
  department: string;
  fiscalYear: string;
  allocatedAmount: number;
  spentAmount: number;
}

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

export interface Vendor extends Entity {
  name: string;
  category: string;
  contactPerson: string;
  email: string;
  phone?: string;
  performanceScore?: number;
  contractUrl?: string;
}

export interface PurchaseOrder extends Entity {
  vendorId: UUID;
  poNumber: string;
  amount: number;
  status: FinancialStatus;
  goodsReceived?: boolean;
  invoiceUrl?: string;
}

export interface Asset extends Entity {
  name: string;
  category: string;
  barcodeQr: string;
  assignedEmployeeId?: UUID;
  warrantyExpiry?: string;
  status: AssetStatus;
  originalValue: number;
  depreciationRateAnnual?: number;
}

export interface SalaryStructure extends Entity {
  employeeId: UUID;
  basicSalary: number;
  allowances?: number;
  deductions?: number;
}

export interface IBudgetRepository extends IRepository<Budget> {}
export interface IExpenseClaimRepository extends IRepository<ExpenseClaim> {}
export interface ITravelRequestRepository extends IRepository<TravelRequest> {}
export interface IVendorRepository extends IRepository<Vendor> {}
export interface IPurchaseOrderRepository extends IRepository<PurchaseOrder> {}
export interface IAssetRepository extends IRepository<Asset> {}
export interface ISalaryStructureRepository extends IRepository<SalaryStructure> {
  findByEmployee(employeeId: UUID): Promise<SalaryStructure | null>;
}

export const BUDGET_REPOSITORY_TOKEN = createToken<IBudgetRepository>('BudgetRepository');
export const EXPENSE_CLAIM_REPOSITORY_TOKEN = createToken<IExpenseClaimRepository>('ExpenseClaimRepository');
export const TRAVEL_REQUEST_REPOSITORY_TOKEN = createToken<ITravelRequestRepository>('TravelRequestRepository');
export const VENDOR_REPOSITORY_TOKEN = createToken<IVendorRepository>('VendorRepository');
export const PURCHASE_ORDER_REPOSITORY_TOKEN = createToken<IPurchaseOrderRepository>('PurchaseOrderRepository');
export const ASSET_REPOSITORY_TOKEN = createToken<IAssetRepository>('AssetRepository');
export const SALARY_STRUCTURE_REPOSITORY_TOKEN = createToken<ISalaryStructureRepository>('SalaryStructureRepository');
