import { useState, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, StatCard, Button } from '../../../shared/ui/components';
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

export function LeaveBoard() {
  const { leaves, allLeaves, applyLeave, approveLeave, rejectLeave, uploadMedicalCertificate, loading, refreshAll, refreshMyLeaves } = useLeave();
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
        if (driveRes && driveRes.storedFileName) {
          certName = driveRes.storedFileName;
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
          return emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId || 'Unknown';
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
        render: (r) => `${r.startDate} to ${r.endDate}${r.halfDay ? ' (Half Day)' : ''}`,
      },
      {
        key: 'reason',
        header: 'Reason',
        accessor: (r) => r.reason,
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) => (
          <span
            className={`kvj-badge kvj-badge--${
              r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'
            }`}
          >
            {r.status}
          </span>
        ),
      },
      {
        key: 'medicalCert',
        header: 'Medical Cert',
        render: (r) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {r.medicalCertUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--status-success)', fontWeight: 600 }}>
                  📎 {r.medicalCertUrl}
                </span>
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
        render: (r) => r.approverNotes ? `Notes: ${r.approverNotes}` : 'No notes.',
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (r) => {
          if (!isMgmt || r.status !== 'pending') return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.status === 'approved' ? '✅ Approved' : r.status === 'rejected' ? '❌ Rejected' : '—'}</span>;
          return (
            <div style={{ display: 'flex', gap: 6 }}>
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
                ✅ Approve
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
                ❌ Reject
              </Button>
            </div>
          );
        },
      }
    );
    return list;
  }, [isMgmt, employees, approveLeave, rejectLeave, toast, refreshAll, refreshMyLeaves]);

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
    return base;
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Pending Applications" value={pendingCount} tone="warning" icon="⚑" />
        <StatCard label="Approved Leaves" value={approvedCount} tone="success" icon="✓" />
        <StatCard label="Total Leaves Taken" value={approvedCount} icon="🗓" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ margin: 0 }}>
          <SectionHeader title={isMgmt ? "Employee Leave History" : "My Leave History"} />
        </div>
      {isMgmt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>👤 Employee:</span>
            <select
              className="kvj-select"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 180 }}
            >
              <option value="all">👥 All Employees</option>
              <option value="me">Me ({user?.fullName || 'Personal'})</option>
              {(employees || []).filter(e => e.id !== user?.id).map((e) => {
                const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
                return <option key={e.id} value={e.id}>{name}</option>;
              })}
            </select>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 8 }}>📊 Status:</span>
            <select
              className="kvj-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 140 }}
            >
              <option value="all">All Status</option>
              <option value="pending">⏳ Pending</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
            </select>
          </div>
        )}
      </div>

      <DataTable columns={columns} rows={filteredLeaves} rowKey={(r) => r.id} loading={loading} />

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
                if (driveRes && driveRes.storedFileName) {
                  certName = driveRes.storedFileName;
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
