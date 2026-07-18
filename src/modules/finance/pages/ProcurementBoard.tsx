import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useFinance } from '../hooks/useFinance';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Vendor, PurchaseOrder } from '../finance.repository';

export function ProcurementBoard() {
  const { vendors, purchaseOrders, createVendor, createPurchaseOrder, loading } = useFinance();
  const { toast } = useNotifications();

  const [vendorOpen, setVendorOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  const handleVendorSubmit = async (values: Record<string, unknown>) => {
    const res = await createVendor({
      name: values.name as string,
      category: values.category as string,
      contactPerson: values.contactPerson as string,
      email: values.email as string,
      phone: values.phone as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Vendor Registered', message: `${values.name} added successfully.` });
      setVendorOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handlePoSubmit = async (values: Record<string, unknown>) => {
    const res = await createPurchaseOrder({
      vendorId: values.vendorId as string,
      poNumber: values.poNumber as string,
      amount: Number(values.amount),
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'PO Generated', message: `Purchase Order ${values.poNumber} submitted.` });
      setPoOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const vendorName = (vendorId: string) => {
    const v = vendors.find((ve) => ve.id === vendorId);
    return v ? v.name : 'Unknown Vendor';
  };

  const vendorColumns: Column<Vendor>[] = [
    { key: 'name', header: 'Vendor Name', sortable: true, accessor: (v) => v.name },
    { key: 'category', header: 'Category', accessor: (v) => v.category },
    { key: 'contact', header: 'Contact Person', accessor: (v) => v.contactPerson },
    { key: 'email', header: 'Email Address', accessor: (v) => v.email },
  ];

  const poColumns: Column<PurchaseOrder>[] = [
    { key: 'poNumber', header: 'PO Number', sortable: true, accessor: (p) => p.poNumber },
    { key: 'vendor', header: 'Vendor Company', render: (p) => vendorName(p.vendorId) },
    { key: 'amount', header: 'PO Value Amount', accessor: (p) => `$${p.amount}` },
    { key: 'status', header: 'Approval Status', render: (p) => (
      <span className="kvj-badge kvj-badge--neutral">{p.status}</span>
    )},
  ];

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  const tabs = [
    { id: 'vendors', label: 'Vendor Registry', content: <DataTable columns={vendorColumns} rows={vendors} rowKey={(v) => v.id} loading={loading} /> },
    { id: 'pos', label: 'Purchase Orders', content: <DataTable columns={poColumns} rows={purchaseOrders} rowKey={(p) => p.id} loading={loading} /> },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Procurement & Vendor Portal"
        subtitle="Manage procurement purchase orders, quotations review, invoices, and vendor performance rosters"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setPoOpen(true)}>Generate PO</Button>
            <Button onClick={() => setVendorOpen(true)}>Register Vendor</Button>
          </div>
        }
      />

      <Tabs items={tabs} />

      {/* Register Vendor Drawer */}
      <Drawer open={vendorOpen} onClose={() => setVendorOpen(false)} title="Register Vendor Profile">
        <Form initial={{}} onSubmit={handleVendorSubmit}>
          <TextField name="name" label="Vendor Company Name" placeholder="e.g. Oracle Corp" />
          <TextField name="category" label="Category / Trade" placeholder="e.g. IT Software Licenses" />
          <TextField name="contactPerson" label="Representative Contact Person" />
          <TextField name="email" label="Contact Email Address" type="email" />
          <TextField name="phone" label="Contact Phone Number" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setVendorOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Vendor</Button>
          </div>
        </Form>
      </Drawer>

      {/* PO Drawer */}
      <Drawer open={poOpen} onClose={() => setPoOpen(false)} title="Generate Purchase Order">
        <Form initial={{}} onSubmit={handlePoSubmit}>
          <SelectField name="vendorId" label="Select Vendor Profile" options={vendorOptions} />
          <TextField name="poNumber" label="Purchase Order (PO) Identifier" placeholder="e.g. PO-2026-001" />
          <TextField name="amount" label="PO Value Amount ($)" placeholder="e.g. 5000.00" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setPoOpen(false)}>Cancel</Button>
            <Button type="submit">Submit PO</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ProcurementBoard;
