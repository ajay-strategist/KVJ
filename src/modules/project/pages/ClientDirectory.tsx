import { useState } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useProject } from '../hooks/useProject';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, TextAreaField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Client } from '../project.repository';

export function ClientDirectory() {
  const { clients, createClient, loading } = useProject();
  const { toast } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    const res = await createClient({
      name: values.name as string,
      email: values.email as string,
      phone: values.phone as string || undefined,
      contactPerson: values.contactPerson as string,
      notes: values.notes as string || undefined,
    });

    if (res.ok) {
      toast({ variant: 'success', title: 'Client Created', message: `${values.name} added to master directory.` });
      setOpen(false);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error });
    }
  };

  const columns: Column<Client>[] = [
    { key: 'name', header: 'Client Company', sortable: true, accessor: (c) => c.name },
    { key: 'contact', header: 'Contact Person', sortable: true, accessor: (c) => c.contactPerson },
    { key: 'email', header: 'Email Address', accessor: (c) => c.email },
    { key: 'phone', header: 'Phone Number', accessor: (c) => c.phone ?? 'N/A' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Client Master Directory"
        subtitle="Manage client information, profile links, communication logs, and associated projects"
        actions={<Button onClick={() => setOpen(true)}>Add Client Account</Button>}
      />

      <DataTable columns={columns} rows={clients} rowKey={(c) => c.id} loading={loading} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Add Client Account Profile">
        <Form initial={{}} onSubmit={handleCreateSubmit}>
          <TextField name="name" label="Company / Client Name" placeholder="e.g. Acme Corp" />
          <TextField name="contactPerson" label="Primary Contact Person" placeholder="e.g. John Doe" />
          <TextField name="email" label="Contact Email Address" type="email" />
          <TextField name="phone" label="Contact Phone Number" />
          <TextAreaField name="notes" label="Account Notes & Profile Details" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Client</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}
export default ClientDirectory;
