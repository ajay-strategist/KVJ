import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export function ExpenseClaims() {
  const { toast } = useNotifications();
  const { user } = useAuth();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [bikeRate, setBikeRate] = useState(5.0);
  const [carRate, setCarRate] = useState(12.0);

  const sampleExpenses = [
    { id: '1', date: '01/06/26', person: 'Linto George', location: 'Christ Irinjalakkuda', category: 'Training Expense', type: 'Self Travel (Bike - 16km)', amount: 80.0, receipt: 'attached.pdf', batch: 'Christ 3BBA B1', status: 'submitted' },
    { id: '2', date: '01/06/26', person: 'Linto George', location: 'Christ Irinjalakkuda', category: 'Training Expense', type: 'Morning Tea', amount: 30.0, receipt: 'receipt1.jpg', batch: 'Christ 3BBA B1', status: 'submitted' },
    { id: '3', date: '02/06/26', person: 'Linto George', location: 'Office', category: 'Office Expense', type: 'Stationery & Printing', amount: 450.0, receipt: 'office_rec.pdf', batch: '—', status: 'approved' },
  ];

  const handleExpenseSubmit = async (values: Record<string, unknown>) => {
    toast({ variant: 'success', title: 'Claim Submitted', message: `Filed ${values.categoryType || 'expense'} claim.` });
    setExpenseOpen(false);
  };

  const handleBulkApprove = () => {
    toast({ variant: 'success', title: 'Bulk Approved', message: 'All selected expense claims authorized.' });
  };

  const isManagement = user?.role === 'ADMIN' || user?.role === 'CEO' || user?.role === 'MANAGER';

  return (
    <AppShell>
      <PageHeader
        title="Expense Claims & Reimbursements"
        subtitle="Submit Office or Training Expenses with Self-Travel KM calculations and bulk approvals"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {isManagement && (
              <Button variant="secondary" onClick={() => setRateModalOpen(true)}>⚙️ Set Car/Bike Rate per KM</Button>
            )}
            {isManagement && (
              <Button variant="secondary" onClick={handleBulkApprove}>Bulk Approve Claims</Button>
            )}
            <Button onClick={() => setExpenseOpen(true)}>Submit Expense Claim</Button>
          </div>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, alignItems: 'center' }}>
          <div>📍 Current Central Travel Rates (Set by CEO):</div>
          <div>🏍️ <strong>Bike: ₹{bikeRate} / KM</strong></div>
          <div>🚗 <strong>Car: ₹{carRate} / KM</strong></div>
        </div>
      </Card>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0F4C81', color: 'white' }}>
                <th style={{ padding: 8 }}>Date</th>
                <th style={{ padding: 8 }}>Person</th>
                <th style={{ padding: 8 }}>Category</th>
                <th style={{ padding: 8 }}>Expense Type</th>
                <th style={{ padding: 8 }}>Batch (If Training)</th>
                <th style={{ padding: 8 }}>Amount (₹)</th>
                <th style={{ padding: 8 }}>Receipt</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sampleExpenses.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{exp.date}</td>
                  <td style={{ padding: 8 }}>{exp.person}</td>
                  <td style={{ padding: 8 }}>
                    <span className={`kvj-badge kvj-badge--${exp.category.includes('Training') ? 'info' : 'neutral'}`}>{exp.category}</span>
                  </td>
                  <td style={{ padding: 8, fontWeight: 500 }}>{exp.type}</td>
                  <td style={{ padding: 8, color: 'var(--text-muted)' }}>{exp.batch}</td>
                  <td style={{ padding: 8, fontWeight: 700, color: 'var(--status-success)' }}>₹ {exp.amount.toFixed(2)}</td>
                  <td style={{ padding: 8, color: 'var(--brand)', textDecoration: 'underline' }}>📎 {exp.receipt}</td>
                  <td style={{ padding: 8 }}><span className={`kvj-badge kvj-badge--${exp.status === 'approved' ? 'success' : 'warning'}`}>{exp.status}</span></td>
                  <td style={{ padding: 8 }}>
                    {exp.status === 'submitted' && isManagement && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" onClick={() => toast({ variant: 'success', title: 'Claim Approved' })}>Accept</Button>
                        <Button size="sm" variant="danger" onClick={() => toast({ variant: 'warning', title: 'Claim Rejected' })}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Submit Expense Drawer */}
      <Drawer open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Submit Expense Claim">
        <Form initial={{ categoryType: 'Office', travelMode: 'Bike', km: 0 }} onSubmit={handleExpenseSubmit}>
          <SelectField
            name="categoryType"
            label="Expense Classification"
            options={[
              { value: 'Office', label: 'Office Expense' },
              { value: 'Training', label: 'Training Program Expense' },
            ]}
          />

          <SelectField
            name="batch"
            label="Select Training Batch (If Training)"
            options={[
              { value: 'None', label: 'None (Office Expense)' },
              { value: 'Christ 3BBA B1', label: 'Christ 3BBA Data Analytics B1' },
              { value: 'Vimala College B1', label: 'Vimala College Excel Expert B1' },
            ]}
          />

          <SelectField
            name="expenseType"
            label="Expense Type"
            options={[
              { value: 'Self Travel', label: 'Self Travel (Bike/Car KM Rate)' },
              { value: 'Morning Tea', label: 'Morning Tea' },
              { value: 'Lunch', label: 'Lunch' },
              { value: 'Evening Tea', label: 'Evening Tea' },
              { value: 'Dinner', label: 'Dinner' },
              { value: 'Misc', label: 'Miscellaneous' },
            ]}
          />

          <SelectField
            name="travelMode"
            label="Self Travel Mode (If Self Travel)"
            options={[
              { value: 'Bike', label: `Bike (₹${bikeRate}/km)` },
              { value: 'Car', label: `Car (₹${carRate}/km)` },
            ]}
          />
          <TextField name="km" label="Kilometers (KM) Travelled" placeholder="e.g. 16" />
          <TextField name="amount" label="Amount (₹) (If non-travel)" placeholder="e.g. 150.00" />
          <TextField name="notes" label="Notes / Location (e.g. Home to College)" />
          <TextField name="receipt" label="Attach Receipt URL / File" placeholder="https://..." />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button type="submit">Submit for Claim</Button>
          </div>
        </Form>
      </Drawer>

      {/* CEO Rate Config Modal */}
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
