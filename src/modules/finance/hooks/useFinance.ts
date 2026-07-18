import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { FINANCE_SERVICE_TOKEN } from '../finance.service';
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
} from '../finance.repository';
import type { UUID } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';

type CallbackResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function useFinance() {
  const service = useMemo(() => container.resolve(FINANCE_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const budgetRepo = container.resolve(BUDGET_REPOSITORY_TOKEN);
      const expenseRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);
      const travelRepo = container.resolve(TRAVEL_REQUEST_REPOSITORY_TOKEN);
      const vendorRepo = container.resolve(VENDOR_REPOSITORY_TOKEN);
      const poRepo = container.resolve(PURCHASE_ORDER_REPOSITORY_TOKEN);
      const assetRepo = container.resolve(ASSET_REPOSITORY_TOKEN);
      const salaryRepo = container.resolve(SALARY_STRUCTURE_REPOSITORY_TOKEN);

      const [buPage, exPage, trPage, vePage, poPage, asPage, saPage] = await Promise.all([
        budgetRepo.findMany(),
        expenseRepo.findMany(),
        travelRepo.findMany(),
        vendorRepo.findMany(),
        poRepo.findMany(),
        assetRepo.findMany(),
        salaryRepo.findMany(),
      ]);

      setBudgets(buPage.data);
      setExpenseClaims(exPage.data);
      setTravelRequests(trPage.data);
      setVendors(vePage.data);
      setPurchaseOrders(poPage.data);
      setAssets(asPage.data);
      setSalaryStructures(saPage.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const createBudget = useCallback(async (data: Partial<Budget>): Promise<CallbackResult<Budget>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createBudget(data, { id: user.id, role: user.role });
    if (res.ok) {
      setBudgets((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createExpenseClaim = useCallback(async (data: Partial<ExpenseClaim>): Promise<CallbackResult<ExpenseClaim>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createExpenseClaim(data, { id: user.id, role: user.role });
    if (res.ok) {
      setExpenseClaims((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const approveExpenseClaim = useCallback(async (claimId: UUID): Promise<CallbackResult<ExpenseClaim>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.approveExpenseClaim(claimId, { id: user.id, role: user.role });
    if (res.ok) {
      setExpenseClaims((prev) => prev.map((c) => c.id === claimId ? res.value : c));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createTravelRequest = useCallback(async (data: Partial<TravelRequest>): Promise<CallbackResult<TravelRequest>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createTravelRequest(data, { id: user.id, role: user.role });
    if (res.ok) {
      setTravelRequests((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createVendor = useCallback(async (data: Partial<Vendor>): Promise<CallbackResult<Vendor>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createVendor(data, { id: user.id, role: user.role });
    if (res.ok) {
      setVendors((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const createPurchaseOrder = useCallback(async (data: Partial<PurchaseOrder>): Promise<CallbackResult<PurchaseOrder>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createPurchaseOrder(data, { id: user.id, role: user.role });
    if (res.ok) {
      setPurchaseOrders((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const registerAsset = useCallback(async (data: Partial<Asset>): Promise<CallbackResult<Asset>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.registerAsset(data, { id: user.id, role: user.role });
    if (res.ok) {
      setAssets((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const assignAsset = useCallback(async (assetId: UUID, employeeId: UUID): Promise<CallbackResult<Asset>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.assignAsset(assetId, employeeId, { id: user.id, role: user.role });
    if (res.ok) {
      setAssets((prev) => prev.map((a) => a.id === assetId ? res.value : a));
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const updateSalaryStructure = useCallback(async (data: Partial<SalaryStructure>): Promise<CallbackResult<SalaryStructure>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updateSalaryStructure(data, { id: user.id, role: user.role });
    if (res.ok) {
      setSalaryStructures((prev) => {
        const has = prev.some((s) => s.employeeId === data.employeeId);
        return has ? prev.map((s) => s.employeeId === data.employeeId ? res.value : s) : [res.value, ...prev];
      });
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    budgets,
    expenseClaims,
    travelRequests,
    vendors,
    purchaseOrders,
    assets,
    salaryStructures,
    loading,
    error,
    createBudget,
    createExpenseClaim,
    approveExpenseClaim,
    createTravelRequest,
    createVendor,
    createPurchaseOrder,
    registerAsset,
    assignAsset,
    updateSalaryStructure,
    refresh: fetchAll,
  };
}
