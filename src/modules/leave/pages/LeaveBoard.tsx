import { useState, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, StatCard, Button, Avatar, Badge } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useLeave } from '../hooks/useLeave';
import { useEmployee } from '../../employee/hooks/useEmployee';
import { Form, SelectField, DatePickerField, TextAreaField, CheckboxField, FileUploadField } from '../../../shared/forms/form';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { businessRules } from '../../../config/business-rules';
import Drawer from '../../../shared/ui/Drawer';
import type { LeaveRecord } from '../leave.repository';
import { googleIntegration, getMonthlyFolderName } from '../../../shared/integration/google';

function formatLeaveDates(startDate: string, endDate: string, halfDay?: boolean): string {
  if (!startDate) return '—';
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);

  if (halfDay) {
    return `${startFormatted} (Half Day)`;
  }
  if (!endDate || startDate === endDate) {
    return startFormatted;
  }
  return `${startFormatted} to ${endFormatted}`;
}

function LeaveStatCard({ label, value, tone = 'progress', icon }: { label: string; value: number; tone?: string; icon: string }) {
  return (
    <Card style={{ padding: '14px 18px', width: 220, flex: '0 0 220px' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span
          className={`kvj-badge kvj-badge--${tone}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {label}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LeaveBoard() {
  const { leaves, allLeaves, applyLeave, approveLeave, rejectLeave, cancelLeave, uploadMedicalCertificate, loading, refreshAll, refreshMyLeaves } = useLeave();
  const { employees } = useEmployee();
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const [applyOpen, setApplyOpen] = useState(false);
  const [uploadCertOpen, setUploadCertOpen] = useState(false);
  const [uploadTargetLeave, setUploadTargetLeave] = useState<LeaveRecord | null>(null);

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleApplySubmit = async (values: Record<string, unknown>) => {
    const ok = await confirm({
      title: 'Submit Leave Application?',
      message: 'Are you sure you want to submit this leave request?',
    });
    if (!ok) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const start = (values.startDate as string) || todayStr;
    const end = (values.endDate as string) || start;

    // End date cannot be before the start date (impossible leave range).
    if (end < start) {
      toast({ variant: 'error', title: 'Invalid Dates', message: 'The leave end date cannot be before the start date.' });
      return;
    }

    let certName = values.medCert ? (values.medCert as any).name : undefined;

    if (values.medCert) {
      try {
        const fileObj = values.medCert instanceof File ? values.medCert : (values.medCert as any).file instanceof File ? (values.medCert as any).file : null;
        let base64Content = '';
        if (fileObj) {
          try {
            base64Content = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = reader.result as string;
                resolve(res.includes(',') ? res.split(',')[1] : res);
              };
              reader.onerror = () => resolve('');
              reader.readAsDataURL(fileObj);
            });
          } catch (e) {}
        }

        const driveRes = await googleIntegration.uploadMedicalCertificateWithMetadata({
          date: start,
          employeeName: user?.fullName || 'Employee',
          leaveType: (values.leaveType as string) || 'Leave',
          startDate: start,
          endDate: end,
          originalFileName: (values.medCert as any).name || 'medical_cert.pdf',
          mimeType: fileObj?.type || 'application/pdf',
          base64Content,
          uploadedBy: user?.fullName || 'Employee',
        });
        if (driveRes && driveRes.googleDriveViewUrl) {
          certName = driveRes.googleDriveViewUrl;
        }
      } catch (e) {
        console.warn('Google Drive medical cert upload warning:', e);
      }
    }

    const res = await applyLeave(
      (values.leaveType as string) || 'Leave',
      start,
      end,
      (values.reason as string) || 'Leave application',
      !!values.halfDay,
      certName
    );

    if (res.ok) {
      toast({
        variant: 'success',
        title: 'Leave Applied & Cert Uploaded',
        message: values.medCert
          ? `Submitted application. Medical certificate saved in Google Drive: Office/Flow Desk/Medical Certificates/${getMonthlyFolderName(start)}.`
          : 'Your leave application has been submitted successfully.',
      });
      setApplyOpen(false);
    } else {
      toast({ variant: 'error', title: 'Application Failed', message: res.error });
    }
  };

  const columns = useMemo<Column<LeaveRecord>[]>(() => {
    const list: Column<LeaveRecord>[] = [];
    if (isMgmt) {
      list.push({
        key: 'employee',
        header: 'Employee',
        render: (r) => {
          const emp = (employees || []).find((e) => e.id === r.employeeId);
          const name = emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId || 'Unknown';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <Avatar name={name} size={24} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            </div>
          );
        }
      });
    }
    list.push(
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        accessor: (r) => r.leaveType,
      },
      {
        key: 'dates',
        header: 'Duration',
        render: (r) => (
          <div style={{ whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-primary)', fontSize: 12.5 }}>
            🗓️ {formatLeaveDates(r.startDate, r.endDate, r.halfDay)}
          </div>
        ),
      },
      {
        key: 'reason',
        header: 'Reason',
        accessor: (r) => r.reason,
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) => {
          const tone = r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger';
          const label = r.status === 'approved' ? 'Approved' : r.status === 'pending' ? 'Pending' : 'Rejected';
          return <Badge tone={tone}>{label}</Badge>;
        },
      },
      {
        key: 'medicalCert',
        header: 'Medical Cert',
        render: (r) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {r.medicalCertUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <a
                  href={r.medicalCertUrl && r.medicalCertUrl.includes('http') ? r.medicalCertUrl : '#'}
                  target={r.medicalCertUrl && r.medicalCertUrl.includes('http') ? '_blank' : undefined}
                  rel={r.medicalCertUrl && r.medicalCertUrl.includes('http') ? 'noopener noreferrer' : undefined}
                  title={r.medicalCertUrl}
                  onClick={(e) => {
                    if (!r.medicalCertUrl || !r.medicalCertUrl.includes('http')) {
                      e.preventDefault();
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#059669',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    padding: '3px 8px',
                    borderRadius: 6,
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                  }}
                >
                  📄 {r.medicalCertUrl && r.medicalCertUrl.includes('http') ? 'View Certificate' : (r.medicalCertUrl ? r.medicalCertUrl.replace(/^.*?_MedicalCert_/i, '') : '') || 'Certificate'}
                </a>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadTargetLeave(r);
                    setUploadCertOpen(true);
                  }}
                >
                  ✏️ Change
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadTargetLeave(r);
                  setUploadCertOpen(true);
                }}
              >
                📤 Upload Cert
              </Button>
            )}
          </div>
        ),
      },
      {
        key: 'approver',
        header: 'Details',
        render: (r) => (
          <div style={{ fontSize: 12, color: r.approverNotes ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {r.approverNotes ? r.approverNotes : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No notes</span>}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (r) => {
          const isOwner = r.employeeId === user?.id;
          const todayStr = new Date().toISOString().slice(0, 10);
          const targetEndDate = r.endDate || r.startDate || '';
          const isDatePassed = targetEndDate < todayStr;
          const canCancel = (r.status === 'pending' || r.status === 'approved') && (isMgmt || (isOwner && !isDatePassed));

          const handleCancel = async (e: React.MouseEvent) => {
            e.stopPropagation();
            const ok = await confirm({
              title: 'Cancel Leave Request?',
              message: 'Are you sure you want to cancel this leave application?',
            });
            if (!ok) return;
            const res = await cancelLeave(r.id, 'Cancelled by user');
            if (res && res.ok) {
              toast({ variant: 'info', title: 'Leave Cancelled', message: `Leave for ${r.startDate} has been cancelled.` });
              refreshAll(); refreshMyLeaves();
            } else {
              toast({ variant: 'error', title: 'Error', message: 'Could not cancel leave.' });
            }
          };

          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isMgmt && r.status === 'pending' && (
                <>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const res = await approveLeave(r.id, 'Approved via Leave Board');
                      if (res && res.ok) {
                        toast({ variant: 'success', title: 'Leave Approved', message: `Leave for ${r.startDate} has been approved.` });
                        refreshAll(); refreshMyLeaves();
                      } else {
                        toast({ variant: 'error', title: 'Error', message: 'Could not approve leave.' });
                      }
                    }}
                  >
                    ✓ Approve
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const res = await rejectLeave(r.id, 'Rejected via Leave Board');
                      if (res && res.ok) {
                        toast({ variant: 'error', title: 'Leave Rejected', message: `Leave for ${r.startDate} has been rejected.` });
                        refreshAll(); refreshMyLeaves();
                      } else {
                        toast({ variant: 'error', title: 'Error', message: 'Could not reject leave.' });
                      }
                    }}
                  >
                    ✕ Reject
                  </Button>
                </>
              )}

              {(!isMgmt || r.status !== 'pending') && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: r.status === 'approved' ? '#166534' : r.status === 'rejected' ? '#991b1b' : r.status === 'cancelled' ? '#6b7280' : '#b45309',
                    background: r.status === 'approved' ? '#f0fdf4' : r.status === 'rejected' ? '#fef2f2' : r.status === 'cancelled' ? '#f3f4f6' : '#fffbeb',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: `1px solid ${r.status === 'approved' ? '#bbf7d0' : r.status === 'rejected' ? '#fecaca' : r.status === 'cancelled' ? '#e5e7eb' : '#fde68a'}`,
                  }}
                >
                  {r.status === 'approved' ? '✓ Approved' : r.status === 'rejected' ? '✕ Rejected' : r.status === 'cancelled' ? '🚫 Cancelled' : '⏳ Pending'}
                </span>
              )}

              {canCancel && (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={handleCancel}
                  style={{ color: '#dc2626' }}
                >
                  🚫 Cancel
                </Button>
              )}
            </div>
          );
        },
      }
    );
    return list;
  }, [isMgmt, employees, user, approveLeave, rejectLeave, cancelLeave, confirm, toast, refreshAll, refreshMyLeaves]);

  // Exactly two leave types.
  const leaveTypes = businessRules.leave.types.map((t) => ({ value: t, label: t }));

  const filteredLeaves = useMemo(() => {
    let base: typeof leaves = [];
    if (!isMgmt) {
      base = Array.isArray(leaves) ? leaves : [];
    } else {
      const safeAll = Array.isArray(allLeaves) ? allLeaves : [];
      if (selectedEmployee === 'all') {
        base = safeAll;
      } else if (selectedEmployee === 'me') {
        base = Array.isArray(leaves) ? leaves : [];
      } else {
        base = safeAll.filter((l) => l.employeeId === selectedEmployee);
      }
    }
    if (statusFilter !== 'all') {
      base = base.filter((l) => l.status === statusFilter);
    }
    return base.slice().sort((a, b) => (b.startDate || b.createdAt || '').localeCompare(a.startDate || a.createdAt || ''));
  }, [leaves, allLeaves, selectedEmployee, isMgmt, statusFilter]);

  const safeLeavesListForStats = isMgmt ? (Array.isArray(allLeaves) ? allLeaves : []) : (Array.isArray(leaves) ? leaves : []);
  const pendingCount = safeLeavesListForStats.filter((l) => l && l.status === 'pending').length;
  const approvedCount = safeLeavesListForStats.filter((l) => l && l.status === 'approved').length;

  return (
    <AppShell>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, check balances, and view records"
        actions={<Button onClick={() => setApplyOpen(true)}>Request Leave</Button>}
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <LeaveStatCard label="Pending Applications" value={pendingCount} tone="warning" icon="⚑" />
        <LeaveStatCard label="Approved Leaves" value={approvedCount} tone="success" icon="✓" />
        <LeaveStatCard label="Total Leaves Taken" value={approvedCount} icon="🗓" />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {isMgmt ? 'Employee Leave History' : 'My Leave History'}
        </h2>

        {isMgmt && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--bg-panel)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 10px)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>👤 Employee:</span>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: 180,
                  cursor: 'pointer',
                }}
              >
                <option value="all">👥 All Employees</option>
                <option value="me">Me ({user?.fullName || 'Personal'})</option>
                {(employees || []).filter((e) => e.id !== user?.id).map((e) => {
                  const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
                  return <option key={e.id} value={e.id}>{name}</option>;
                })}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>📊 Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: 140,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="rejected">❌ Rejected</option>
                <option value="cancelled">🚫 Cancelled</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filteredLeaves}
        rowKey={(r) => r.id}
        loading={loading}
        maxHeight={380}
        pageSize={20}
      />

      {/* Apply Leave Drawer */}
      <Drawer open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave">
        <Form initial={{ leaveType: 'Leave', startDate: '', endDate: '', reason: '', halfDay: false }} onSubmit={handleApplySubmit}>
          <SelectField name="leaveType" label="Leave Type" options={leaveTypes} />
          <DatePickerField name="startDate" label="Start Date" />
          <DatePickerField name="endDate" label="End Date" />
          <CheckboxField name="halfDay" label="Apply for Half Day" />
          <FileUploadField name="medCert" label="Medical Certificate (Optional upfront; can be uploaded after leave)" accept=".pdf,.png,.jpg" />
          <TextAreaField name="reason" label="Reason for Leave" />
          
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </Form>
      </Drawer>

      {/* Upload Post-Leave Medical Certificate Drawer */}
      {uploadCertOpen && uploadTargetLeave && (
        <Drawer
          open={true}
          onClose={() => { setUploadCertOpen(false); setUploadTargetLeave(null); }}
          title="Upload Medical Certificate"
        >
          <Form
            initial={{}}
            onSubmit={async (values) => {
              if (!values.medCert) {
                toast({ variant: 'error', title: 'File Required', message: 'Please select a medical certificate file to upload.' });
                return;
              }
              const originalFileName = (values.medCert as any).name || 'medical_certificate.pdf';
              let certName = originalFileName;
              const targetFolder = `Office/Flow Desk/Medical Certificates/${getMonthlyFolderName(uploadTargetLeave.startDate)}`;

              try {
                const fileObj = values.medCert instanceof File ? values.medCert : (values.medCert as any).file instanceof File ? (values.medCert as any).file : null;
                let base64Content = '';
                if (fileObj) {
                  try {
                    base64Content = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const res = reader.result as string;
                        resolve(res.includes(',') ? res.split(',')[1] : res);
                      };
                      reader.onerror = () => resolve('');
                      reader.readAsDataURL(fileObj);
                    });
                  } catch (e) {}
                }

                const driveRes = await googleIntegration.uploadMedicalCertificateWithMetadata({
                  date: uploadTargetLeave.startDate,
                  employeeName: user?.fullName || 'Employee',
                  leaveType: uploadTargetLeave.leaveType,
                  startDate: uploadTargetLeave.startDate,
                  endDate: uploadTargetLeave.endDate,
                  originalFileName,
                  mimeType: fileObj?.type || 'application/pdf',
                  base64Content,
                  uploadedBy: user?.fullName || 'Employee',
                });
                if (driveRes && driveRes.googleDriveViewUrl) {
                  certName = driveRes.googleDriveViewUrl;
                }
              } catch (e) {
                console.warn('Google Drive medical cert upload warning:', e);
              }

              const res = await uploadMedicalCertificate(uploadTargetLeave.id, certName);
              if (res.ok) {
                toast({
                  variant: 'success',
                  title: 'Certificate Uploaded to Google Drive',
                  message: `Medical certificate attached to leave record & saved in Google Drive: ${targetFolder}.`,
                });
                setUploadCertOpen(false);
                setUploadTargetLeave(null);
              } else {
                toast({ variant: 'error', title: 'Upload Failed', message: res.error });
              }
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Attaching medical certificate for Medical Leave: <strong>{uploadTargetLeave.startDate} to {uploadTargetLeave.endDate}</strong>
            </div>
            <FileUploadField name="medCert" label="Select Medical Certificate (.pdf, .jpg, .png)" accept=".pdf,.png,.jpg" />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => { setUploadCertOpen(false); setUploadTargetLeave(null); }}>Cancel</Button>
              <Button type="submit">Upload Certificate</Button>
            </div>
          </Form>
        </Drawer>
      )}
    </AppShell>
  );
}
export default LeaveBoard;
