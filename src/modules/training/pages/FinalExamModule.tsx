import { useState, useMemo, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge, SearchInput } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../../shared/integration/supabase';

export interface ExamRecord {
  id: string;
  studentName: string;
  phone: string;
  email: string;
  college: string;
  batch: string;
  attendancePct: number;
  voucherCode?: string;
  voucherStatus: 'Unassigned' | 'Assigned' | 'Redeemed' | 'Expired';
  originalScore?: number;
  retestScore?: number;
  finalScore?: number;
  isRetestEligible?: boolean;
  retestStatus?: 'None' | 'Pending' | 'Completed';
  certificateEligible: boolean;
}

export function FinalExamModule() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const [records, setRecords] = useState<ExamRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterVoucher, setFilterVoucher] = useState('all');

  const [marksDrawerOpen, setMarksDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExamRecord | null>(null);

  const [bulkVoucherOpen, setBulkVoucherOpen] = useState(false);

  // History Drawer State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyStudentName, setHistoryStudentName] = useState('');
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<any[]>([]);
  const [selectedStudentEmailLogs, setSelectedStudentEmailLogs] = useState<any[]>([]);
  const [selectedStudentVouchers, setSelectedStudentVouchers] = useState<any[]>([]);
  const [selectedStudentAudits, setSelectedStudentAudits] = useState<any[]>([]);

  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(user?.role || '');

  // Load student records, vouchers, and attempts
  const loadStudents = async () => {
    try {
      const { data: dbStudents, error } = await supabase
        .from('flwdsk_student_records')
        .select('*')
        .is('deleted_at', null);

      if (error) {
        console.warn('Failed to load students for final exams:', error.message);
        return;
      }

      const { data: dbVouchers } = await supabase.from('flwdsk_vouchers').select('*');
      const { data: dbAttempts } = await supabase.from('flwdsk_exam_attempts').select('*');

      if (dbStudents && dbStudents.length > 0) {
        const mapped: ExamRecord[] = dbStudents.map((s: any) => {
          const fields = s.custom_fields || {};
          
          const studentAttempts = dbAttempts?.filter(a => a.student_id === s.id) || [];
          const scores = studentAttempts.map(a => a.mark);
          
          // Initial vs Retest scores
          const initialAttempts = studentAttempts.filter(a => a.attempt_type === 'Initial');
          const retestAttempts = studentAttempts.filter(a => a.attempt_type === 'Retest');
          
          const orig = initialAttempts.length > 0 ? Math.max(...initialAttempts.map(a => a.mark)) : (fields.originalScore ?? fields.ass1 ?? 0);
          const retest = retestAttempts.length > 0 ? Math.max(...retestAttempts.map(a => a.mark)) : fields.retestScore;
          
          const finalScore = studentAttempts.length > 0 ? Math.max(...scores) : (fields.finalExam ?? 0);
          
          const initialV = dbVouchers?.find(v => v.student_id === s.id && v.voucher_type === 'Initial');
          const retestV = dbVouchers?.find(v => v.student_id === s.id && v.voucher_type === 'Retest');

          const attPct = fields.attendancePct ?? 85;
          const passMark = 50;

          return {
            id: s.id,
            studentName: s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.fullName || s.name || 'Student',
            phone: s.phone || '',
            email: s.email || '',
            college: fields.college || 'Christ College',
            batch: fields.department || 'BBA',
            attendancePct: attPct,
            voucherCode: initialV?.voucher_code || fields.voucherId || '',
            voucherStatus: (initialV?.status || fields.voucherStatus || 'Unassigned') as any,
            originalScore: orig,
            retestScore: retest,
            finalScore: finalScore,
            isRetestEligible: finalScore < passMark,
            retestStatus: retestV ? 'Pending' : (retest !== undefined ? 'Completed' : 'None'),
            certificateEligible: finalScore >= passMark && attPct >= 80,
          };
        });
        setRecords(mapped);
      }
    } catch (e) {
      console.warn('Failed to load students for final exams:', e);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudentHistory = async (record: ExamRecord) => {
    setHistoryStudentName(record.studentName);
    try {
      const { data: attempts } = await supabase
        .from('flwdsk_exam_attempts')
        .select('*')
        .eq('student_id', record.id)
        .order('created_at', { ascending: false });

      const { data: emails } = await supabase
        .from('flwdsk_email_logs')
        .select('*')
        .eq('student_id', record.id)
        .order('created_at', { ascending: false });

      const { data: vouchers } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('student_id', record.id)
        .order('assigned_date', { ascending: false });

      const { data: audits } = await supabase
        .from('flwdsk_audit_logs')
        .select('*')
        .eq('entity_id', record.id)
        .order('created_at', { ascending: false });

      setSelectedStudentHistory(attempts || []);
      setSelectedStudentEmailLogs(emails || []);
      setSelectedStudentVouchers(vouchers || []);
      setSelectedStudentAudits(audits || []);
      setHistoryDrawerOpen(true);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const syncRecordToDb = async (r: ExamRecord) => {
    try {
      const { data: current } = await supabase
        .from('flwdsk_student_records')
        .select('custom_fields')
        .eq('id', r.id)
        .single();
      
      const currentFields = current?.custom_fields || {};
      const updatedFields = {
        ...currentFields,
        originalScore: r.originalScore,
        retestScore: r.retestScore,
        finalExam: r.finalScore,
        voucherId: r.voucherCode,
        voucherStatus: r.voucherStatus,
        certificateStatus: r.certificateEligible ? 'issued' : 'unissued',
      };

      await supabase
        .from('flwdsk_student_records')
        .update({ custom_fields: updatedFields })
        .eq('id', r.id);
    } catch (e) {
      console.warn('Failed to sync student exam details to Supabase:', e);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (q && !`${r.studentName} ${r.email} ${r.college} ${r.voucherCode}`.toLowerCase().includes(q)) return false;
      if (filterBatch !== 'all' && r.batch !== filterBatch) return false;
      if (filterVoucher !== 'all' && r.voucherStatus !== filterVoucher) return false;
      return true;
    });
  }, [records, search, filterBatch, filterVoucher]);

  const handleAssignVoucher = async (id: string) => {
    const code = `VOUCH-${Math.floor(100000 + Math.random() * 900000)}`;
    
    const r = records.find(rec => rec.id === id);
    if (!r) return;

    try {
      await supabase.from('flwdsk_vouchers').insert({
        student_id: id,
        voucher_type: 'Initial',
        voucher_code: code,
        status: 'Assigned',
        assigned_date: new Date().toISOString(),
        assigned_by: user?.id || null
      });

      await supabase.from('flwdsk_audit_logs').insert({
        action: 'Voucher Assignment',
        entity_type: 'vouchers',
        entity_id: id,
        new_value: { voucherCode: code, type: 'Initial' },
        reason: 'Manual trainer assignment'
      });

      toast({ variant: 'success', title: 'Voucher Assigned', message: `Assigned voucher code ${code}.` });
      loadStudents();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Assignment Failed', message: e.message });
    }
  };

  const handleRevokeVoucher = async (id: string) => {
    try {
      await supabase
        .from('flwdsk_vouchers')
        .delete()
        .eq('student_id', id)
        .eq('voucher_type', 'Initial');

      await supabase.from('flwdsk_audit_logs').insert({
        action: 'Voucher Revoked',
        entity_type: 'vouchers',
        entity_id: id,
        reason: 'Manual trainer revoke'
      });

      toast({ variant: 'info', title: 'Voucher Revoked' });
      loadStudents();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Revoke Failed', message: e.message });
    }
  };

  const handleSendVoucherEmail = async (r: ExamRecord) => {
    try {
      await supabase.from('flwdsk_email_logs').insert({
        student_id: r.id,
        recipient: r.email,
        subject: 'Your Exam Voucher Details',
        mail_type: 'Voucher Mail',
        status: 'Sent',
        sent_by: user?.id || null
      });

      await supabase
        .from('flwdsk_vouchers')
        .update({ sent_status: 'Sent', sent_time: new Date().toISOString() })
        .eq('student_id', r.id)
        .eq('voucher_type', 'Initial');

      toast({
        variant: 'success',
        title: 'Voucher Email Dispatched',
        message: `Sent voucher code ${r.voucherCode} to ${r.email}.`,
      });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Email Send Failed', message: e.message });
    }
  };

  const handleUpdateMarks = async (values: Record<string, unknown>) => {
    if (!selectedRecord) return;
    const orig = values.originalScore ? Number(values.originalScore) : undefined;
    const retest = values.retestScore ? Number(values.retestScore) : undefined;

    try {
      if (orig !== undefined) {
        await supabase.from('flwdsk_exam_attempts').insert({
          student_id: selectedRecord.id,
          attempt_type: 'Initial',
          mark: orig,
          result: orig >= 50 ? 'Passed' : 'Failed',
          submitted_by: 'Trainer Manual Entry',
          updated_by: user?.id || null,
          remarks: 'Manual entry by trainer.'
        });
      }

      if (retest !== undefined) {
        await supabase.from('flwdsk_exam_attempts').insert({
          student_id: selectedRecord.id,
          attempt_type: 'Retest',
          mark: retest,
          result: retest >= 50 ? 'Passed' : 'Failed',
          submitted_by: 'Trainer Manual Entry',
          updated_by: user?.id || null,
          remarks: 'Manual entry by trainer.'
        });
      }

      await supabase.from('flwdsk_audit_logs').insert({
        action: 'Trainer Score Override',
        entity_type: 'exam_attempts',
        entity_id: selectedRecord.id,
        new_value: { originalScore: orig, retestScore: retest },
        reason: 'Trainer manual override'
      });

      toast({ variant: 'success', title: 'Exam Marks Updated' });
      setMarksDrawerOpen(false);
      loadStudents();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Failed to update marks', message: e.message });
    }
  };

  const handleBulkVoucherSubmit = async (values: Record<string, unknown>) => {
    const prefix = (values.prefix as string) || 'VOUCH-BATCH';
    try {
      const unassigned = records.filter(r => !r.voucherCode);
      for (let i = 0; i < unassigned.length; i++) {
        const student = unassigned[i];
        const code = `${prefix}-${100 + i}`;
        await supabase.from('flwdsk_vouchers').insert({
          student_id: student.id,
          voucher_type: 'Initial',
          voucher_code: code,
          status: 'Assigned',
          assigned_date: new Date().toISOString(),
          assigned_by: user?.id || null
        });
      }
      toast({ variant: 'success', title: 'Bulk Vouchers Generated' });
      setBulkVoucherOpen(false);
      loadStudents();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Bulk Generation Failed', message: e.message });
    }
  };

  const assignedCount = records.filter((r) => r.voucherStatus === 'Assigned' || r.voucherStatus === 'Redeemed').length;
  const retestCount = records.filter((r) => r.isRetestEligible).length;

  return (
    <AppShell>
      <PageHeader
        title="Final Exam & Voucher Management"
        subtitle="Manage student exam vouchers, retest eligibility, final score highest-mark logic, and certificate readiness"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setBulkVoucherOpen(true)}>⚡ Bulk Assign Vouchers</Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Vouchers Assigned</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{assignedCount} / {records.length}</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-warning)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Retest Eligible Students</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>⚠️ {retestCount} Students</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Certificate Eligible</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
            🎓 {records.filter((r) => r.certificateEligible).length} Eligible
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student name, email, voucher..." style={{ minWidth: 240 }} />
          <select
            className="kvj-select"
            value={filterVoucher}
            onChange={(e) => setFilterVoucher(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
          >
            <option value="all">All Voucher Status</option>
            <option value="Assigned">Assigned</option>
            <option value="Unassigned">Unassigned</option>
            <option value="Redeemed">Redeemed</option>
          </select>
        </div>
      </Card>

      {/* Exam Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table className="kvj-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Attendance</th>
                <th>Voucher Code</th>
                <th>Exam Scores</th>
                <th>Retest Status</th>
                <th>Cert Eligible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.studentName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.email}</div>
                  </td>
                  <td>{r.batch}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: r.attendancePct >= 80 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                      {r.attendancePct}%
                    </span>
                  </td>
                  <td>
                    {r.voucherCode ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand)', fontSize: 12 }}>
                          {r.voucherCode}
                        </span>
                        <Badge tone={r.voucherStatus === 'Redeemed' ? 'success' : 'info'}>{r.voucherStatus}</Badge>
                      </div>
                    ) : (
                      <Badge tone="warning">Unassigned</Badge>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 14, color: (r.finalScore ?? 0) >= 50 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                      Final: {r.finalScore ?? '—'}%
                    </div>
                    {r.retestScore !== undefined && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Orig: {r.originalScore}% | Retest: {r.retestScore}% (Highest Used)
                      </div>
                    )}
                  </td>
                  <td>
                    {r.isRetestEligible ? (
                      <Badge tone="warning">Retest Eligible</Badge>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={r.certificateEligible ? 'success' : 'neutral'}>
                      {r.certificateEligible ? 'Eligible' : 'Ineligible'}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {/* Enter Marks */}
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => { setSelectedRecord(r); setMarksDrawerOpen(true); }}
                      >
                        📝 Marks
                      </Button>

                      {/* History */}
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => loadStudentHistory(r)}
                      >
                        🔍 History
                      </Button>

                      {/* Voucher Assign/Revoke */}
                      {!r.voucherCode ? (
                        <Button size="xs" onClick={() => handleAssignVoucher(r.id)}>Assign Voucher</Button>
                      ) : (
                        <>
                          <Button size="xs" variant="secondary" onClick={() => handleSendVoucherEmail(r)}>✉️ Email</Button>
                          <Button size="xs" variant="danger" onClick={() => handleRevokeVoucher(r.id)}>Revoke</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Enter Marks Drawer */}
      <Drawer open={marksDrawerOpen} onClose={() => setMarksDrawerOpen(false)} title={`Enter Marks: ${selectedRecord?.studentName ?? ''}`}>
        <Form
          initial={{
            originalScore: String(selectedRecord?.originalScore ?? ''),
            retestScore: String(selectedRecord?.retestScore ?? ''),
          }}
          onSubmit={handleUpdateMarks}
        >
          <TextField name="originalScore" label="Original Exam Score (%)" placeholder="e.g. 48" />
          <TextField name="retestScore" label="Retest Score (%) (If retest taken)" placeholder="e.g. 88" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6 }}>
            Note: System automatically selects the highest score between original and retest as final score.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setMarksDrawerOpen(false)}>Cancel</Button>
            <Button type="submit">Save Marks</Button>
          </div>
        </Form>
      </Drawer>

      {/* History Drawer */}
      <Drawer open={historyDrawerOpen} onClose={() => setHistoryDrawerOpen(false)} title={`Exam & Voucher History: ${historyStudentName}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Exam Attempts Timeline */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)' }}>Exam Attempts Timeline</h4>
            {selectedStudentHistory.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No exam attempts registered yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedStudentHistory.map((h, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>Attempt #{h.attempt_number} ({h.attempt_type})</span>
                      <Badge tone={h.result === 'Passed' ? 'success' : 'danger'}>{h.result} ({h.mark}%)</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Submitted by: {h.submitted_by} · Date: {new Date(h.created_at).toLocaleString()}
                    </div>
                    {h.screenshot_url && (
                      <a href={h.screenshot_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', display: 'inline-block', marginTop: 4 }}>
                        View Screenshot
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Logs */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)' }}>Email Communication History</h4>
            {selectedStudentEmailLogs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No emails sent to this student yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedStudentEmailLogs.map((e, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 650, fontSize: 12 }}>{e.mail_type}</span>
                      <Badge tone="success">{e.status}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Subject: "{e.subject}" · Date: {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voucher Assignment History */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)' }}>Voucher History</h4>
            {selectedStudentVouchers.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No vouchers assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedStudentVouchers.map((v, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{v.voucher_code}</span>
                      <Badge tone={v.status === 'Redeemed' ? 'success' : 'info'}>{v.voucher_type} Voucher</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Assigned Date: {new Date(v.assigned_date).toLocaleString()} · Dispatch: {v.sent_status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Logs */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)' }}>Audit logs</h4>
            {selectedStudentAudits.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit events found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedStudentAudits.map((a, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{a.action}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.reason && <div style={{ fontSize: 11, marginTop: 4 }}>Reason: <em>{a.reason}</em></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Bulk Voucher Drawer */}
      <Drawer open={bulkVoucherOpen} onClose={() => setBulkVoucherOpen(false)} title="Bulk Assign Exam Vouchers">
        <Form initial={{ prefix: 'VOUCH-CHRIST-2026' }} onSubmit={handleBulkVoucherSubmit}>
          <TextField name="prefix" label="Voucher Batch Code Prefix *" placeholder="e.g. VOUCH-CHRIST-2026" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            This will auto-generate unique voucher codes for all students currently without an assigned voucher.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setBulkVoucherOpen(false)}>Cancel</Button>
            <Button type="submit">Generate & Assign Vouchers</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

export default FinalExamModule;
