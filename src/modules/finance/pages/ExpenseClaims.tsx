/**
 * KVJ Analytics — Expense Claims & Reimbursements (Phase 2 Enterprise Upgrade)
 *
 * Conditional form rules (Spec Section 7):
 *  - Office Expenses: Expense Type + Amount + Receipt Upload + Update Receipt
 *  - Self Travel: hide Amount/Receipt; show Vehicle (Car/Bike), Kilometers, Travel Route (mandatory)
 *  - Training Expenses: Batch (mandatory) + sub-type fields
 *  - Self Travel (Training): Vehicle + KM + Travel Route; Others: Amount + Receipt
 *  - Central KM rates (Bike: ₹5/km, Car: ₹12/km) auto-calculates total reimbursement
 *  - Approval lock: Approved claims show lock icon and become read-only with audit log.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge, EmptyState } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useBreakpoint } from '../../../shared/hooks/responsive';
import { useTraining } from '../../training/hooks/useTraining';
import { supabase } from '../../../shared/integration/supabase';
import { useDialog } from '../../../shared/feedback/DialogProvider';

import { googleIntegration } from '../../../shared/integration/google';
import { ExpenseClaimModal } from '../forms/ExpenseClaimModal';
import { TravelRatesModal, type TravelRate, DEFAULT_TRAVEL_RATES } from '../forms/TravelRatesModal';

export interface ExpenseRecord {
  id: string;
  date: string;
  person: string;
  category: 'Office Expense' | 'Training Expense';
  type: string;
  batch?: string;
  vehicle?: 'Bike' | 'Car';
  km?: number;
  rate?: number;
  route?: string;
  notes?: string;
  amount: number;
  receipt?: string;
  status: 'submitted' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

export function parseExpenseDateToYMD(val?: string | Date | null): string {
  if (!val || val === '—' || val === 'undefined' || val === 'null') return '1970-01-01';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '1970-01-01';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return '1970-01-01';

  // Check if starts with YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Check if DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Fallback to Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '1970-01-01';
}

export function formatDisplayDateGB(val?: string | Date | null): string {
  if (!val || val === '—' || val === 'undefined' || val === 'null') return '—';
  const ymd = parseExpenseDateToYMD(val);
  if (ymd === '1970-01-01' && String(val).trim() !== '1970-01-01') return '—';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return '—';
}

export function ExpenseClaims() {
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { user } = useAuth();
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [travelRates, setTravelRates] = useState<TravelRate[]>(() => {
    try {
      const stored = localStorage.getItem('kvj_travel_rates');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_TRAVEL_RATES;
  });
  const [bikeRate, setBikeRate] = useState<number>(() => {
    const b = travelRates.find((r) => r.id === 'bike' || r.name.toLowerCase().includes('bike'));
    return b ? b.ratePerKm : 5.2;
  });
  const [carRate, setCarRate] = useState<number>(() => {
    const c = travelRates.find((r) => r.id === 'car' || r.name.toLowerCase().includes('car'));
    return c ? c.ratePerKm : 8.5;
  });

  const getVehicleRate = (vehicleName?: string) => {
    if (!vehicleName) return bikeRate;
    const match = travelRates.find((r) => r.name.toLowerCase() === vehicleName.toLowerCase());
    if (match) return match.ratePerKm;
    return vehicleName.toLowerCase().includes('car') ? carRate : bikeRate;
  };

  const [customExpenseTypes, setCustomExpenseTypes] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});

  // Filter and Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Office Expense' | 'Training Expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'person' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Async lock states
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);

  // Load central travel rates from system settings on mount
  useEffect(() => {
    async function loadRates() {
      // 1. Try loading from database
      try {
        const { data, error } = await supabase
          .from('flwdsk_system_settings')
          .select('key, value')
          .in('key', ['travel_rates', 'bike_rate_per_km', 'car_rate_per_km']);
        
        if (!error && data && data.length > 0) {
          const ratesRow = data.find((d: any) => d.key === 'travel_rates');
          const bikeRow = data.find((d: any) => d.key === 'bike_rate_per_km');
          const carRow = data.find((d: any) => d.key === 'car_rate_per_km');

          let loadedRates: TravelRate[] | null = null;
          if (ratesRow && ratesRow.value) {
            const val = typeof ratesRow.value === 'string' ? JSON.parse(ratesRow.value) : ratesRow.value;
            if (Array.isArray(val) && val.length > 0) {
              loadedRates = val;
            }
          }

          if (loadedRates) {
            setTravelRates(loadedRates);
            const b = loadedRates.find((r) => r.id === 'bike' || r.name.toLowerCase().includes('bike'));
            const c = loadedRates.find((r) => r.id === 'car' || r.name.toLowerCase().includes('car'));
            if (b) setBikeRate(Number(b.ratePerKm));
            if (c) setCarRate(Number(c.ratePerKm));
            return;
          }

          if (bikeRow || carRow) {
            const bVal = bikeRow ? Number(bikeRow.value) : 5.2;
            const cVal = carRow ? Number(carRow.value) : 8.5;
            setBikeRate(bVal);
            setCarRate(cVal);
            setTravelRates([
              { id: 'bike', name: 'Bike', ratePerKm: bVal, icon: '🏍️' },
              { id: 'car', name: 'Car', ratePerKm: cVal, icon: '🚗' },
            ]);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not load travel rates from database settings:', e);
      }

      // 2. Fallback to localStorage
      try {
        const storedRates = localStorage.getItem('kvj_travel_rates');
        if (storedRates) {
          const parsed = JSON.parse(storedRates);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTravelRates(parsed);
            const b = parsed.find((r: any) => r.id === 'bike' || r.name.toLowerCase().includes('bike'));
            const c = parsed.find((r: any) => r.id === 'car' || r.name.toLowerCase().includes('car'));
            if (b) setBikeRate(Number(b.ratePerKm));
            if (c) setCarRate(Number(c.ratePerKm));
            return;
          }
        }
        const storedBike = localStorage.getItem('kvj_bike_rate');
        const storedCar = localStorage.getItem('kvj_car_rate');
        if (storedBike) setBikeRate(Number(storedBike));
        if (storedCar) setCarRate(Number(storedCar));
      } catch (e) {
        console.warn('Could not load travel rates from localStorage:', e);
      }
    }
    loadRates();
  }, []);

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const isDesktop = useBreakpoint('md');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>(isManagement ? 'all' : (user?.fullName || 'me'));

  // Load custom expense types from Supabase
  useEffect(() => {
    async function loadCustomTypes() {
      try {
        const { data } = await supabase.from('flwdsk_expense_types').select('name');
        if (data && data.length > 0) {
          setCustomExpenseTypes(data.map((d: any) => d.name));
        }
      } catch (e) {
        console.warn('Could not load expense_types:', e);
      }
    }
    loadCustomTypes();
  }, []);

  const loadClaims = useCallback(async () => {
    if (!user) return;
    setIsLoadingClaims(true);
    try {
      let query = supabase
        .from('flwdsk_expense_claims')
        .select('*')
        .is('deleted_at', null);
      
      if (!isManagement) {
        query = query.eq('employee_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      let mapped: ExpenseRecord[] = [];
      if (!error && data) {
        mapped = data.map((r: any) => {
          let person = 'Employee';
          let type = 'Misc';
          let batch = '';
          let route = '';
          let vehicle = undefined;
          let km = undefined;
          let rate = undefined;
          let userNotes = r.notes || '';
          let expDateVal = '';

          if (r.notes && r.notes.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(r.notes);
              person = parsed.personName || person;
              type = parsed.expenseType || type;
              batch = parsed.batchName || batch;
              route = parsed.route || route;
              vehicle = parsed.vehicle || undefined;
              km = parsed.km || undefined;
              rate = parsed.rate || undefined;
              userNotes = parsed.userNotes || '';
              expDateVal = parsed.expenseDate || '';
            } catch (e) {
              void e;
            }
          }

          let dateFmt = '—';
          const targetDateStr = expDateVal || r.created_at || '';
          if (targetDateStr) {
            dateFmt = formatDisplayDateGB(targetDateStr);
          }

          return {
            id: r.id,
            date: dateFmt,
            person: r.person || person,
            category: r.category || 'Office Expense',
            type,
            batch,
            notes: userNotes,
            route,
            vehicle,
            km,
            rate,
            amount: Number(r.amount || 0),
            receipt: r.receipt_url || '',
            status: (r.status || 'submitted').toLowerCase() as any,
            approvedBy: r.approved_by,
            approvedAt: r.approved_at ? new Date(r.approved_at).toLocaleString() : undefined,
          };
        });
      }

      // Merge with localStorage cached claims
      let localClaims: any[] = [];
      try {
        const stored = localStorage.getItem('kvj_local_expense_claims');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localClaims = parsed;
        }
      } catch {}

      const existingIds = new Set(mapped.map((m) => m.id));
      const additionalLocal: ExpenseRecord[] = localClaims
        .filter((lc) => !existingIds.has(lc.id))
        .map((lc) => ({
          id: lc.id,
          date: formatDisplayDateGB(lc.date || lc.createdAt),
          person: lc.person || 'Employee',
          category: lc.category || 'Office Expense',
          type: lc.type || 'Self Travel',
          batch: lc.batch || '',
          notes: lc.notes || '',
          route: lc.route || '',
          vehicle: lc.vehicle,
          km: lc.km,
          rate: lc.rate,
          amount: Number(lc.amount || 0),
          receipt: lc.receipt || '',
          status: lc.status || 'submitted',
          approvedBy: lc.approvedBy,
          approvedAt: lc.approvedAt,
        }));

      setExpenses([...mapped, ...additionalLocal]);
    } catch (e) {
      console.warn('Could not load expense_claims:', e);
    } finally {
      setIsLoadingClaims(false);
    }
  }, [user, isManagement]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleRegisterNewType = async (typeName: string): Promise<boolean> => {
    const trimmed = typeName.trim();
    if (!trimmed) {
      toast({ variant: 'error', title: 'Invalid Type', message: 'Expense type cannot be empty.' });
      return false;
    }
    const lower = trimmed.toLowerCase();
    const defaultTypes = [
      'Self Travel',
      'Morning Tea',
      'Lunch & Refreshments',
      'Evening Tea',
      'Stationery & Printing',
      'Lab / System Supplies',
      'Miscellaneous',
    ];
    const exists = defaultTypes.some(t => t.toLowerCase() === lower) || customExpenseTypes.some(t => t.toLowerCase() === lower);
    if (exists) {
      toast({ variant: 'warning', title: 'Already Exists', message: `Expense type "${trimmed}" is already available.` });
      return false;
    }

    setCustomExpenseTypes((prev) => Array.from(new Set([...prev, trimmed])));
    toast({ variant: 'success', title: 'Expense Type Registered', message: `Registered "${trimmed}" in database.` });
    try {
      await supabase.from('flwdsk_expense_types').insert({ name: trimmed });
    } catch (e) {
      console.warn('Supabase expense_types insert warning:', e);
    }
    return true;
  };

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        if (isManagement) {
          if (selectedPersonFilter !== 'all') {
            if ((exp.person || '').toLowerCase() !== selectedPersonFilter.toLowerCase()) return false;
          }
        } else {
          if ((exp.person || '').toLowerCase() !== (user?.fullName || '').toLowerCase()) return false;
        }

        if (categoryFilter !== 'all') {
          if (exp.category !== categoryFilter) return false;
        }

        if (statusFilter !== 'all') {
          if (exp.status !== statusFilter) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (exp.person || '').toLowerCase().includes(q);
          const matchType = (exp.type || '').toLowerCase().includes(q);
          const matchBatch = (exp.batch || '').toLowerCase().includes(q);
          const matchRoute = (exp.route || '').toLowerCase().includes(q);
          if (!matchName && !matchType && !matchBatch && !matchRoute) return false;
        }

        if (startDateFilter) {
          const expDateStr = parseExpenseDateToYMD(exp.date);
          if (expDateStr < startDateFilter) return false;
        }
        if (endDateFilter) {
          const expDateStr = parseExpenseDateToYMD(exp.date);
          if (expDateStr > endDateFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (sortBy === 'date') {
          valA = parseExpenseDateToYMD(a.date);
          valB = parseExpenseDateToYMD(b.date);
        }

        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB || '') : (valB || '').localeCompare(valA);
        } else {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
      });
  }, [
    expenses,
    isManagement,
    selectedPersonFilter,
    categoryFilter,
    statusFilter,
    searchQuery,
    startDateFilter,
    endDateFilter,
    sortBy,
    sortOrder,
    user?.fullName
  ]);

  const handleExpenseSubmit = async (values: Record<string, unknown>) => {
    if (submittingClaim) return;
    setSubmittingClaim(true);
    try {
      // 1. Normalize expense date FIRST so it is available for Google Drive folder and DB timestamps
      const rawDate = (values.expenseDate as string) || new Date().toISOString().slice(0, 10);
      const normalizedYMD = parseExpenseDateToYMD(rawDate);
      const dateFmtGB = formatDisplayDateGB(rawDate);
      const safeIsoDate = normalizedYMD ? new Date(`${normalizedYMD}T12:00:00.000Z`).toISOString() : new Date().toISOString();

      const isSelfTravel = values.expenseType === 'Self Travel';
      const km = Number(values.km || 0);
      const vehicle = (values.vehicle || 'Bike') as 'Bike' | 'Car';
      const rate = getVehicleRate(vehicle);
      const amount = isSelfTravel ? km * rate : Number(values.amount || 0);
      const expType = values.expenseType === '__NEW_TYPE__' ? (values.newTypeInput as string) : (values.expenseType as string) || 'Miscellaneous';

      // 2. Receipt file upload using the target Expense Date for Google Drive monthly folder
      let receiptLink: string =
        (typeof values.receiptPreview === 'string' && values.receiptPreview)
          ? values.receiptPreview
          : (typeof values.receipt === 'string' && values.receipt)
          ? values.receipt
          : (values.receiptFile && (values.receiptFile as File).name)
          ? (values.receiptFile as File).name
          : 'Uploaded Proof';

      if (values.receiptFile && values.receiptFile instanceof File) {
        try {
          const fileObj = values.receiptFile as File;
          let base64Content = '';
          try {
            base64Content = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = reader.result as string;
                resolve(res.includes(',') ? res.split(',')[1] : res);
              };
              reader.onerror = () => resolve('');
              reader.readAsDataURL(fileObj);
            });
          } catch (e) { void e; }

          const driveRes = await googleIntegration.uploadReceiptWithMetadata({
            date: normalizedYMD, // Target the chosen expense date's month folder (e.g. 2026-08-12 -> 2026-August)
            personName: user?.fullName || 'Employee',
            isOfficeExpense: values.categoryType === 'Office Expense',
            batchName: (values.batch as string) || undefined,
            expenseType: expType,
            amount,
            originalFileName: fileObj.name,
            mimeType: fileObj.type || 'image/png',
            base64Content,
            uploadedBy: user?.fullName || 'Employee',
          });
          if (driveRes && driveRes.googleDriveViewUrl) {
            receiptLink = driveRes.googleDriveViewUrl;
          }
        } catch (e) {
          console.warn('Google Drive receipt upload warning:', e);
        }
      }

      // 3. Serialize notes JSON with chosen expense date
      const notesJson = JSON.stringify({
        personName: user?.fullName || 'Employee',
        expenseType: expType,
        expenseDate: normalizedYMD,
        batchName: values.batch as string || null,
        route: values.route as string || null,
        vehicle: isSelfTravel ? vehicle : null,
        km: isSelfTravel ? km : null,
        rate: isSelfTravel ? rate : null,
        userNotes: (values.notes as string) || (values.route as string) || '',
      });

      // 4. Resolve valid employee UUID from database
      let validEmployeeId: string | null = null;
      const isUuid = (str?: string | null) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (isUuid(user?.id)) {
        try {
          const { data: emp } = await supabase.from('flwdsk_employees').select('id').eq('id', user!.id).maybeSingle();
          if (emp?.id) validEmployeeId = emp.id;
        } catch {}
      }

      if (!validEmployeeId && user?.email) {
        try {
          const { data: empByEmail } = await supabase.from('flwdsk_employees').select('id').ilike('email', user.email.trim()).maybeSingle();
          if (empByEmail?.id) validEmployeeId = empByEmail.id;
        } catch {}
      }

      if (!validEmployeeId) {
        try {
          const { data: firstEmp } = await supabase.from('flwdsk_employees').select('id').is('deleted_at', null).limit(1).maybeSingle();
          if (firstEmp?.id) validEmployeeId = firstEmp.id;
        } catch {}
      }

      if (!validEmployeeId && isUuid(user?.id)) {
        validEmployeeId = user!.id;
      }

      // 5. Save to Supabase DB with safe fallback
      const claimId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : undefined;

      const insertPayload: Record<string, any> = {
        amount,
        category: values.categoryType || 'Office Expense',
        receipt_url: receiptLink,
        status: 'submitted',
        created_at: safeIsoDate,
        notes: notesJson,
      };

      if (claimId) {
        insertPayload.id = claimId;
      }
      if (validEmployeeId) {
        insertPayload.employee_id = validEmployeeId;
      }

      try {
        const { error } = await supabase.from('flwdsk_expense_claims').insert(insertPayload);
        if (error) {
          console.warn('Supabase primary expense claims insert error, retrying without id:', error);
          const fallbackPayload = { ...insertPayload };
          delete fallbackPayload.id;
          await supabase.from('flwdsk_expense_claims').insert(fallbackPayload);
        }
      } catch (e: any) {
        console.warn('Supabase expense submit catch warning:', e);
      }

      // Always save to local storage cache so the record is not lost
      const newRecord: ExpenseRecord = {
        id: claimId || `local_exp_${Date.now()}`,
        date: dateFmtGB,
        person: user?.fullName || 'Employee',
        category: (values.categoryType as any) || 'Office Expense',
        type: expType,
        batch: values.batch as string,
        vehicle: isSelfTravel ? vehicle : undefined,
        km: isSelfTravel ? km : undefined,
        rate: isSelfTravel ? rate : undefined,
        route: values.route as string,
        notes: (values.notes as string) || (values.route as string) || expType,
        amount,
        receipt: receiptLink,
        status: 'submitted',
      };

      try {
        const existingStr = localStorage.getItem('kvj_local_expense_claims');
        const existingArr = existingStr ? JSON.parse(existingStr) : [];
        const filtered = Array.isArray(existingArr) ? existingArr.filter((x: any) => x.id !== newRecord.id) : [];
        localStorage.setItem('kvj_local_expense_claims', JSON.stringify([newRecord, ...filtered]));
      } catch {}

      setExpenses((prev) => [newRecord, ...(Array.isArray(prev) ? prev.filter((x) => x.id !== newRecord.id) : [])]);
      loadClaims();

      const parts = normalizedYMD.split('-');
      const mIndex = parseInt(parts[1] || '1', 10) - 1;
      const mName = ['January','February','March','April','May','June','July','August','September','October','November','December'][mIndex] || 'August';
      const monthFolder = `${parts[0]}-${mName}`;

      toast({
        variant: 'success',
        title: 'Claim Filed & Saved',
        message: values.receiptFile
          ? `Submitted ₹${amount.toFixed(2)} claim. Receipt saved in Google Drive: Office/Flow Desk/Receipt/${monthFolder}.`
          : `Submitted ₹${amount.toFixed(2)} expense claim for review.`,
      });
      setExpenseOpen(false);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleUpdateRate = async (exp: ExpenseRecord, newRate: number) => {
    if (processingAction) return;
    if (isNaN(newRate) || newRate < 0) {
      toast({ variant: 'error', title: 'Invalid Rate', message: 'Rate must be a non-negative number.' });
      return;
    }
    setProcessingAction(true);
    const km = exp.km || 0;
    const newAmount = km * newRate;

    // reconstruct notes JSON
    const notesJson = JSON.stringify({
      personName: exp.person,
      expenseType: exp.type,
      batchName: exp.batch || null,
      route: exp.route || null,
      vehicle: exp.vehicle || null,
      km: exp.km || null,
      rate: newRate,
      userNotes: exp.notes || '',
    });

    try {
      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .update({
          amount: newAmount,
          notes: notesJson,
        })
        .eq('id', exp.id);

      if (error) {
        toast({ variant: 'error', title: 'Update Failed', message: error.message });
      } else {
        toast({
          variant: 'success',
          title: 'Rate Updated',
          message: `Rate updated to ₹${newRate}/km (Amount recalculated to ₹${newAmount.toFixed(2)})`
        });
        loadClaims();
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Update Failed', message: e.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (processingAction) return;
    setProcessingAction(true);
    try {
      const isUuid = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      const updates: Record<string, any> = {
        status: 'approved',
        approved_at: new Date().toISOString(),
      };
      if (isUuid) {
        updates.approved_by = user.id;
      }
      let { error } = await supabase
        .from('flwdsk_expense_claims')
        .update(updates)
        .eq('id', id);

      if (error && updates.approved_by) {
        delete updates.approved_by;
        const res2 = await supabase.from('flwdsk_expense_claims').update(updates).eq('id', id);
        error = res2.error;
      }

      // Update local storage cache
      try {
        const stored = localStorage.getItem('kvj_local_expense_claims');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((x: any) => x.id === id ? { ...x, status: 'approved' } : x);
            localStorage.setItem('kvj_local_expense_claims', JSON.stringify(updated));
          }
        }
      } catch {}

      toast({ variant: 'success', title: 'Claim Approved', message: 'Expense claim authorized and locked.' });
      loadClaims();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Approval Failed', message: e.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (id: string) => {
    if (processingAction) return;
    setProcessingAction(true);
    try {
      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .update({
          status: 'rejected',
        })
        .eq('id', id);

      // Update local storage cache
      try {
        const stored = localStorage.getItem('kvj_local_expense_claims');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((x: any) => x.id === id ? { ...x, status: 'rejected' } : x);
            localStorage.setItem('kvj_local_expense_claims', JSON.stringify(updated));
          }
        }
      } catch {}

      toast({ variant: 'warning', title: 'Claim Rejected', message: 'Expense claim status updated to rejected.' });
      loadClaims();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Rejection Failed', message: e.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDeleteClaim = async (id: string) => {
    if (processingAction) return;
    setProcessingAction(true);
    try {
      const isUuid = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      const updates: Record<string, any> = {
        deleted_at: new Date().toISOString(),
      };
      if (isUuid) {
        updates.deleted_by = user.id;
      }
      let { error } = await supabase
        .from('flwdsk_expense_claims')
        .update(updates)
        .eq('id', id);

      if (error && updates.deleted_by) {
        delete updates.deleted_by;
        const res2 = await supabase.from('flwdsk_expense_claims').update(updates).eq('id', id);
        error = res2.error;
      }

      // Update local storage cache
      try {
        const stored = localStorage.getItem('kvj_local_expense_claims');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((x: any) => x.id !== id);
            localStorage.setItem('kvj_local_expense_claims', JSON.stringify(updated));
          }
        }
      } catch {}

      toast({ variant: 'warning', title: 'Claim Deleted', message: 'Expense claim has been deleted.' });
      loadClaims();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Deletion Failed', message: e.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSelectExpense = (id: string, checked: boolean) => {
    setSelectedExpenses((prev) => ({ ...prev, [id]: checked }));
  };

  const handleSelectAllExpenses = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      filteredExpenses.forEach((exp) => {
        next[exp.id] = true;
      });
    }
    setSelectedExpenses(next);
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
    const selectedIds = Object.keys(selectedExpenses).filter((id) => selectedExpenses[id]);
    if (selectedIds.length === 0 || processingAction) return;

    const actionText = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'delete';
    const confirmOk = await confirm({
      title: `Bulk ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}?`,
      message: `Are you sure you want to ${actionText} the ${selectedIds.length} selected expense claim(s)?`,
    });
    if (!confirmOk) return;

    setProcessingAction(true);
    try {
      const isUuid = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      if (action === 'delete') {
        const updates: Record<string, any> = {
          deleted_at: new Date().toISOString(),
        };
        if (isUuid) {
          updates.deleted_by = user.id;
        }
        let { error } = await supabase
          .from('flwdsk_expense_claims')
          .update(updates)
          .in('id', selectedIds);
        if (error && updates.deleted_by) {
          delete updates.deleted_by;
          const res2 = await supabase.from('flwdsk_expense_claims').update(updates).in('id', selectedIds);
          error = res2.error;
        }
        if (error) throw error;

        // Local storage cleanup
        try {
          const stored = localStorage.getItem('kvj_local_expense_claims');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const updated = parsed.filter((x: any) => !selectedIds.includes(x.id));
              localStorage.setItem('kvj_local_expense_claims', JSON.stringify(updated));
            }
          }
        } catch {}

        toast({ variant: 'warning', title: 'Claims Deleted', message: `${selectedIds.length} claim(s) successfully deleted.` });
      } else {
        const updates: Record<string, any> = {
          status: action === 'approve' ? 'approved' : 'rejected'
        };
        if (action === 'approve') {
          if (isUuid) {
            updates.approved_by = user.id;
          }
          updates.approved_at = new Date().toISOString();
        }
        let { error } = await supabase
          .from('flwdsk_expense_claims')
          .update(updates)
          .in('id', selectedIds);
        if (error && updates.approved_by) {
          delete updates.approved_by;
          const res2 = await supabase.from('flwdsk_expense_claims').update(updates).in('id', selectedIds);
          error = res2.error;
        }
        if (error) throw error;

        // Local storage update
        try {
          const stored = localStorage.getItem('kvj_local_expense_claims');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const updated = parsed.map((x: any) => selectedIds.includes(x.id) ? { ...x, status: action === 'approve' ? 'approved' : 'rejected' } : x);
              localStorage.setItem('kvj_local_expense_claims', JSON.stringify(updated));
            }
          }
        } catch {}

        toast({ variant: 'success', title: `Claims ${action === 'approve' ? 'Approved' : 'Rejected'}`, message: `${selectedIds.length} claim(s) successfully updated.` });
      }
      setSelectedExpenses({});
      loadClaims();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Bulk Action Failed', message: e.message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleExportExcel = useCallback(() => {
    const rows = filteredExpenses.map((exp) => ({
      Date: exp.date,
      Employee: exp.person,
      Classification: exp.category,
      'Expense Type': exp.type,
      'Batch / Route': exp.batch || exp.route || '—',
      'Vehicle': exp.vehicle || '—',
      'KM': exp.km ?? '—',
      'Rate (₹/km)': exp.rate ?? '—',
      'Amount (₹)': exp.amount.toFixed(2),
      'Receipt': exp.receipt && (exp.receipt.startsWith('http') || exp.receipt.startsWith('data:')) ? exp.receipt : (exp.receipt || 'N/A'),
      Status: exp.status,
      'Approved By': exp.approvedBy || '—',
      'Approved At': exp.approvedAt || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expense Claims');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `KVJ_Expense_Claims_${today}.xlsx`);

    toast({ variant: 'success', title: 'Exported', message: `Downloaded ${rows.length} expense record(s) as Excel.` });
  }, [filteredExpenses, toast]);

  const selectedCount = Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length;

  return (
    <AppShell>
      <div style={{ flexShrink: 0 }}>
        <PageHeader
        title="Expense Claims & Reimbursements"
        subtitle="Conditional expense filing, auto-calculated travel KM rates, and locked approval audit trails"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setRateModalOpen(true)} style={{ whiteSpace: 'nowrap' }}>⚙️ Travel Rates (KM)</Button>
            )}
            {isManagement && selectedCount > 0 && (
              <>
                <Button
                  style={{ background: 'var(--status-success)', color: 'white', whiteSpace: 'nowrap' }}
                  onClick={() => handleBulkAction('approve')}
                >
                  ✓ Bulk Approve ({selectedCount})
                </Button>
                <Button
                  style={{ background: 'var(--status-danger)', color: 'white', whiteSpace: 'nowrap' }}
                  onClick={() => handleBulkAction('reject')}
                >
                  ✕ Bulk Reject ({selectedCount})
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleBulkAction('delete')}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  🗑️ Delete ({selectedCount})
                </Button>
              </>
            )}
            <Button onClick={() => setExpenseOpen(true)} style={{ whiteSpace: 'nowrap' }}>+ Submit Expense Claim</Button>
          </div>
        }
      />

      {/* Central Rate Info Banner */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>📍 Central Reimbursement Rates:</span>
          {travelRates.map((r) => (
            <Badge key={r.id || r.name} tone={r.name.toLowerCase().includes('bike') ? 'info' : r.name.toLowerCase().includes('car') ? 'purple' : 'neutral'}>
              {r.icon || '🚗'} {r.name}: ₹{r.ratePerKm} / KM
            </Badge>
          ))}
        </div>
      </Card>

      {/* Filters Row */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Search Description, Type, Batch or Route</label>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="kvj-input"
                style={{ padding: '6px 12px', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Classification</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="kvj-select"
                style={{ padding: '6px 12px', fontSize: 13, minWidth: 150 }}
              >
                <option value="all">All Categories</option>
                <option value="Office Expense">Office Expense</option>
                <option value="Training Expense">Training Expense</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="kvj-select"
                style={{ padding: '6px 12px', fontSize: 13, minWidth: 140 }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="kvj-select"
                style={{ padding: '6px 12px', fontSize: 13, minWidth: 130 }}
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="person">Employee</option>
                <option value="category">Classification</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="kvj-select"
                style={{ padding: '6px 12px', fontSize: 13, minWidth: 100 }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>Start Date</label>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="kvj-input"
                style={{ padding: '6px 12px', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>End Date</label>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="kvj-input"
                style={{ padding: '6px 12px', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignSelf: 'flex-end', height: '36px', alignItems: 'center' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setSortBy('date');
                  setSortOrder('desc');
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Expense Claims Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              📋 Expense Claims ({filteredExpenses.length})
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExportExcel}
              disabled={filteredExpenses.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
            >
              📥 Export to Excel
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Filter Employee:</span>
            {isManagement ? (
              <select
                className="kvj-select"
                value={selectedPersonFilter}
                onChange={(e) => setSelectedPersonFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 180 }}
              >
                <option value="all">👥 All Employees (Expenses)</option>
                {user?.fullName && <option value={user.fullName}>👤 My Claims ({user.fullName})</option>}
                {Array.from(new Set(expenses.map((e) => e.person))).map((person) => {
                  if (person === user?.fullName) return null;
                  return <option key={person} value={person}>{person}</option>;
                })}
              </select>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-sunken)', border: '1px solid var(--border)', color: 'var(--brand)' }}>
                👤 {user?.fullName || 'My Claims Only'}
              </span>
            )}
          </div>
        </div>

        {isLoadingClaims ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14, gap: 10 }}>
            <span style={{ fontSize: 20 }}>⏳</span> Loading expense claims...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            title="No expense claims found"
            message="No records match your selected search query or filter criteria."
          />
        ) : !isDesktop ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredExpenses.map((exp) => {
              const isLocked = exp.status === 'approved';
              const r = exp.receipt || '';
              const isRealUrl = r.startsWith('http://') || r.startsWith('https://') || r.startsWith('data:');

              return (
                <div key={exp.id} className="kvj-mobile-card">
                  {/* Top Bar: Date, Employee, Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isManagement && (
                        <input
                          type="checkbox"
                          checked={!!selectedExpenses[exp.id]}
                          onChange={(e) => handleSelectExpense(exp.id, e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{exp.person || 'Employee'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.date || '—'} · {exp.category || 'Office Expense'}</div>
                      </div>
                    </div>
                    <Badge tone={exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}>
                      {isLocked ? '🔒 Approved' : (exp.status || 'submitted')}
                    </Badge>
                  </div>

                  {/* Expense Type & Travel Details */}
                  <div style={{ background: 'var(--bg-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{exp.type || 'Expense'}</div>
                    {exp.vehicle && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span>🚗 {exp.vehicle} · {exp.km || 0} km @ ₹{exp.rate || getVehicleRate(exp.vehicle)}/km</span>
                      </div>
                    )}
                    {(exp.batch || exp.route) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {exp.batch && <span>Batch: <strong>{exp.batch}</strong> </span>}
                        {exp.route && <span>(Route: {exp.route})</span>}
                      </div>
                    )}
                  </div>

                  {/* Amount and Receipt Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Claim Amount</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{(Number(exp.amount) || 0).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {isRealUrl ? (
                        <a
                          href={r}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-sunken)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                        >
                          📎 View Receipt
                        </a>
                      ) : r && r !== 'Uploaded Proof' ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📎 {r}</span>
                      ) : exp.vehicle ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto KM Calc</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--status-danger)', fontWeight: 600 }}>No Receipt</span>
                      )}
                    </div>
                  </div>

                  {/* Manager audit info if approved */}
                  {exp.approvedBy && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Approved by {exp.approvedBy}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                    {!isLocked && exp.status === 'submitted' && isManagement && (
                      <>
                        <Button size="sm" variant="success" onClick={() => handleApprove(exp.id)} loading={processingAction}>
                          ✓ Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(exp.id)} loading={processingAction}>
                          ✕ Reject
                        </Button>
                      </>
                    )}
                    {!isLocked && (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={processingAction}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete Expense Claim?',
                            message: `Are you sure you want to delete this expense claim for ₹${(Number(exp.amount) || 0).toFixed(2)}? This cannot be undone.`,
                          });
                          if (ok) {
                            await handleDeleteClaim(exp.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                    {isLocked && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Audit Locked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Horizontal scroll only — the page (AppShell main) scrolls vertically,
          // so the table shows its full height and the last row's actions are
          // always reachable. A nested vertical scroll previously clipped it.
          <div style={{ overflowX: 'auto', minHeight: 200, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <table className="kvj-table" style={{ marginBottom: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-surface)' }}>
                <tr>
                  {isManagement && (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAllExpenses(e.target.checked)}
                        checked={
                          filteredExpenses.length > 0 &&
                          filteredExpenses.every((exp) => selectedExpenses[exp.id])
                        }
                      />
                    </th>
                  )}
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Classification</th>
                  <th>Expense Type</th>
                  <th>Batch / Route</th>
                  <th>Amount (₹)</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => {
                  const isLocked = exp.status === 'approved';
                  return (
                    <tr key={exp.id}>
                      {isManagement && (
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedExpenses[exp.id]}
                            onChange={(e) => handleSelectExpense(exp.id, e.target.checked)}
                          />
                        </td>
                      )}
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{exp.date || '—'}</td>
                      <td>{exp.person || 'Employee'}</td>
                      <td>
                        <Badge tone={(exp.category || '').includes('Training') ? 'info' : 'neutral'}>
                          {exp.category || 'Office Expense'}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{exp.type || 'Expense'}</div>
                        {exp.vehicle && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span>{exp.vehicle} · {exp.km || 0} km @ ₹</span>
                            {exp.status === 'submitted' && isManagement ? (
                              <input
                                type="number"
                                value={editingRates[exp.id] !== undefined ? editingRates[exp.id] : (exp.rate || getVehicleRate(exp.vehicle))}
                                onChange={(e) => setEditingRates(prev => ({ ...prev, [exp.id]: e.target.value }))}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    handleUpdateRate(exp, val);
                                  }
                                  setEditingRates(prev => {
                                    const next = { ...prev };
                                    delete next[exp.id];
                                    return next;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = Number((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val >= 0) {
                                      handleUpdateRate(exp, val);
                                    }
                                    setEditingRates(prev => {
                                      const next = { ...prev };
                                      delete next[exp.id];
                                      return next;
                                    });
                                  }
                                }}
                                style={{
                                  width: '55px',
                                  padding: '1px 3px',
                                  fontSize: '12px',
                                  border: '1px solid var(--border)',
                                  borderRadius: '4px',
                                  textAlign: 'center',
                                  background: 'var(--bg-sunken)',
                                  color: 'var(--text-primary)',
                                  fontWeight: 'bold'
                                }}
                              />
                            ) : (
                              <span>{exp.rate || getVehicleRate(exp.vehicle)}</span>
                            )}
                            <span>/km</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--brand)' }}>{exp.batch || '—'}</div>
                        {exp.route && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🗺 {exp.route}</div>}
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹ {(Number(exp.amount) || 0).toFixed(2)}
                      </td>
                      <td>
                        {(() => {
                          const r = exp.receipt || '';
                          const isRealUrl = r.startsWith('http://') || r.startsWith('https://') || r.startsWith('data:');
                          if (isRealUrl) {
                            return (
                              <a
                                href={r}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                📎 View Receipt
                              </a>
                            );
                          } else if (r && r !== 'Uploaded Proof') {
                            return (
                              <span title={`File: ${r}`} style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'default' }}>
                                📎 {r}
                              </span>
                            );
                          } else if (exp.vehicle) {
                            return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>KM Auto-Calc</span>;
                          } else {
                            return <span style={{ fontSize: 12, color: 'var(--status-danger)', fontWeight: 600 }}>No Receipt</span>;
                          }
                        })()}
                      </td>
                      <td>
                        <Badge tone={exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}>
                          {isLocked ? '🔒 Approved' : (exp.status || 'submitted')}
                        </Badge>
                        {exp.approvedBy && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            by {exp.approvedBy}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!isLocked && exp.status === 'submitted' && isManagement && (
                            <>
                              <Button size="xs" variant="success" onClick={() => handleApprove(exp.id)} loading={processingAction}>Approve</Button>
                              <Button size="xs" variant="danger" onClick={() => handleReject(exp.id)} loading={processingAction}>Reject</Button>
                            </>
                          )}
                          {!isLocked && (
                            <Button
                              size="xs"
                              variant="danger"
                              loading={processingAction}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete Expense Claim?',
                                  message: `Are you sure you want to delete this expense claim for ₹${(Number(exp.amount) || 0).toFixed(2)}? This cannot be undone.`,
                                });
                                if (ok) {
                                  await handleDeleteClaim(exp.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                          {isLocked && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              🔒 Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </div>

      {/* Submit Expense Modal */}
      <ExpenseClaimModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSuccess={() => loadClaims()}
        travelRates={travelRates}
        bikeRate={bikeRate}
        carRate={carRate}
        batches={batches}
        customExpenseTypes={customExpenseTypes}
        onRegisterNewType={handleRegisterNewType}
      />

      {/* Travel Rates Modal */}
      <TravelRatesModal
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        travelRates={travelRates}
        bikeRate={bikeRate}
        carRate={carRate}
        onRatesUpdated={(newRates, b, c) => {
          setTravelRates(newRates);
          if (b !== undefined) setBikeRate(b);
          if (c !== undefined) setCarRate(c);
        }}
      />
    </AppShell>
  );
}

export default ExpenseClaims;
