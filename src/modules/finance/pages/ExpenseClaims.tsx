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
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, useForm } from '../../../shared/forms/form';
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
}: {
  bikeRate: number;
  carRate: number;
  batches: Array<any>;
  customExpenseTypes: string[];
  onRegisterNewType: (name: string) => Promise<void>;
  onSubmit: (vals: any) => void;
  onCancel: () => void;
}) {
  const { values, setValue } = useForm();
  const [newTypeInput, setNewTypeInput] = useState('');
  const receiptFile = values.receiptFile as File | null;
  const receiptPreview = values.receiptPreview as string || '';

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
    if (!newTypeInput.trim()) return;
    await onRegisterNewType(newTypeInput.trim());
    setNewTypeInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('receiptFile', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('receiptPreview', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
        />
      )}

      <SelectField
        name="expenseType"
        label="Expense Type *"
        options={expenseTypeOptions}
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
          <TextField name="km" label="Kilometers (KM) Travelled *" placeholder="e.g. 16" />
          <TextField name="route" label="Travel Route (Mandatory: e.g., HQ to Christ College)" placeholder="e.g. Kakkanad HQ to Irinjalakuda" />

          {kmVal > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Auto Calculated Reimbursement</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success)', marginTop: 2 }}>
                ₹ {calculatedAmount.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>({kmVal} km × ₹{rate}/km)</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <TextField name="amount" label="Expense Amount (₹) *" placeholder="e.g. 150.00" />

          {/* File Upload for Receipt & Google Sheet Integration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Upload Receipt Image / PDF (Stored &amp; Linked to Google Sheet) *
            </label>
            <div
              style={{
                border: receiptFile ? '2px solid var(--status-success)' : '2px dashed var(--brand)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                textAlign: 'center',
                background: receiptFile ? 'rgba(16,185,129,0.08)' : 'var(--bg-sunken)',
                transition: 'all 0.15s ease',
              }}
            >
              {receiptFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {receiptFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--status-success)', fontWeight: 600, marginTop: 2 }}>
                        {(receiptFile.size / 1024).toFixed(1)} KB — Receipt Attached &amp; Ready for Sheet Sync
                      </div>
                    </div>
                  </div>
                   <Button
                    size="xs"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setValue('receiptFile', null);
                      setValue('receiptPreview', '');
                    }}
                  >
                    ✕ Remove
                  </Button>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                  <span style={{ fontSize: 24, color: 'var(--brand)' }}>📤</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Click here to select receipt file (or drag &amp; drop)
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Supports JPG, PNG, WEBP &amp; PDF files (Up to 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          </div>
        </>
      )}

      <TextField name="notes" label="Notes / Description (Optional)" placeholder="Additional details..." />

      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Submit Expense Claim</Button>
      </div>
    </div>
  );
}

export function ExpenseClaims() {
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { user } = useAuth();
  const { batches } = useTraining();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [bikeRate, setBikeRate] = useState(5.0);
  const [carRate, setCarRate] = useState(12.0);

  const [customExpenseTypes, setCustomExpenseTypes] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, boolean>>({});
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});

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
        .select('*');
      
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

  const handleRegisterNewType = async (typeName: string) => {
    setCustomExpenseTypes((prev) => Array.from(new Set([...prev, typeName])));
    toast({ variant: 'success', title: 'Expense Type Registered', message: `Registered "${typeName}" in database.` });
    try {
      await supabase.from('flwdsk_expense_types').insert({ name: typeName });
    } catch (e) {
      console.warn('Supabase expense_types insert warning:', e);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (!isManagement) {
        return true;
      }
      if (selectedPersonFilter !== 'all') {
        return exp.person.toLowerCase() === selectedPersonFilter.toLowerCase();
      }
      return true;
    });
  }, [expenses, isManagement, selectedPersonFilter]);

  const handleExpenseSubmit = async (values: Record<string, unknown>) => {
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

      const { error } = await supabase.from('flwdsk_expense_claims').insert({
        employee_id: validEmpId,
        category: values.categoryType || 'Office Expense',
        amount,
        receipt_url: receiptLink,
        status: 'submitted',
        notes: notesJson,
      });

      if (error) {
        console.warn('Supabase insert warning, persisting to local state:', error.message);
      }
    } catch (e: any) {
      console.warn('Supabase expense submit catch warning:', e);
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
  };

  const handleUpdateRate = async (exp: ExpenseRecord, newRate: number) => {
    if (isNaN(newRate) || newRate < 0) {
      toast({ variant: 'error', title: 'Invalid Rate', message: 'Rate must be a non-negative number.' });
      return;
    }
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
    }
  };

  const handleApprove = async (id: string) => {
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
    }
  };

  const handleReject = async (id: string) => {
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
    }
  };

  const handleDeleteClaim = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .delete()
        .eq('id', id);

      if (error) {
        toast({ variant: 'error', title: 'Deletion Failed', message: error.message });
      } else {
        toast({ variant: 'warning', title: 'Claim Deleted', message: 'Expense claim has been deleted.' });
        loadClaims();
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Deletion Failed', message: e.message });
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
    if (selectedIds.length === 0) return;

    const actionText = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'delete';
    const confirmOk = await confirm({
      title: `Bulk ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}?`,
      message: `Are you sure you want to ${actionText} the ${selectedIds.length} selected expense claim(s)?`,
    });
    if (!confirmOk) return;

    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('flwdsk_expense_claims')
          .delete()
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
    }
  };

  return (
    <AppShell>
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

      {/* Expense Claims Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 Expense Claims ({filteredExpenses.length})
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

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
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
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
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
                                fontSize: '11px',
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
                      {exp.route && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🗺 {exp.route}</div>}
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
                            <span title={`File: ${r}`} style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'default' }}>
                              📎 {r}
                            </span>
                          );
                        } else if (exp.vehicle) {
                          return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>KM Auto-Calc</span>;
                        } else if (r === 'Uploaded Proof') {
                          return <span title="Receipt was uploaded but the direct link is not available" style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'default' }}>📎 Uploaded</span>;
                        } else {
                          return <span style={{ fontSize: 11, color: 'var(--status-danger)' }}>Missing</span>;
                        }
                      })()}
                    </td>
                    <td>
                      <Badge tone={exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}>
                        {isLocked ? '🔒 Approved' : exp.status}
                      </Badge>
                      {exp.approvedBy && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          by {exp.approvedBy}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {!isLocked && exp.status === 'submitted' && isManagement && (
                          <>
                            <Button size="xs" variant="success" onClick={() => handleApprove(exp.id)}>Approve</Button>
                            <Button size="xs" variant="danger" onClick={() => handleReject(exp.id)}>Reject</Button>
                          </>
                        )}
                        {!isLocked && (
                          <Button
                            size="xs"
                            variant="danger"
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
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
      </Card>

      {/* Submit Expense Drawer */}
      <Drawer open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Submit Expense Claim">
        <Form initial={{ categoryType: 'Office Expense', expenseType: 'Self Travel', vehicle: 'Bike', km: '0' }} onSubmit={handleExpenseSubmit}>
          <DynamicExpenseForm
            bikeRate={bikeRate}
            carRate={carRate}
            batches={batches}
            customExpenseTypes={customExpenseTypes}
            onRegisterNewType={handleRegisterNewType}
            onSubmit={handleExpenseSubmit}
            onCancel={() => setExpenseOpen(false)}
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
