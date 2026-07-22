import { useState } from 'react';
import { todayISO } from '../../../shared/utils/date';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { useTraining } from '../hooks/useTraining';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { TRAINING_SERVICE_TOKEN } from '../training.service';
import type { Batch } from '../training.repository';

export function StudentAttendance() {
  const { batches, enrollments, students, loading } = useTraining();
  const { toast } = useNotifications();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, 'present' | 'absent' | 'late' | 'leave'>>({});

  const batchStudents = enrollments
    .filter((e) => e.batchId === selectedBatchId)
    .map((e) => students.find((s) => s.id === e.studentId))
    .filter(Boolean);

  const handleSaveAttendance = async () => {
    if (!selectedBatchId) return;

    const records = batchStudents.map((s) => ({
      studentId: s!.id,
      status: attendanceStatuses[s!.id] || 'present',
    }));

    const trainingService = container.resolve(TRAINING_SERVICE_TOKEN);
    const mockActor = { id: 'SYSTEM' as any, role: 'Employee' };
    const res = await trainingService.logSessionAttendance(selectedBatchId, sessionDate, records, mockActor);

    if (res.ok) {
      toast({ variant: 'success', title: 'Attendance Logged', message: `Saved record sheet for ${sessionDate}` });
      setSelectedBatchId(null);
    } else {
      toast({ variant: 'error', title: 'Error', message: res.error.message });
    }
  };

  const columns: Column<Batch>[] = [
    { key: 'code', header: 'Batch Code', sortable: true, accessor: (b) => b.code },
    { key: 'dates', header: 'Duration', render: (b) => `${b.startDate} to ${b.endDate}` },
    { key: 'action', header: 'Actions', render: (b) => (
      <Button size="sm" onClick={() => setSelectedBatchId(b.id)}>Take Session Attendance</Button>
    )},
  ];

  return (
    <AppShell>
      <PageHeader
        title="Session Attendance Sheet"
        subtitle="Log and track daily session attendance for student batches and assigned trainers"
      />

      {!selectedBatchId ? (
        <DataTable columns={columns} rows={batches} rowKey={(b) => b.id} loading={loading} />
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <SectionHeader title={`Log Attendance for Batch: ${batches.find((b) => b.id === selectedBatchId)?.code}`} />
            <Button variant="secondary" onClick={() => setSelectedBatchId(null)}>Back to Batches</Button>
          </div>

          <div style={{ maxWidth: 300, marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Session Log Date</label>
            <input
              type="date"
              className="kvj-input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          {batchStudents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No students enrolled in this batch yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {batchStudents.map((student) => (
                <div
                  key={student!.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: 'var(--surface-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{student!.firstName} {student!.lastName}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['present', 'absent', 'late', 'leave'] as const).map((status) => {
                      const active = (attendanceStatuses[student!.id] || 'present') === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setAttendanceStatuses((prev) => ({ ...prev, [student!.id]: status }))}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            border: '1px solid var(--border-color)',
                            backgroundColor: active ? 'var(--primary-color)' : 'transparent',
                            color: active ? 'white' : 'var(--text-primary)',
                          }}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSaveAttendance}>Commit Attendance Registry</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}
export default StudentAttendance;
