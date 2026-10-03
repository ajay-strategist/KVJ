import React, { useState, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { googleIntegration } from '../../../shared/integration/google';
import { supabase } from '../../../shared/integration/supabase';
import type { TravelRate } from './TravelRatesModal';
import { parseExpenseDateToYMD, formatDisplayDateGB } from '../pages/ExpenseClaims';

export function cleanBatchNameForDisplay(val?: string | null): string {
  if (!val || val === '—') return '—';
  let clean = String(val).trim();
  // Strip leading "Batch (" and trailing ")" if present
  clean = clean.replace(/^Batch\s*\(/i, '').replace(/\)$/, '').replace(/^Batch\s+-\s+/i, '').trim();
  if (clean.toLowerCase().startsWith('batch ') && !clean.toLowerCase().includes('batch 1') && !clean.toLowerCase().includes('batch 2') && !clean.toLowerCase().includes('batch 3')) {
    clean = clean.slice(6).trim();
  }
  return clean || '—';
}

export interface ExpenseClaimModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  travelRates?: TravelRate[];
  bikeRate?: number;
  carRate?: number;
  batches: Array<any>;
  customExpenseTypes: string[];
  onRegisterNewType: (name: string) => Promise<boolean>;
  /** If true the drawer opens directly in batch (multi-entry) mode */
  defaultBatchMode?: boolean;
}

// ── Batch item type ────────────────────────────────────────────────────────
interface BatchExpenseItem {
  expenseDate: string;
  categoryType: 'Office Expense' | 'Training Expense';
  batchName: string;
  expenseType: string;
  vehicle: string;
  km: string;
  route: string;
  amount: string;
  notes: string;
  /** resolved amount — computed before staging */
  resolvedAmount: number;
}

// ── Small staged-item pill ─────────────────────────────────────────────────
function StagedItemRow({
  item,
  index,
  onRemove,
}: {
  item: BatchExpenseItem;
  index: number;
  onRemove: (i: number) => void;
}) {
  const isSelfTravel = item.expenseType === 'Self Travel';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 18 }}>{isSelfTravel ? '🚗' : '🧾'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.expenseType}
          {item.categoryType === 'Training Expense' && item.batchName && (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>({item.batchName})</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {item.expenseDate}
          {isSelfTravel && item.km ? ` · ${item.km} km` : ''}
          {item.route ? ` · ${item.route}` : ''}
        </div>
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        ₹{item.resolvedAmount.toLocaleString('en-IN')}
      </span>
      <button
        type="button"
        onClick={() => onRemove(index)}
        title="Remove this item"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: 'var(--status-danger)', padding: '2px 4px', borderRadius: 4,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export function ExpenseClaimModal({
  open,
  onClose,
  onSuccess,
  travelRates,
  bikeRate = 3.0,
  carRate = 9.5,
  batches,
  customExpenseTypes,
  onRegisterNewType,
  defaultBatchMode = false,
}: ExpenseClaimModalProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Mode toggle ──────────────────────────────────────────────────────────
  const [batchMode, setBatchMode] = useState<boolean>(defaultBatchMode);
  const [batchItems, setBatchItems] = useState<BatchExpenseItem[]>([]);

  // ── Form fields ──────────────────────────────────────────────────────────
  const [expenseDate, setExpenseDate] = useState<string>(todayStr);
  const [categoryType, setCategoryType] = useState<'Office Expense' | 'Training Expense'>('Office Expense');
  const [batchName, setBatchName] = useState<string>('');
  const [expenseType, setExpenseType] = useState<string>('Self Travel');
  const [vehicle, setVehicle] = useState<string>('Bike');
  const [km, setKm] = useState<string>('');
  const [route, setRoute] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [newTypeInput, setNewTypeInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isSelfTravel = expenseType === 'Self Travel';
  const isBusOrTransport = ['Bus Travelling / Fare', 'Bus Travelling', 'Public Transport', 'Bus Fare'].includes(expenseType) || expenseType.toLowerCase().includes('bus');
  const isTravelRelated = isSelfTravel || isBusOrTransport || expenseType.toLowerCase().includes('travel');
  const isTraining = categoryType === 'Training Expense';

  const kmVal = Number(km || 0);

  const availableRates: TravelRate[] = useMemo(() => {
    if (travelRates && travelRates.length > 0) {
      return travelRates.map((r) => ({ ...r, ratePerKm: Number(r.ratePerKm) }));
    }
    return [
      { id: 'bike', name: 'Bike', ratePerKm: Number(bikeRate), icon: '🏍️' },
      { id: 'car', name: 'Car', ratePerKm: Number(carRate), icon: '🚗' },
    ];
  }, [travelRates, bikeRate, carRate]);

  const selectedRateObj = useMemo(() => {
    return (
      availableRates.find((r) => r.name.toLowerCase() === vehicle.toLowerCase()) ||
      availableRates.find((r) => r.id === vehicle.toLowerCase()) ||
      availableRates[0]
    );
  }, [availableRates, vehicle]);

  const activeRate = Number(selectedRateObj ? selectedRateObj.ratePerKm : (vehicle.toLowerCase().includes('car') ? carRate : bikeRate));
  const calculatedTravelAmount = isSelfTravel ? Number((kmVal * activeRate).toFixed(2)) : 0;
  const finalAmount = isSelfTravel ? calculatedTravelAmount : Number(amount || 0);

  const batchOptions = useMemo(() => {
    if (batches && batches.length > 0) {
      return batches.map((b: any) => {
        let label = b.batchCode || b.code || b.name || b.title || '';
        const acadYear = b.academicYear || b.academic_year || '';

        label = cleanBatchNameForDisplay(label);
        if (label === '—' || label.toLowerCase() === 'batch') {
          const parts = [b.college, b.program || b.trainingName, acadYear, b.batchNo].filter(Boolean);
          label = parts.length > 0 ? parts.join(' - ') : 'Training Batch';
        } else if (acadYear && !label.includes(acadYear)) {
          if (/Batch\s*\d+/i.test(label)) {
            label = label.replace(/(Batch\s*\d+)/i, `${acadYear} - $1`);
          } else {
            label = `${label} - ${acadYear}`;
          }
        }

        return {
          value: label,
          label: label,
        };
      });
    }
    return [
      { value: 'Christ 3BBA Data Analytics - 2026-2027 - Batch 1', label: 'Christ 3BBA Data Analytics - 2026-2027 - Batch 1' },
      { value: 'SB College - 2 MBA - 2026-2027 - Batch 1', label: 'SB College - 2 MBA - 2026-2027 - Batch 1' },
      { value: 'Vimala College - UG - 2026-2027 - Batch 2', label: 'Vimala College - UG - 2026-2027 - Batch 2' },
    ];
  }, [batches]);

  const expenseTypeOptions = useMemo(() => {
    const defaults = [
      'Self Travel',
      'Bus Travelling / Fare',
      'Public Transport',
      'Morning Tea',
      'Lunch & Refreshments',
      'Evening Tea',
      'Stationery & Printing',
      'Lab / System Supplies',
      'Miscellaneous',
    ];
    const combined = Array.from(new Set([...defaults, ...customExpenseTypes]));
    const opts = combined.map((t) => ({
      value: t,
      label: t === 'Self Travel' ? '🚗 Self Travel (Bike / Car KM Reimbursement)' : (t === 'Bus Travelling / Fare' ? '🚌 Bus Travelling / Fare' : t),
    }));
    opts.push({ value: '__NEW_TYPE__', label: '➕ Register New Expense Type...' });
    return opts;
  }, [customExpenseTypes]);

  const handleSaveNewType = async () => {
    const val = newTypeInput.trim();
    if (!val) return;
    const ok = await onRegisterNewType(val);
    if (ok) {
      setExpenseType(val);
      setNewTypeInput('');
    }
  };

  function validateCurrentForm(): string | null {
    if (isTraining && !batchName) return 'Training Batch is mandatory for Training Expenses.';
    if (isSelfTravel) {
      if (!kmVal || kmVal <= 0) return 'Please enter valid kilometers traveled.';
      if (!route.trim()) return 'Please specify the travel route.';
    } else {
      if (!finalAmount || finalAmount <= 0) return 'Please enter a valid expense amount.';
      if (isTravelRelated && !route.trim()) return 'Please specify the travel route.';
    }
    return null;
  }

  // ── Reset form to defaults ───────────────────────────────────────────────
  const resetForm = () => {
    setExpenseDate(todayStr);
    setCategoryType('Office Expense');
    setBatchName('');
    setExpenseType('Self Travel');
    setVehicle('Bike');
    setKm('');
    setRoute('');
    setAmount('');
    setReceiptFile(null);
    setNotes('');
  };

  // ── Add current form to batch staging list ───────────────────────────────
  const handleAddToBatch = () => {
    const err = validateCurrentForm();
    if (err) {
      toast({ variant: 'error', title: 'Validation Error', message: err });
      return;
    }
    const item: BatchExpenseItem = {
      expenseDate,
      categoryType,
      batchName: isTraining ? batchName : '',
      expenseType,
      vehicle: isSelfTravel ? vehicle : '',
      km: isSelfTravel ? km : '',
      route: isSelfTravel ? route : '',
      amount,
      notes,
      resolvedAmount: finalAmount,
    };
    setBatchItems((prev) => [...prev, item]);
    resetForm();
    toast({ variant: 'success', title: 'Added to Batch', message: `₹${finalAmount.toLocaleString('en-IN')} staged. Add more or submit all.` });
  };

  const handleRemoveBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const batchTotal = useMemo(() => batchItems.reduce((s, i) => s + i.resolvedAmount, 0), [batchItems]);

  // ── Core save logic (shared for single & batch) ─────────────────────────
  const saveOneClaim = async (
    item: BatchExpenseItem,
    file: File | null,
    isTravelItem: boolean,
    rateUsed: number
  ) => {
    let receiptLink: string = file ? file.name : 'No Receipt Attached';

    if (file) {
      try {
        const base64Content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });

        const driveRes = await googleIntegration.uploadReceiptWithMetadata({
          date: item.expenseDate,
          personName: user?.fullName || 'Employee',
          isOfficeExpense: item.categoryType === 'Office Expense',
          batchName: item.categoryType === 'Training Expense' ? item.batchName : undefined,
          expenseType: item.expenseType,
          amount: item.resolvedAmount,
          originalFileName: file.name,
          mimeType: file.type || 'application/pdf',
          base64Content,
          uploadedBy: user?.fullName || 'Employee',
        });

        if (driveRes && driveRes.googleDriveViewUrl) {
          receiptLink = driveRes.googleDriveViewUrl;
        }
      } catch (uploadErr) {
        console.warn('Google Drive receipt upload warning:', uploadErr);
      }
    }

    const normalizedYMD = parseExpenseDateToYMD(item.expenseDate);
    const dateFmtGB = formatDisplayDateGB(item.expenseDate);

    const notesPayload = JSON.stringify({
      personName: user?.fullName || 'Employee',
      expenseType: item.expenseType,
      batchName: item.categoryType === 'Training Expense' ? item.batchName : undefined,
      route: isTravelItem ? item.route.trim() : undefined,
      vehicle: isTravelItem ? item.vehicle : undefined,
      km: isTravelItem ? Number(item.km || 0) : undefined,
      rate: isTravelItem ? rateUsed : undefined,
      userNotes: item.notes.trim() || undefined,
      expenseDate: normalizedYMD,
    });

    const claimId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : undefined;
    const safeIsoDate = normalizedYMD ? new Date(`${normalizedYMD}T12:00:00.000Z`).toISOString() : new Date().toISOString();

    // Resolve valid employee UUID
    let validEmployeeId: string | null = null;
    const isUuid = (str?: string | null) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
    if (!validEmployeeId && isUuid(user?.id)) validEmployeeId = user!.id;

    const insertPayload: Record<string, any> = {
      amount: item.resolvedAmount,
      category: item.categoryType || 'Office Expense',
      receipt_url: receiptLink,
      status: 'submitted',
      created_at: safeIsoDate,
      notes: notesPayload,
    };
    if (claimId) insertPayload.id = claimId;
    if (validEmployeeId) insertPayload.employee_id = validEmployeeId;

    try {
      const { error: insertError } = await supabase.from('flwdsk_expense_claims').insert(insertPayload);
      if (insertError) {
        const retryPayload = { ...insertPayload };
        delete retryPayload.id;
        await supabase.from('flwdsk_expense_claims').insert(retryPayload);
      }
    } catch (dbErr) {
      console.warn('Supabase expense claim insert exception:', dbErr);
    }

    // Always persist to localStorage
    const localRecord = {
      id: claimId || `local_exp_${Date.now()}`,
      date: dateFmtGB,
      person: user?.fullName || 'Employee',
      category: item.categoryType || 'Office Expense',
      type: item.expenseType,
      batch: item.categoryType === 'Training Expense' ? item.batchName : '',
      route: isTravelItem ? item.route.trim() : '',
      vehicle: isTravelItem ? item.vehicle : undefined,
      km: isTravelItem ? Number(item.km || 0) : undefined,
      rate: isTravelItem ? rateUsed : undefined,
      notes: item.notes.trim() || undefined,
      amount: item.resolvedAmount,
      receipt: receiptLink,
      status: 'submitted',
      employeeId: validEmployeeId || user?.id || '',
      createdAt: safeIsoDate,
    };

    try {
      const existingStr = localStorage.getItem('kvj_local_expense_claims');
      const existingArr = existingStr ? JSON.parse(existingStr) : [];
      const filtered = Array.isArray(existingArr) ? existingArr.filter((x: any) => x.id !== localRecord.id) : [];
      localStorage.setItem('kvj_local_expense_claims', JSON.stringify([localRecord, ...filtered]));
    } catch {}

    return item.resolvedAmount;
  };

  // ── Single submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validateCurrentForm();
    if (err) {
      const fieldLabel = err.includes('Batch') ? 'Batch Required'
        : err.includes('kilometer') ? 'KM Required'
        : err.includes('Route') ? 'Route Required'
        : 'Amount Required';
      toast({ variant: 'error', title: fieldLabel, message: err });
      return;
    }

    setSubmitting(true);
    try {
      await saveOneClaim(
        { expenseDate, categoryType, batchName: isTraining ? batchName : '', expenseType, vehicle, km, route, amount, notes, resolvedAmount: finalAmount },
        receiptFile,
        isSelfTravel,
        activeRate
      );

      toast({
        variant: 'success',
        title: 'Claim Submitted',
        message: `Expense claim of ₹${finalAmount.toLocaleString('en-IN')} submitted to Approvals Queue.`,
      });

      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting expense claim:', err);
      toast({ variant: 'error', title: 'Submission Failed', message: err?.message || 'Could not submit claim.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Batch submit all ────────────────────────────────────────────────────
  const handleSubmitBatch = async () => {
    if (batchItems.length === 0) {
      toast({ variant: 'warning', title: 'No Items', message: 'Add at least one expense before submitting.' });
      return;
    }
    setSubmitting(true);
    let successCount = 0;
    let totalSaved = 0;
    try {
      for (const item of batchItems) {
        try {
          const isTravelItem = item.expenseType === 'Self Travel';
          const rateUsed = availableRates.find((r) => r.name.toLowerCase() === item.vehicle.toLowerCase())?.ratePerKm ?? activeRate;
          const saved = await saveOneClaim(item, null, isTravelItem, rateUsed);
          totalSaved += saved;
          successCount++;
        } catch (itemErr) {
          console.warn('Batch item save error:', itemErr);
        }
      }

      toast({
        variant: 'success',
        title: `${successCount} Claim${successCount !== 1 ? 's' : ''} Submitted`,
        message: `Total ₹${totalSaved.toLocaleString('en-IN')} submitted to Approvals Queue.`,
      });

      setBatchItems([]);
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Batch Submission Failed', message: err?.message || 'Could not submit batch.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setBatchItems([]);
      resetForm();
      setBatchMode(defaultBatchMode);
      onClose();
    }
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Submit Expense Claim">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Expense Date */}
          <div>
            <label className="kvj-label">
              Expense Date <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="date"
              required
              className="kvj-input"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Classification */}
          <div>
            <label className="kvj-label">Expense Classification</label>
            <select
              className="kvj-select"
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as any)}
              style={{ width: '100%' }}
            >
              <option value="Office Expense">🏢 Office Expense</option>
              <option value="Training Expense">🎓 Training Expense (College Batch)</option>
            </select>
          </div>

          {/* Dynamic Batch Selector if Training Expense */}
          {isTraining && (
            <div>
              <label className="kvj-label">
                Training Batch <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <select
                className="kvj-select"
                required
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select Training Batch...</option>
                {batchOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Expense Type */}
          <div>
            <label className="kvj-label">Expense Type</label>
            <select
              className="kvj-select"
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value)}
              style={{ width: '100%' }}
            >
              {expenseTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Register New Type Inline */}
          {expenseType === '__NEW_TYPE__' && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
              <label className="kvj-label">New Expense Type Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. Software License..."
                  className="kvj-input"
                  value={newTypeInput}
                  onChange={(e) => setNewTypeInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button type="button" size="sm" onClick={handleSaveNewType}>
                  Register
                </Button>
              </div>
            </div>
          )}

          {/* IF SELF TRAVEL: Vehicle, KM, Route, Auto Amount */}
          {isSelfTravel ? (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="kvj-label">Vehicle</label>
                  <select
                    className="kvj-select"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {availableRates.map((r) => (
                      <option key={r.id || r.name} value={r.name}>
                        {r.icon || '🚗'} {r.name} (₹{r.ratePerKm}/km)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="kvj-label">
                    Kilometers (KM) <span style={{ color: 'var(--status-danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required={!batchMode}
                    min="0.5"
                    step="0.5"
                    placeholder="e.g. 35"
                    className="kvj-input"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label className="kvj-label">
                  Travel Route <span style={{ color: 'var(--status-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required={!batchMode}
                  placeholder="e.g. Office -> Christ College -> Return"
                  className="kvj-input"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--primary-50, #eff6ff)',
                  border: '1px solid var(--primary-200, #bfdbfe)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-800, #1e40af)' }}>
                  Reimbursement Amount:
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-700, #1d4ed8)' }}>
                  ₹{calculatedTravelAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                ℹ️ Self travel claims do not require a receipt slip.
              </div>
            </div>
          ) : (
            /* NON-SELF-TRAVEL EXPENSE (e.g. Bus Travelling, Refreshments, Supplies) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isTravelRelated && (
                <div>
                  <label className="kvj-label">
                    Travel Route <span style={{ color: 'var(--status-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required={!batchMode}
                    placeholder="e.g. Kottayam -> Changanassery -> Return"
                    className="kvj-input"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              <div>
                <label className="kvj-label">
                  Expense Amount (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  required={!batchMode}
                  min="1"
                  step="1"
                  placeholder="e.g. 250"
                  className="kvj-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          )}

          {/* Receipt Upload (only in single mode — batch skips file upload) */}
          {!batchMode && (
            <div>
              <label className="kvj-label">Receipt / Bill Upload (Optional)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="kvj-input"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="kvj-label">Notes / Remarks</label>
            <textarea
              rows={2}
              className="kvj-input"
              placeholder="Additional details for approver..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* ── Action Buttons ── */}
          {batchMode ? (
            <Button
              type="button"
              onClick={handleAddToBatch}
              disabled={submitting || finalAmount <= 0}
              style={{ width: '100%' }}
            >
              ✚ Add to Batch
            </Button>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || finalAmount <= 0}>
                {submitting ? 'Submitting...' : `Submit Claim (₹${finalAmount})`}
              </Button>
            </div>
          )}
        </form>

        {/* ── Staged Items List (batch mode only) ── */}
        {batchMode && batchItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Section header + running total */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--brand) 10%, var(--bg-sunken))',
              border: '1px solid color-mix(in srgb, var(--brand) 25%, var(--border))',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                📋 Staged Items ({batchItems.length})
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                Total: ₹{batchTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {batchItems.map((item, idx) => (
              <StagedItemRow
                key={idx}
                item={item}
                index={idx}
                onRemove={handleRemoveBatchItem}
              />
            ))}

            {/* Submit All */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitBatch}
                disabled={submitting}
                style={{ flex: 2 }}
              >
                {submitting
                  ? 'Submitting...'
                  : `Submit All (${batchItems.length}) Claims — ₹${batchTotal.toLocaleString('en-IN')}`}
              </Button>
            </div>
          </div>
        )}

        {/* Empty batch state hint */}
        {batchMode && batchItems.length === 0 && (
          <div style={{
            padding: '14px 16px', borderRadius: 8,
            border: '1.5px dashed var(--border)',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 22 }}>📭</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Fill in the form above and click <strong>Add to Batch</strong> to stage each expense.<br />
              When done, click <strong>Submit All Claims</strong>.
            </span>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 10 }}>
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
export default ExpenseClaimModal;
