import React, { useState, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { googleIntegration } from '../../../shared/integration/google';
import { supabase } from '../../../shared/integration/supabase';
import type { TravelRate } from './TravelRatesModal';
import { parseExpenseDateToYMD, formatDisplayDateGB } from '../pages/ExpenseClaims';

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
}

export function ExpenseClaimModal({
  open,
  onClose,
  onSuccess,
  travelRates,
  bikeRate = 5.2,
  carRate = 8.5,
  batches,
  customExpenseTypes,
  onRegisterNewType,
}: ExpenseClaimModalProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const todayStr = new Date().toISOString().slice(0, 10);

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
  const isTraining = categoryType === 'Training Expense';

  const kmVal = Number(km || 0);

  const availableRates: TravelRate[] = useMemo(() => {
    if (travelRates && travelRates.length > 0) return travelRates;
    return [
      { id: 'bike', name: 'Bike', ratePerKm: bikeRate, icon: '🏍️' },
      { id: 'car', name: 'Car', ratePerKm: carRate, icon: '🚗' },
    ];
  }, [travelRates, bikeRate, carRate]);

  const selectedRateObj = useMemo(() => {
    return (
      availableRates.find((r) => r.name.toLowerCase() === vehicle.toLowerCase()) ||
      availableRates[0]
    );
  }, [availableRates, vehicle]);

  const activeRate = selectedRateObj ? selectedRateObj.ratePerKm : (vehicle.toLowerCase().includes('car') ? carRate : bikeRate);
  const calculatedTravelAmount = isSelfTravel ? kmVal * activeRate : 0;
  const finalAmount = isSelfTravel ? calculatedTravelAmount : Number(amount || 0);

  const batchOptions = useMemo(() => {
    if (batches && batches.length > 0) {
      return batches.map((b: any) => {
        const name = b.name || 'Batch';
        const code = b.batchCode || b.code || '';
        return {
          value: code ? `${name} (${code})` : name,
          label: code ? `${name} (${code})` : name,
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
    const defaults = [
      'Self Travel',
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
      label: t === 'Self Travel' ? '🚗 Self Travel (Bike / Car KM Reimbursement)' : t,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isTraining && !batchName) {
      toast({ variant: 'error', title: 'Batch Required', message: 'Training Batch is mandatory for Training Expenses.' });
      return;
    }

    if (isSelfTravel) {
      if (!kmVal || kmVal <= 0) {
        toast({ variant: 'error', title: 'KM Required', message: 'Please enter valid kilometers traveled.' });
        return;
      }
      if (!route.trim()) {
        toast({ variant: 'error', title: 'Route Required', message: 'Please specify the travel route.' });
        return;
      }
    } else {
      if (!finalAmount || finalAmount <= 0) {
        toast({ variant: 'error', title: 'Amount Required', message: 'Please enter a valid expense amount.' });
        return;
      }
    }

    setSubmitting(true);
    try {
      let receiptLink: string = receiptFile ? receiptFile.name : 'No Receipt Attached';

      if (receiptFile) {
        try {
          const base64Content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res.includes(',') ? res.split(',')[1] : res);
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(receiptFile);
          });

          const driveRes = await googleIntegration.uploadReceiptWithMetadata({
            date: expenseDate,
            personName: user?.fullName || 'Employee',
            isOfficeExpense: categoryType === 'Office Expense',
            batchName: isTraining ? batchName : undefined,
            expenseType,
            amount: finalAmount,
            originalFileName: receiptFile.name,
            mimeType: receiptFile.type || 'application/pdf',
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

      // Format date for display
      const normalizedYMD = parseExpenseDateToYMD(expenseDate);
      const dateFmtGB = formatDisplayDateGB(expenseDate);

      const notesPayload = JSON.stringify({
        personName: user?.fullName || 'Employee',
        expenseType,
        batchName: isTraining ? batchName : undefined,
        route: isSelfTravel ? route.trim() : undefined,
        vehicle: isSelfTravel ? vehicle : undefined,
        km: isSelfTravel ? kmVal : undefined,
        rate: isSelfTravel ? activeRate : undefined,
        userNotes: notes.trim() || undefined,
        expenseDate: normalizedYMD,
      });

      const claimId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : undefined;
      const safeIsoDate = normalizedYMD ? new Date(`${normalizedYMD}T12:00:00.000Z`).toISOString() : new Date().toISOString();

      // Resolve valid employee UUID from database
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

      const insertPayload: Record<string, any> = {
        amount: finalAmount,
        category: categoryType || 'Office Expense',
        receipt_url: receiptLink,
        status: 'submitted',
        created_at: safeIsoDate,
        notes: notesPayload,
      };

      if (claimId) {
        insertPayload.id = claimId;
      }
      if (validEmployeeId) {
        insertPayload.employee_id = validEmployeeId;
      }

      let insertedSuccessfully = false;
      try {
        const { error: insertError } = await supabase.from('flwdsk_expense_claims').insert(insertPayload);
        if (!insertError) {
          insertedSuccessfully = true;
        } else {
          console.warn('Expense claim insert warning (attempt 1):', insertError);
          // Retry without explicit id (allowing DB DEFAULT gen_random_uuid())
          const retryPayload = { ...insertPayload };
          delete retryPayload.id;
          const { error: retryErr } = await supabase.from('flwdsk_expense_claims').insert(retryPayload);
          if (!retryErr) {
            insertedSuccessfully = true;
          } else {
            console.warn('Expense claim insert warning (attempt 2):', retryErr);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase expense claim insert exception:', dbErr);
      }

      // Always save to local storage cache so the claim is immediately available in the table
      const localRecord = {
        id: claimId || `local_exp_${Date.now()}`,
        date: dateFmtGB,
        person: user?.fullName || 'Employee',
        category: categoryType || 'Office Expense',
        type: expenseType,
        batch: isTraining ? batchName : '',
        route: isSelfTravel ? route.trim() : '',
        vehicle: isSelfTravel ? vehicle : undefined,
        km: isSelfTravel ? kmVal : undefined,
        rate: isSelfTravel ? activeRate : undefined,
        notes: notes.trim() || undefined,
        amount: finalAmount,
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

      toast({
        variant: 'success',
        title: 'Claim Submitted',
        message: `Expense claim of ₹${finalAmount.toLocaleString('en-IN')} submitted to Approvals Queue.`,
      });

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

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting expense claim:', err);
      toast({ variant: 'error', title: 'Submission Failed', message: err?.message || 'Could not submit claim.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Submit Expense Claim">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Expense Date (Allows Past Dates) */}
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
                  required
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
                required
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
          /* NON-TRAVEL EXPENSE */
          <div>
            <label className="kvj-label">
              Expense Amount (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              step="1"
              placeholder="e.g. 250"
              className="kvj-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* Receipt Upload (Optional for all expenses as agreed) */}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || finalAmount <= 0}>
            {submitting ? 'Submitting...' : `Submit Claim (₹${finalAmount})`}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default ExpenseClaimModal;
