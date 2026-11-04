import React, { useState, useEffect, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { supabase } from '../../../shared/integration/supabase';
import type { TravelRate } from './TravelRatesModal';

export interface EditableExpense {
  id: string;
  date?: string;
  rawDate?: string;
  employee?: string;
  person?: string;
  category?: string;
  type?: string;
  batch?: string;
  notes?: string;
  route?: string;
  vehicle?: string;
  km?: number | string;
  amount: number;
  receipt?: string;
  status?: string;
  [key: string]: any;
}

export interface EditExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: EditableExpense | null;
  batches?: Array<any>;
  travelRates?: TravelRate[];
  bikeRate?: number;
  carRate?: number;
}

export function EditExpenseModal({
  open,
  onClose,
  onSuccess,
  expense,
  batches = [],
  travelRates,
  bikeRate = 3.0,
  carRate = 9.5,
}: EditExpenseModalProps) {
  const { toast } = useNotifications();
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [expenseDate, setExpenseDate] = useState<string>('');
  const [categoryType, setCategoryType] = useState<'Office Expense' | 'Training Expense'>('Office Expense');
  const [expenseType, setExpenseType] = useState<string>('Self Travel');
  const [batchName, setBatchName] = useState<string>('');
  const [vehicle, setVehicle] = useState<string>('Car');
  const [km, setKm] = useState<string>('');
  const [route, setRoute] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [status, setStatus] = useState<string>('approved');
  const [notes, setNotes] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');

  const isSelfTravel = expenseType === 'Self Travel';
  const isTraining = categoryType === 'Training Expense';

  const availableRates: TravelRate[] = useMemo(() => {
    if (travelRates && travelRates.length > 0) {
      return travelRates.map((r) => ({ ...r, ratePerKm: Number(r.ratePerKm) }));
    }
    return [
      { id: 'bike', name: 'Bike', ratePerKm: Number(bikeRate), icon: '🏍️' },
      { id: 'car', name: 'Car', ratePerKm: Number(carRate), icon: '🚗' },
    ];
  }, [travelRates, bikeRate, carRate]);

  const selectedRate = useMemo(() => {
    const match = availableRates.find((r) => r.name.toLowerCase() === vehicle.toLowerCase());
    if (match) return match.ratePerKm;
    return vehicle.toLowerCase() === 'bike' ? bikeRate : carRate;
  }, [vehicle, availableRates, bikeRate, carRate]);

  // Initialize form fields whenever modal opens with a selected expense
  useEffect(() => {
    if (!open || !expense) return;

    let initDate = '';
    if (expense.rawDate && /^\d{4}-\d{2}-\d{2}/.test(String(expense.rawDate))) {
      initDate = String(expense.rawDate).slice(0, 10);
    } else if (expense.date) {
      if (/^\d{4}-\d{2}-\d{2}/.test(expense.date)) {
        initDate = expense.date.slice(0, 10);
      } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(expense.date)) {
        const parts = expense.date.split(/[\/\-]/);
        if (parts.length === 3) {
          const d = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          const y = parts[2];
          initDate = `${y}-${m}-${d}`;
        }
      }
    }
    if (!initDate && expense.createdAt) {
      initDate = String(expense.createdAt).slice(0, 10);
    }
    if (!initDate) {
      initDate = new Date().toISOString().slice(0, 10);
    }

    setExpenseDate(initDate);
    setCategoryType(
      (expense.category || '').toLowerCase().includes('training')
        ? 'Training Expense'
        : 'Office Expense'
    );
    setExpenseType(expense.type || 'Self Travel');
    setBatchName(expense.batch && expense.batch !== '—' ? expense.batch : '');
    setVehicle(expense.vehicle || 'Car');
    setKm(expense.km !== undefined && expense.km !== null ? String(expense.km) : '');
    setRoute(expense.route || '');
    setAmount(expense.amount !== undefined ? String(expense.amount) : '');
    setStatus((expense.status || 'approved').toLowerCase());
    setNotes(expense.notes || '');
    setReceiptUrl(expense.receipt && expense.receipt !== 'No Receipt Attached' ? expense.receipt : '');
  }, [open, expense]);

  // Auto recalculate amount for Self Travel when KM or vehicle rate changes
  const handleKmChange = (val: string) => {
    setKm(val);
    const parsedKm = parseFloat(val);
    if (!isNaN(parsedKm) && parsedKm > 0) {
      const computed = Math.round(parsedKm * selectedRate);
      setAmount(String(computed));
    }
  };

  const handleVehicleChange = (newVeh: string) => {
    setVehicle(newVeh);
    const rateMatch = availableRates.find((r) => r.name.toLowerCase() === newVeh.toLowerCase());
    const rate = rateMatch ? rateMatch.ratePerKm : newVeh.toLowerCase() === 'bike' ? bikeRate : carRate;
    const parsedKm = parseFloat(km);
    if (!isNaN(parsedKm) && parsedKm > 0) {
      const computed = Math.round(parsedKm * rate);
      setAmount(String(computed));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense?.id) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      toast({ variant: 'error', title: 'Invalid Amount', message: 'Please enter a valid expense amount.' });
      return;
    }

    if (isTraining && !batchName.trim()) {
      toast({ variant: 'error', title: 'Batch Required', message: 'Please select or enter the training batch name.' });
      return;
    }

    setSubmitting(true);
    try {
      const personName = expense.employee || expense.person || 'Employee';
      const notesObj: Record<string, any> = {
        personName,
        expenseType,
        expenseDate,
        batchName: isTraining ? batchName.trim() : undefined,
        route: isSelfTravel ? route.trim() : undefined,
        vehicle: isSelfTravel ? vehicle : undefined,
        km: isSelfTravel && km ? Number(km) : undefined,
        rate: isSelfTravel ? selectedRate : undefined,
        userNotes: notes.trim(),
      };

      const updates: Record<string, any> = {
        amount: numericAmount,
        category: categoryType,
        status: status.toLowerCase(),
        notes: JSON.stringify(notesObj),
        updated_at: new Date().toISOString(),
      };

      if (expenseDate) {
        updates.created_at = `${expenseDate}T12:00:00Z`;
      }
      if (receiptUrl) {
        updates.receipt_url = receiptUrl.trim();
      }

      const { error } = await supabase
        .from('flwdsk_expense_claims')
        .update(updates)
        .eq('id', expense.id);

      if (error) {
        throw error;
      }

      // Update local storage fallback cache if present
      try {
        const stored = localStorage.getItem('kvj_expense_claims_v1');
        if (stored) {
          const list = JSON.parse(stored);
          const idx = list.findIndex((c: any) => c.id === expense.id);
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              amount: numericAmount,
              category: categoryType,
              status: status.toLowerCase(),
              notes: JSON.stringify(notesObj),
              date: expenseDate,
            };
            localStorage.setItem('kvj_expense_claims_v1', JSON.stringify(list));
          }
        }
      } catch (err) {
        void err;
      }

      toast({
        variant: 'success',
        title: 'Expense Claim Updated',
        message: `Expense claim for ${personName} (₹${numericAmount.toFixed(2)}) updated successfully.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating expense claim:', err);
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update expense claim.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !expense) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`✏️ Edit Expense Claim — ${expense.employee || expense.person || 'Claim'}`}
      size="md"
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            💾 Save Changes
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Employee Readonly Header */}
        <div
          style={{
            background: 'var(--bg-sunken)',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Employee
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {expense.employee || expense.person || 'Employee'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Claim ID
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {expense.id.slice(0, 13)}...
            </div>
          </div>
        </div>

        {/* Expense Date */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Expense Date <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="date"
            required
            className="kvj-input"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          />
        </div>

        {/* Classification */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Expense Classification <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <select
            className="kvj-select"
            value={categoryType}
            onChange={(e) => setCategoryType(e.target.value as any)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          >
            <option value="Office Expense">🏢 Office Expense</option>
            <option value="Training Expense">🎓 Training Expense (College Batch)</option>
          </select>
        </div>

        {/* Dynamic Batch Selector if Training Expense */}
        {isTraining && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              Training Batch <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              list="training-batches-list"
              required={isTraining}
              className="kvj-input"
              value={batchName}
              placeholder="Select or enter training batch..."
              onChange={(e) => setBatchName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            />
            <datalist id="training-batches-list">
              {batches.map((b: any, idx: number) => {
                const label = b.batchName || b.code || b.trainingName || b.name;
                return <option key={b.id || idx} value={label} />;
              })}
            </datalist>
          </div>
        )}

        {/* Expense Type */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Expense Type <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <select
            className="kvj-select"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          >
            <option value="Self Travel">🚗 Self Travel (KM Reimbursement)</option>
            <option value="Breakfast">🍳 Breakfast</option>
            <option value="Lunch & Refreshments">🍱 Lunch & Refreshments</option>
            <option value="Evening Tea">☕ Evening Tea</option>
            <option value="Dinner">🍽️ Dinner</option>
            <option value="Water">💧 Water / Beverage</option>
            <option value="Bus Travelling / Fare">🚌 Bus Travelling / Fare</option>
            <option value="Public Transport">🚆 Public Transport / Metro</option>
            <option value="Train Ticket">🎫 Train Ticket</option>
            <option value="Uber">🚕 Uber / Taxi</option>
            <option value="Auto">🛺 Auto Rickshaw</option>
            <option value="Stationery & Printing">📄 Stationery & Printing</option>
            <option value="Hotel / Accommodation">🏨 Hotel / Accommodation</option>
            <option value="Miscellaneous">📦 Miscellaneous</option>
          </select>
        </div>

        {/* Self Travel details */}
        {isSelfTravel && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 14,
              borderRadius: 8,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 6 }}>
              🚗 Travel Details & Rate Calculation
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Vehicle</label>
                <select
                  className="kvj-select"
                  value={vehicle}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                >
                  <option value="Car">🚗 Car (₹{carRate}/km)</option>
                  <option value="Bike">🏍️ Bike (₹{bikeRate}/km)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Distance (km)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="kvj-input"
                  value={km}
                  onChange={(e) => handleKmChange(e.target.value)}
                  placeholder="e.g. 84"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                Route Description
              </label>
              <input
                type="text"
                className="kvj-input"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. Home -> SJCET -> Home"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>
          </div>
        )}

        {/* Amount (₹) */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Claim Amount (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                color: 'var(--text-muted)',
              }}
            >
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              required
              className="kvj-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                width: '100%',
                padding: '8px 12px 8px 28px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--status-success)',
              }}
            />
          </div>
        </div>

        {/* Approval Status */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Claim Status <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <select
            className="kvj-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          >
            <option value="approved">✅ Approved</option>
            <option value="submitted">⏳ Submitted (Pending Review)</option>
            <option value="rejected">❌ Rejected</option>
            <option value="reimbursed">💸 Reimbursed / Paid</option>
          </select>
        </div>

        {/* Receipt URL / Link */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Receipt Link / URL
          </label>
          <input
            type="text"
            className="kvj-input"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="https://... or Google Drive receipt link"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          />
        </div>

        {/* Notes / Reason */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Notes / Description
          </label>
          <textarea
            rows={2}
            className="kvj-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details or justification..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', resize: 'vertical' }}
          />
        </div>
      </form>
    </Drawer>
  );
}
