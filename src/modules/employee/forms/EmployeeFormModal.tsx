import React, { useState, useEffect } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { Employee } from '../employee.repository';

export interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null; // If provided, Edit mode; otherwise Add mode
  employeesList: Employee[];  // Used to populate Reporting Supervisor dropdown
  onSave: (data: {
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
    designation: string;
    dateOfJoining: string;
    phone?: string;
    role: 'EMPLOYEE' | 'MANAGER' | 'CEO' | 'ADMIN';
    supervisorId?: string;
    status?: 'active' | 'on_notice' | 'relieved';
  }) => Promise<boolean>;
}

export function EmployeeFormModal({
  open,
  onClose,
  employee,
  employeesList,
  onSave,
}: EmployeeFormModalProps) {
  const { toast } = useNotifications();
  const isEdit = Boolean(employee);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('Senior Technical Trainer');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'MANAGER' | 'CEO' | 'ADMIN'>('EMPLOYEE');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'on_notice' | 'relieved'>('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (employee) {
        // Edit Mode
        setFirstName(employee.firstName || '');
        setLastName(employee.lastName || '');
        setEmail(employee.email || '');
        setEmployeeId(employee.employeeId || '');
        setDesignation(employee.designation || 'Senior Technical Trainer');
        setDateOfJoining(employee.dateOfJoining || new Date().toISOString().slice(0, 10));
        setPhone(employee.phone || '');
        setRole((employee.role as any) || 'EMPLOYEE');
        setSupervisorId((employee as any).supervisorId || '');
        setStatus((employee.status as any) || 'active');
      } else {
        // Add Mode: Auto-generate Employee ID
        const autoId = `EMP-${Math.floor(100 + Math.random() * 900)}`;
        setFirstName('');
        setLastName('');
        setEmail('');
        setEmployeeId(autoId);
        setDesignation('Senior Technical Trainer');
        setDateOfJoining(new Date().toISOString().slice(0, 10));
        setPhone('');
        setRole('EMPLOYEE');
        setSupervisorId('');
        setStatus('active');
      }
    }
  }, [open, employee]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: 'error', title: 'Name Required', message: 'First name and last name are required.' });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast({ variant: 'error', title: 'Valid Email Required', message: 'Please enter a valid company email address.' });
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        employeeId: employeeId.trim(),
        designation: designation.trim(),
        dateOfJoining,
        phone: phone.trim() || undefined,
        role,
        supervisorId: supervisorId || undefined,
        status: isEdit ? status : 'active',
      });

      if (ok) {
        onClose();
      }
    } catch (err: any) {
      console.error('Error saving employee:', err);
      toast({ variant: 'error', title: 'Save Failed', message: err?.message || 'Could not save employee.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `✏️ Edit Employee: ${employee?.firstName || ''} ${employee?.lastName || ''}` : '➕ Add New Employee'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="kvj-label">
              First Name <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul"
              className="kvj-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="kvj-label">
              Last Name <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Menon"
              className="kvj-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="kvj-label">
            Company Email Address <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="email"
            required
            placeholder="e.g. rahul.menon@kvjanalytics.com"
            className="kvj-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Auto-generated ID & Joining Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="kvj-label">
              Employee ID <span style={{ fontSize: 10, color: 'var(--primary-600)' }}>(Auto-Generated)</span>
            </label>
            <input
              type="text"
              required
              className="kvj-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-sunken)' }}
            />
          </div>
          <div>
            <label className="kvj-label">
              Joining Date <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="date"
              required
              className="kvj-input"
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Designation & Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="kvj-label">
              Designation <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Technical Trainer"
              className="kvj-input"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="kvj-label">Phone Number (Optional)</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              className="kvj-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* System Role */}
        <div>
          <label className="kvj-label">
            System Role <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <select
            className="kvj-select"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            style={{ width: '100%' }}
          >
            <option value="EMPLOYEE">Employee (Can also conduct Training)</option>
            <option value="MANAGER">Manager (Can also conduct Training)</option>
            <option value="CEO">CEO (Can also conduct Training)</option>
            <option value="ADMIN">Admin (System Administrator)</option>
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            ℹ️ All roles can take training batches and clock training sessions.
          </div>
        </div>

        {/* Reporting Supervisor (Optional) */}
        <div>
          <label className="kvj-label">Reporting Manager / Supervisor (Optional)</label>
          <select
            className="kvj-select"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">None / Self-Reporting</option>
            {employeesList
              .filter((emp) => !employee || emp.id !== employee.id)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.designation || emp.role})
                </option>
              ))}
          </select>
        </div>

        {/* Employment Status (In Edit Mode) */}
        {isEdit && (
          <div>
            <label className="kvj-label">Employment Status</label>
            <select
              className="kvj-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              style={{ width: '100%' }}
            >
              <option value="active">🟢 Active</option>
              <option value="on_notice">🟡 On Notice Period</option>
              <option value="relieved">🔴 Relieved / Resigned (Deactivates Access)</option>
            </select>
            {status === 'relieved' && (
              <div style={{ fontSize: 11, color: 'var(--status-danger, #dc2626)', marginTop: 4 }}>
                ⚠️ Marking as Relieved deactivates system login access for this user.
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Profile' : '➕ Save Employee'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default EmployeeFormModal;
