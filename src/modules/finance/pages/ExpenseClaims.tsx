import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useFinance } from '../hooks/useFinance';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import type { ExpenseClaim, TravelRequest } from '../finance.repository';

export function ExpenseClaims() {
  const { expenseClaims, travelRequests, createExpenseClaim, approveExpenseClaim, createTravelRequest, loading } = useFinance();
  const { toast } = useNotifications();
  const { user } = useAuth();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);

  const handleExpenseSubmit = async (values: Record<string, unknown>) => {
    if (!user) return;
    const res = await createExpenseClaim({
      employeeId: user.id,
      category: values.category as string,
      amount: Number(values.amount),
      notes: values.notes as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Claim Submitted', message: `Filed $${values.amount} under ${values.category}` });
      setExpenseOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleTravelSubmit = async (values: Record<string, unknown>) => {
    if (!user) return;
    const res = await createTravelRequest({
      employeeId: user.id,
      destination: values.destination as string,
      startDate: values.startDate as string,
      endDate: values.endDate as string,
      advanceRequested: Number(values.advanceRequested) || 0.00,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Request Submitted', message: `Filed request to ${values.destination}` });
      setTravelOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleApproveClaim = async (id: string) => {
    const res = await approveExpenseClaim(id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Claim Approved', message: `Reimbursement authorized.` });
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const expenseColumns: Column<ExpenseClaim>[] = [
    { key: 'category', header: 'Category', sortable: true, accessor: (c) => c.category },
    { key: 'amount', header: 'Reimbursement Amount', accessor: (c) => `$${c.amount}` },
    { key: 'notes', header: 'Description Notes', accessor: (c) => c.notes ?? 'N/A' },
    { key: 'status', header: 'Status', render: (c) => (
      <span className={`kvj-badge kvj-badge--${c.status === 'approved' ? 'success' : 'neutral'}`}>{c.status}</span>
    )},
    { key: 'action', header: 'Actions', render: (c) => (
      c.status === 'submitted' && (user?.role === 'OPERATIONS_MANAGER' || user?.role === 'SUPER_ADMIN') ? (
        <Button size="sm" onClick={() => handleApproveClaim(c.id)}>Approve</Button>
      ) : null
    )},
  ];

  const travelColumns: Column<TravelRequest>[] = [
    { key: 'destination', header: 'Destination City', sortable: true, accessor: (t) => t.destination },
    { key: 'dates', header: 'Dates', render: (t) => `${t.startDate} to ${t.endDate}` },
    { key: 'advance', header: 'Advance Cash Requested', render: (t) => `$${t.advanceRequested ?? 0.00}` },
    { key: 'status', header: 'Status', render: (t) => (
      <span className="kvj-badge kvj-badge--neutral">{t.status}</span>
    )},
  ];

  const tabs = [
    { id: 'expenses', label: 'Reimbursement Claims', content: <DataTable columns={expenseColumns} rows={expenseClaims} rowKey={(c) => c.id} loading={loading} /> },
    { id: 'travel', label: 'Travel Itineraries', content: <DataTable columns={travelColumns} rows={travelRequests} rowKey={(t) => t.id} loading={loading} /> },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Expenses & Business Travel"
        subtitle="Manage business expense claims, receipts attachments, per diem limits, and travel booking requests"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setTravelOpen(true)}>Book Travel Request</Button>
            <Button onClick={() => setExpenseOpen(true)}>Submit Expense Claim</Button>
          </div>
        }
      />

      <Tabs items={tabs} />

      {/* Expense Claim Drawer */}
      <Drawer open={expenseOpen} onClose={() => setExpenseOpen(false)} title="File Expense Claim">
        <Form initial={{ category: 'meals' }} onSubmit={handleExpenseSubmit}>
          <SelectField
            name="category"
            label="Expense Category"
            options={[
              { value: 'travel', label: 'Travel Fare' },
              { value: 'meals', label: 'Meals' },
              { value: 'accommodation', label: 'Hotel & Accommodations' },
              { value: 'mileage', label: 'Mileage / Gas' },
              { value: 'miscellaneous', label: 'Miscellaneous' },
            ]}
          />
          <TextField name="amount" label="Claim Amount ($)" placeholder="e.g. 75.00" />
          <TextAreaField name="notes" label="Business Rationale & Description" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button type="submit">File Claim</Button>
          </div>
        </Form>
      </Drawer>

      {/* Travel Itinerary Drawer */}
      <Drawer open={travelOpen} onClose={() => setTravelOpen(false)} title="Request Travel Booking & Advance Cash">
        <Form initial={{}} onSubmit={handleTravelSubmit}>
          <TextField name="destination" label="Destination City / Country" placeholder="e.g. New York, USA" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField name="startDate" label="Departure Date" />
            <DatePickerField name="endDate" label="Return Date" />
          </div>
          <TextField name="advanceRequested" label="Advance cash requested ($)" placeholder="e.g. 500" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setTravelOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ExpenseClaims;
