import { useState, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useFinance } from '../hooks/useFinance';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField, DatePickerField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Asset } from '../finance.repository';
import type { Employee } from '../../employee/employee.repository';

export function AssetInventory() {
  const { assets, registerAsset, assignAsset, loading } = useFinance();
  const { toast } = useNotifications();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
    empService.listEmployees().then((res) => {
      if (res.ok) setEmployees(res.value);
    });
  }, []);

  const handleRegisterSubmit = async (values: Record<string, unknown>) => {
    const barcode = `QR-AST-${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await registerAsset({
      name: values.name as string,
      category: values.category as string,
      originalValue: Number(values.originalValue),
      barcodeQr: barcode,
      status: 'available',
      warrantyExpiry: values.warrantyExpiry as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Asset Registered', message: `${values.name} logged under QR: ${barcode}` });
      setRegisterOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const handleAssignSubmit = async (values: Record<string, unknown>) => {
    if (!selectedAssetId) return;
    const res = await assignAsset(selectedAssetId, values.employeeId as string);

    if (res.ok) {
      toast({ variant: 'success', title: 'Asset Assigned', message: `Hardware allocated to employee.` });
      setAssignOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const employeeName = (employeeId?: string) => {
    if (!employeeId) return 'In Storage';
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Assigned';
  };

  const columns: Column<Asset>[] = [
    { key: 'name', header: 'Asset Item', sortable: true, accessor: (a) => a.name },
    { key: 'category', header: 'Category', accessor: (a) => a.category },
    { key: 'qr', header: 'QR Barcode', accessor: (a) => a.barcodeQr },
    { key: 'value', header: 'Original Value', accessor: (a) => `$${a.originalValue}` },
    { key: 'assigned', header: 'Allocation Holder', render: (a) => employeeName(a.assignedEmployeeId) },
    { key: 'status', header: 'Status', render: (a) => (
      <span className={`kvj-badge kvj-badge--${a.status === 'assigned' ? 'success' : 'neutral'}`}>{a.status}</span>
    )},
    { key: 'action', header: 'Actions', render: (a) => (
      a.status === 'available' ? (
        <Button size="sm" onClick={() => { setSelectedAssetId(a.id); setAssignOpen(true); }}>Assign</Button>
      ) : null
    )},
  ];

  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <AppShell>
      <PageHeader
        title="Asset Inventory Master"
        subtitle="Manage company IT hardware, office furniture, license warranties, and checkout tracking"
        actions={<Button onClick={() => setRegisterOpen(true)}>Register Asset</Button>}
      />

      <DataTable columns={columns} rows={assets} rowKey={(a) => a.id} loading={loading} />

      <Drawer open={registerOpen} onClose={() => setRegisterOpen(false)} title="Register Company Asset">
        <Form initial={{ category: 'Hardware' }} onSubmit={handleRegisterSubmit}>
          <TextField name="name" label="Asset Description Name" placeholder="e.g. MacBook Pro M3" />
          <SelectField
            name="category"
            label="Asset Category"
            options={[
              { value: 'Hardware', label: 'Computer Hardware' },
              { value: 'Software', label: 'Software Licensing' },
              { value: 'Furniture', label: 'Office Infrastructure' },
            ]}
          />
          <TextField name="originalValue" label="Purchase Original Value ($)" placeholder="e.g. 1999" />
          <DatePickerField name="warrantyExpiry" label="Warranty Expiration Date" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Registration</Button>
          </div>
        </Form>
      </Drawer>

      <Drawer open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign / Checkout Asset">
        <Form initial={{}} onSubmit={handleAssignSubmit}>
          <SelectField name="employeeId" label="Select Employee Assignee" options={employeeOptions} />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="submit">Confirm Checkout</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default AssetInventory;
