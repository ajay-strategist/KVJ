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

import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, useForm } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export interface ExpenseRecord {
  id: string;
  date: string;
  person: string;
  category: 'Office Expense' | 'Training Expense';
  type: string;
  batch?: string;
  vehicle?: 'Bike' | 'Car';
  km?: number;
  route?: string;
  amount: number;
  receipt?: string;
  status: 'submitted' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

function DynamicExpenseForm({
  bikeRate,
  carRate,
  onSubmit,
  onCancel,
}: {
  bikeRate: number;
  carRate: number;
  onSubmit: (vals: any) => void;
  onCancel: () => void;
}) {
  const { values } = useForm();
  const category = values.categoryType || 'Office Expense';
  const isSelfTravel = values.expenseType === 'Self Travel';
  const isTraining = category === 'Training Expense';

  const kmVal = Number(values.km || 0);
  const vehicle = values.vehicle || 'Bike';
  const rate = vehicle === 'Car' ? carRate : bikeRate;
  const calculatedAmount = isSelfTravel ? kmVal * rate : Number(values.amount || 0);

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
          options={[
            { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
            { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
            { value: 'Vimala College Batch 2', label: 'Vimala College Batch 2' },
          ]}
        />
      )}

      <SelectField
        name="expenseType"
        label="Expense Type *"
        options={[
          { value: 'Self Travel', label: 'Self Travel (Bike / Car KM Reimbursement)' },
          { value: 'Morning Tea', label: 'Morning Tea' },
          { value: 'Lunch & Refreshments', label: 'Lunch & Refreshments' },
          { value: 'Evening Tea', label: 'Evening Tea' },
          { value: 'Stationery & Printing', label: 'Stationery & Printing' },
          { value: 'Lab / System Supplies', label: 'Lab / System Supplies' },
          { value: 'Miscellaneous', label: 'Miscellaneous' },
        ]}
      />

      {isSelfTravel ? (
        <>
          <SelectField
            name="vehicle"
            label="Vehicle Type *"
            options={[
              { value: 'Bike', label: `Bike (₹${bikeRate} / KM)` },
              { value: 'Car', label: `Car (₹${carRate} / KM)` },
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
          <TextField name="receipt" label="Receipt Upload / Document Link *" placeholder="https://..." />
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
  const { user } = useAuth();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [bikeRate, setBikeRate] = useState(5.0);
  const [carRate, setCarRate] = useState(12.0);

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([
    { id: '1', date: '01/06/2026', person: 'Linto George', category: 'Training Expense', type: 'Self Travel', vehicle: 'Bike', km: 16, route: 'HQ to Christ College', amount: 80.0, batch: 'Christ 3BBA Data Analytics B1', status: 'approved', approvedBy: 'Manager Ops', approvedAt: '01/06/2026 05:00 PM' },
    { id: '2', date: '01/06/2026', person: 'Linto George', category: 'Training Expense', type: 'Morning Tea', amount: 30.0, receipt: 'receipt_tea.jpg', batch: 'Christ 3BBA Data Analytics B1', status: 'approved', approvedBy: 'Manager Ops', approvedAt: '01/06/2026 05:00 PM' },
    { id: '3', date: '02/06/2026', person: 'Linto George', category: 'Office Expense', type: 'Stationery & Printing', amount: 450.0, receipt: 'office_print.pdf', status: 'approved', approvedBy: 'Manager Ops', approvedAt: '02/06/2026 06:00 PM' },
    { id: '4', date: '24/06/2026', person: 'Linto George', category: 'Training Expense', type: 'Self Travel', vehicle: 'Car', km: 37.5, route: 'HQ to Vimala College', amount: 450.0, batch: 'Vimala College Batch 2', status: 'submitted' },
    { id: '5', date: '25/06/2026', person: 'Linto George', category: 'Office Expense', type: 'Self Travel', vehicle: 'Bike', km: 40, route: 'HQ to Govt Press', amount: 200.0, status: 'submitted' },
  ]);

  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(user?.role || '');

  const handleExpenseSubmit = (values: Record<string, unknown>) => {
    const isSelfTravel = values.expenseType === 'Self Travel';
    const km = Number(values.km || 0);
    const vehicle = (values.vehicle || 'Bike') as 'Bike' | 'Car';
    const rate = vehicle === 'Car' ? carRate : bikeRate;
    const amount = isSelfTravel ? km * rate : Number(values.amount || 0);

    const newExp: ExpenseRecord = {
      id: String(Date.now()),
      date: new Date().toLocaleDateString('en-GB'),
      person: user?.fullName || 'Linto George',
      category: (values.categoryType || 'Office Expense') as any,
      type: (values.expenseType as string) || 'Misc',
      batch: values.batch as string,
      vehicle: isSelfTravel ? vehicle : undefined,
      km: isSelfTravel ? km : undefined,
      route: values.route as string,
      amount,
      receipt: values.receipt as string,
      status: 'submitted',
    };

    setExpenses([newExp, ...expenses]);
    toast({ variant: 'success', title: 'Claim Filed', message: `Submitted ₹${amount.toFixed(2)} expense claim for review.` });
    setExpenseOpen(false);
  };

  const handleApprove = (id: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'approved',
              approvedBy: user?.fullName || 'Manager',
              approvedAt: new Date().toLocaleString(),
            }
          : e
      )
    );
    toast({ variant: 'success', title: 'Claim Approved', message: 'Expense claim authorized and locked.' });
  };

  const handleReject = (id: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'rejected' } : e)));
    toast({ variant: 'warning', title: 'Claim Rejected', message: 'Expense claim status updated to rejected.' });
  };

  const handleBulkApprove = () => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.status === 'submitted'
          ? {
              ...e,
              status: 'approved',
              approvedBy: user?.fullName || 'Manager',
              approvedAt: new Date().toLocaleString(),
            }
          : e
      )
    );
    toast({ variant: 'success', title: 'Bulk Approved', message: 'All pending expense claims authorized.' });
  };

  return (
    <AppShell>
      <PageHeader
        title="Expense Claims & Reimbursements"
        subtitle="Conditional expense filing, auto-calculated travel KM rates, and locked approval audit trails"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setRateModalOpen(true)}>⚙️ Travel Rates (KM)</Button>
            )}
            {isManagement && (
              <Button variant="secondary" onClick={handleBulkApprove}>Bulk Approve Claims</Button>
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
        <div style={{ overflowX: 'auto' }}>
          <table className="kvj-table">
            <thead>
              <tr>
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
              {expenses.map((exp) => {
                const isLocked = exp.status === 'approved';
                return (
                  <tr key={exp.id}>
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
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {exp.vehicle} · {exp.km} km @ ₹{exp.vehicle === 'Car' ? carRate : bikeRate}/km
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
                      {exp.receipt ? (
                        <a href={exp.receipt} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                          📎 View Receipt
                        </a>
                      ) : exp.type === 'Self Travel' ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>KM Auto-Calc</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--status-danger)' }}>Missing</span>
                      )}
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
                      {!isLocked && exp.status === 'submitted' && isManagement ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="xs" variant="success" onClick={() => handleApprove(exp.id)}>Approve</Button>
                          <Button size="xs" variant="danger" onClick={() => handleReject(exp.id)}>Reject</Button>
                        </div>
                      ) : isLocked ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          🔒 Locked
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
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
            <Button onClick={() => {
              toast({ variant: 'success', title: 'Rates Saved', message: 'Updated central travel KM reimbursement rates.' });
              setRateModalOpen(false);
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
