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
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, FileUploadField, useForm } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useTraining } from '../../training/hooks/useTraining';
import { supabase } from '../../../shared/integration/supabase';
import { useDialog } from '../../../shared/feedback/DialogProvider';

import { googleIntegration } from '../../../shared/integration/google';

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

function DynamicExpenseForm({
  bikeRate,
  carRate,
  batches,
  customExpenseTypes,
  onRegisterNewType,
  onSubmit,
  onCancel,
  submittingClaim,
}: {
  bikeRate: number;
  carRate: number;
  batches: Array<any>;
  customExpenseTypes: string[];
  onRegisterNewType: (name: string) => Promise<boolean>;
  onSubmit: (vals: any) => void;
  onCancel: () => void;
  submittingClaim: boolean;
}) {
  const { values, setValue } = useForm();
  const [newTypeInput, setNewTypeInput] = useState('');

  const category = values.categoryType || 'Office Expense';
  const isSelfTravel = values.expenseType === 'Self Travel';
  const isTraining = category === 'Training Expense';

  const kmVal = Number(values.km || 0);
  const vehicle = values.vehicle || 'Bike';
  const rate = vehicle === 'Car' ? carRate : bikeRate;
  const calculatedAmount = isSelfTravel ? kmVal * rate : Number(values.amount || 0);

  const batchOptions = useMemo(() => {
    if (batches && batches.length > 0) {
      return batches.map((b: any) => {
        const name = b.name || 'Batch';
        const code = b.batchCode || b.code || 'Batch';
        return {
          value: `${name} (${code})`,
          label: `${name} (${code})`,
        };
      });
    }
    return [
      { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
      { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
      { value: 'Vimala College Batch 2', label: 'Vimala College Batch 2' },
    ];
  }, [batches]);

  const expenseTypeOptions = useMemo(() => {
    const defaultTypes = [
      'Self Travel',
      'Morning Tea',
      'Lunch & Refreshments',
      'Evening Tea',
      'Stationery & Printing',
      'Lab / System Supplies',
      'Miscellaneous',
    ];
    const combined = Array.from(new Set([...defaultTypes, ...customExpenseTypes]));
    const opts = combined.map((t) => ({
      value: t,
      label: t === 'Self Travel' ? 'Self Travel (Bike / Car KM Reimbursement)' : t,
    }));
    opts.push({ value: '__NEW_TYPE__', label: '➕ Register New Expense Type...' });
    return opts;
  }, [customExpenseTypes]);

  const handleSaveNewType = async () => {
    const val = newTypeInput.trim();
    if (!val) return;
    const ok = await onRegisterNewType(val);
    if (ok) {
      setValue('expenseType', val);
      setNewTypeInput('');
    }
  };

  const validationRules = {
    expenseType: [
      (v: any) =>
        !v || v === '' || v === '__NEW_TYPE__'
          ? 'Please select or register a valid expense type.'
          : null,
    ],
    batch: [
      (v: any, all: any) =>
        all.categoryType === 'Training Expense' && (!v || v === '')
          ? 'Training Batch is mandatory for Training Expenses.'
          : null,
    ],
    km: [
      (v: any, all: any) =>
        all.expenseType === 'Self Travel' && (v === undefined || v === null || v === '' || isNaN(Number(v)) || Number(v) <= 0)
          ? 'Kilometers travelled must be a positive number.'
          : null,
    ],
    route: [
      (v: any, all: any) =>
        all.expenseType === 'Self Travel' && (!v || v.trim() === '')
          ? 'Travel Route is mandatory for Self Travel.'
          : null,
    ],
    amount: [
      (v: any, all: any) =>
        all.expenseType !== 'Self Travel' && (v === undefined || v === null || v === '' || isNaN(Number(v)) || Number(v) <= 0)
          ? 'Expense Amount must be a positive number.'
          : null,
    ],
    receiptFile: [
      (v: any, all: any) =>
        all.expenseType !== 'Self Travel' && !v
          ? 'Receipt file upload is required.'
          : null,
      (v: any, all: any) => {
        if (all.expenseType === 'Self Travel' || !v) return null;
        const fileObj = v as File;
        if (fileObj.size > 10 * 1024 * 1024) {
          return 'File size exceeds the 10MB limit.';
        }
        const ext = fileObj.name.split('.').pop()?.toLowerCase();
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        if (!ext || !allowedExts.includes(ext)) {
          return 'Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.';
        }
        return null;
      }
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SelectField
        name="categoryType"
        label="Expense Classification *"
        options={[
          { value: 'Office Expense', label: 'Office Expense' },
          { value: 'Training Expense', label: 'Training Expense' },
        ]}
      />

      {isTraining && (
        <SelectField
          name="batch"
          label="Training Batch (Mandatory for Training Expenses) *"
          options={batchOptions}
          rules={validationRules.batch}
        />
      )}

      <SelectField
        name="expenseType"
        label="Expense Type *"
        options={expenseTypeOptions}
        rules={validationRules.expenseType}
      />

      {values.expenseType === '__NEW_TYPE__' && (
        <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>New Expense Type Name *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. Software License, Hotel Booking..."
              value={newTypeInput}
              onChange={(e) => setNewTypeInput(e.target.value)}
              style={{ flex: 1, padding: '6px 12px', fontSize: 13, borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}
            />
            <Button size="sm" type="button" onClick={handleSaveNewType}>Register in DB</Button>
          </div>
        </div>
      )}

      {isSelfTravel ? (
        <>
          <SelectField
            name="vehicle"
            label="Vehicle Type *"
            options={[
              { value: 'Bike', label: 'Bike' },
              { value: 'Car', label: 'Car' },
            ]}
          />
          <TextField name="km" label="Kilometers (KM) Travelled *" placeholder="e.g. 16" rules={validationRules.km} />
          <TextField name="route" label="Travel Route (Mandatory: e.g., HQ to Christ College) *" placeholder="e.g. Kakkanad HQ to Irinjalakuda" rules={validationRules.route} />

          {kmVal > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Auto Calculated Reimbursement</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success)', marginTop: 2 }}>
                ₹ {calculatedAmount.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>({kmVal} km × ₹{rate}/km)</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <TextField name="amount" label="Expense Amount (₹) *" placeholder="e.g. 150.00" rules={validationRules.amount} />
          <FileUploadField name="receiptFile" label="Upload Receipt Image / PDF (Stored & Linked to Google Sheet) *" rules={validationRules.receiptFile} accept="image/*,.pdf" />
        </>
      )}

      <TextField name="notes" label="Notes / Description (Optional)" placeholder="Additional details..." />

      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={submittingClaim}>Cancel</Button>
        <Button type="submit" loading={submittingClaim}>Submit Expense Claim</Button>
      </div>
    </div>
  );
}

export function ExpenseClaims() {
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { user } = useAuth();
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [bikeRate, setBikeRate] = useState(5.0);
  const [carRate, setCarRate] = useState(12.0);

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

  // Load central travel rates from system settings on mount
  useEffect(() => {
    async function loadRates() {
      // 1. Try loading from database
      try {
        const { data, error } = await supabase
          .from('flwdsk_system_settings')
          .select('key, value')
          .in('key', ['bike_rate_per_km', 'car_rate_per_km']);
        
        if (!error && data && data.length > 0) {
          const bikeRow = data.find((d: any) => d.key === 'bike_rate_per_km');
          const carRow = data.find((d: any) => d.key === 'car_rate_per_km');
          if (bikeRow) setBikeRate(Number(bikeRow.value));
          if (carRow) setCarRate(Number(carRow.value));
          return; // successfully loaded from DB
        }
      } catch (e) {
        console.warn('Could not load travel rates from database settings:', e);
      }

      // 2. Fallback to localStorage
      try {
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
    try {
      let query = supabase
        .from('flwdsk_expense_claims')
        .select('*')
        .is('deleted_at', null);
      
      if (!isManagement) {
        query = query.eq('employee_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        const mapped: ExpenseRecord[] = data.map((r: any) => {
          let person = 'Employee';
          let type = 'Misc';
          let batch = '';
          let route = '';
          let vehicle = undefined;
          let km = undefined;
          let rate = undefined;
          let userNotes = r.notes || '';

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
            } catch (e) {
              // fallback if parsing fails
            }
          }

          return {
            id: r.id,
            date: new Date(r.created_at).toLocaleDateString('en-GB'),
            person,
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
        setExpenses(mapped);
      }
    } catch (e) {
      console.warn('Could not load expense_claims:', e);
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
            if (exp.person.toLowerCase() !== selectedPersonFilter.toLowerCase()) return false;
          }
        } else {
          if (exp.person.toLowerCase() !== (user?.fullName || '').toLowerCase()) return false;
        }

        if (categoryFilter !== 'all') {
          if (exp.category !== categoryFilter) return false;
        }

        if (statusFilter !== 'all') {
          if (exp.status !== statusFilter) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = exp.person.toLowerCase().includes(q);
          const matchType = exp.type.toLowerCase().includes(q);
          const matchBatch = (exp.batch || '').toLowerCase().includes(q);
          const matchRoute = (exp.route || '').toLowerCase().includes(q);
          if (!matchName && !matchType && !matchBatch && !matchRoute) return false;
        }

        if (startDateFilter) {
          const [d, m, y] = exp.date.split('/');
          const expDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (expDateStr < startDateFilter) return false;
        }
        if (endDateFilter) {
          const [d, m, y] = exp.date.split('/');
          const expDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (expDateStr > endDateFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (sortBy === 'date') {
          const [dA, mA, yA] = a.date.split('/');
          const [dB, mB, yB] = b.date.split('/');
          valA = `${yA}-${mA.padStart(2, '0')}-${dA.padStart(2, '0')}`;
          valB = `${yB}-${mB.padStart(2, '0')}-${dB.padStart(2, '0')}`;
        }

        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
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
      const isSelfTravel = values.expenseType === 'Self Travel';
      const km = Number(values.km || 0);
      const vehicle = (values.vehicle || 'Bike') as 'Bike' | 'Car';
      const rate = vehicle === 'Car' ? carRate : bikeRate;
      const amount = isSelfTravel ? km * rate : Number(values.amount || 0);

      const isUUID = (str?: string) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const validEmpId = isUUID(user?.id) ? user?.id : null;

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
          } catch (e) {}

          const driveRes = await googleIntegration.uploadReceiptWithMetadata({
            date: new Date().toISOString().split('T')[0],
            personName: user?.fullName || 'Employee',
            isOfficeExpense: values.categoryType === 'Office Expense',
            batchName: (values.batch as string) || undefined,
            expenseType: (values.expenseType as string) || 'Expense',
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

      const expType = values.expenseType === '__NEW_TYPE__' ? (values.newTypeInput as string) : (values.expenseType as string) || 'Miscellaneous';
      
      const assocBatch = batches.find((b: any) =>
        b.id === values.batch ||
        b.name === values.batch ||
        b.batchCode === values.batch ||
        b.code === values.batch
      );
      const validBatchId = assocBatch && isUUID(assocBatch.id) ? assocBatch.id : null;

      const newRecord: ExpenseRecord = {
        id: `exp-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
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
        const notesJson = JSON.stringify({
          personName: user?.fullName || 'Employee',
          expenseType: expType,
          batchName: values.batch as string || null,
          route: values.route as string || null,
          vehicle: isSelfTravel ? vehicle : null,
          km: isSelfTravel ? km : null,
          rate: isSelfTravel ? rate : null,
          userNotes: (values.notes as string) || (values.route as string) || '',
        });

        // Idempotency key: a client-generated primary key means a replayed /
        // retried identical submit collides on the PK instead of creating a
        // duplicate claim (DB-level backstop to the submittingClaim UX lock).
        const claimId =
          typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : undefined;

        const { error } = await supabase.from('flwdsk_expense_claims').insert({
          ...(claimId ? { id: claimId } : {}),
          employee_id: validEmpId,
          person_name: user?.fullName || 'Employee',
          expense_type: expType,
          amount,
          category: values.categoryType || 'Office Expense',
          receipt_url: receiptLink,
          status: 'submitted',
          notes: notesJson,
          batch_id: validBatchId,
          batch_name: (assocBatch as any)?.name || (values.batch as string) || null,
          is_office_expense: values.categoryType === 'Office Expense',
          description: (values.notes as string) || (values.route as string) || expType,
        });

        if (error) {
          toast({
            variant: 'error',
            title: 'Submission Failed',
            message: `Could not save claim to database: ${error.message}`,
          });
          return;
        }
      } catch (e: any) {
        console.warn('Supabase expense submit catch warning:', e);
        toast({
          variant: 'error',
          title: 'Submission Failed',
          message: e.message || 'An unexpected database error occurred.',
        });
        return;
      }

      setExpenses((prev) => [newRecord, ...(Array.isArray(prev) ? prev : [])]);
      const todayStr = new Date().toISOString().split('T')[0];
      const monthFolder = `${todayStr.slice(0, 4)}-${['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(todayStr.slice(5, 7), 10) - 1]}`;
      toast({
        variant: 'success',
        title: 'Claim Filed & Receipt Uploaded',
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
      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        toast({ variant: 'error', title: 'Approval Failed', message: error.message });
      } else {
        toast({ variant: 'success', title: 'Claim Approved', message: 'Expense claim authorized and locked.' });
        loadClaims();
      }
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

      if (error) {
        toast({ variant: 'error', title: 'Rejection Failed', message: error.message });
      } else {
        toast({ variant: 'warning', title: 'Claim Rejected', message: 'Expense claim status updated to rejected.' });
        loadClaims();
      }
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
      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq('id', id);

      if (error) {
        toast({ variant: 'error', title: 'Deletion Failed', message: error.message });
      } else {
        toast({ variant: 'warning', title: 'Claim Deleted', message: 'Expense claim has been deleted.' });
        loadClaims();
      }
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
      if (action === 'delete') {
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id,
          })
          .in('id', selectedIds);
        if (error) throw error;
        toast({ variant: 'warning', title: 'Claims Deleted', message: `${selectedIds.length} claim(s) successfully deleted.` });
      } else {
        const updates: Record<string, any> = {
          status: action === 'approve' ? 'approved' : 'rejected'
        };
        if (action === 'approve') {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .update(updates)
          .in('id', selectedIds);
        if (error) throw error;
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

  return (
    <AppShell>
      <div style={{ flexShrink: 0 }}>
        <PageHeader
        title="Expense Claims & Reimbursements"
        subtitle="Conditional expense filing, auto-calculated travel KM rates, and locked approval audit trails"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setRateModalOpen(true)}>⚙️ Travel Rates (KM)</Button>
            )}
            {isManagement && (
              <>
                <Button
                  style={{ background: 'var(--status-success)', color: 'white' }}
                  onClick={() => handleBulkAction('approve')}
                  disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                >
                  ✓ Bulk Approve Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                </Button>
                <Button
                  style={{ background: 'var(--status-danger)', color: 'white' }}
                  onClick={() => handleBulkAction('reject')}
                  disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                >
                  ✕ Bulk Reject Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleBulkAction('delete')}
                  disabled={Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length === 0}
                >
                  🗑️ Bulk Delete Selected ({Object.keys(selectedExpenses).filter((k) => selectedExpenses[k]).length})
                </Button>
              </>
            )}
            <Button onClick={() => setExpenseOpen(true)}>Submit Expense Claim</Button>
          </div>
        }
      />

      {/* Central Rate Info Banner */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>📍 Central Reimbursement Rates:</span>
          <Badge tone="info">🏍️ Bike: ₹{bikeRate} / KM</Badge>
          <Badge tone="purple">🚗 Car: ₹{carRate} / KM</Badge>
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

        {filteredExpenses.length === 0 ? (
          <EmptyState
            title="No expense claims found"
            message="No records match your selected search query or filter criteria."
          />
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
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{exp.date}</td>
                      <td>{exp.person}</td>
                      <td>
                        <Badge tone={exp.category.includes('Training') ? 'info' : 'neutral'}>
                          {exp.category}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{exp.type}</div>
                        {exp.vehicle && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span>{exp.vehicle} · {exp.km} km @ ₹</span>
                            {exp.status === 'submitted' && isManagement ? (
                              <input
                                type="number"
                                value={editingRates[exp.id] !== undefined ? editingRates[exp.id] : (exp.rate || (exp.vehicle === 'Car' ? carRate : bikeRate))}
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
                              <span>{exp.rate || (exp.vehicle === 'Car' ? carRate : bikeRate)}</span>
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
                        ₹ {exp.amount.toFixed(2)}
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
                          } else if (r === 'Uploaded Proof') {
                            return <span title="Receipt was uploaded but the direct link is not available" style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'default' }}>📎 Uploaded</span>;
                          } else {
                            return <span style={{ fontSize: 12, color: 'var(--status-danger)' }}>Missing</span>;
                          }
                        })()}
                      </td>
                      <td>
                        <Badge tone={exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}>
                          {isLocked ? '🔒 Approved' : exp.status}
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
                                  message: `Are you sure you want to delete this expense claim for ₹${exp.amount.toFixed(2)}? This cannot be undone.`,
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

      {/* Submit Expense Drawer */}
      <Drawer open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Submit Expense Claim">
        <Form initial={{ categoryType: 'Office Expense', expenseType: 'Self Travel', vehicle: 'Bike', km: '', route: '', amount: '' }} onSubmit={handleExpenseSubmit}>
          <DynamicExpenseForm
            bikeRate={bikeRate}
            carRate={carRate}
            batches={batches}
            customExpenseTypes={customExpenseTypes}
            onRegisterNewType={handleRegisterNewType}
            onSubmit={handleExpenseSubmit}
            onCancel={() => setExpenseOpen(false)}
            submittingClaim={submittingClaim}
          />
        </Form>
      </Drawer>

      {/* Rate Config Modal */}
      <Drawer open={rateModalOpen} onClose={() => setRateModalOpen(false)} title="CEO Settings: Self-Travel KM Rates">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="kvj-label">Bike Rate per KM (₹)</label>
            <input type="number" value={bikeRate} onChange={(e) => setBikeRate(Number(e.target.value))} className="kvj-input" />
          </div>
          <div>
            <label className="kvj-label">Car Rate per KM (₹)</label>
            <input type="number" value={carRate} onChange={(e) => setCarRate(Number(e.target.value))} className="kvj-input" />
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setRateModalOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                // Save to localStorage as a robust immediate fallback
                localStorage.setItem('kvj_bike_rate', String(bikeRate));
                localStorage.setItem('kvj_car_rate', String(carRate));

                // Save to Supabase
                const { error: errBike } = await supabase
                  .from('flwdsk_system_settings')
                  .upsert({ key: 'bike_rate_per_km', value: bikeRate });
                  
                const { error: errCar } = await supabase
                  .from('flwdsk_system_settings')
                  .upsert({ key: 'car_rate_per_km', value: carRate });

                if (errBike || errCar) {
                  console.warn('Supabase travel rates upsert warning:', errBike || errCar);
                  toast({
                    variant: 'success',
                    title: 'Rates Saved (Local Only)',
                    message: 'Rates saved to local browser storage. Note: Database sync failed.'
                  });
                } else {
                  toast({
                    variant: 'success',
                    title: 'Rates Saved',
                    message: 'Updated central travel KM reimbursement rates in DB and local storage.'
                  });
                }
                setRateModalOpen(false);
              } catch (e: any) {
                toast({ variant: 'error', title: 'Save Failed', message: e.message });
              }
            }}>
              Save Travel Rates
            </Button>
          </div>
        </div>
      </Drawer>
    </AppShell>
  );
}

export default ExpenseClaims;
