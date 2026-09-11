import React, { useState } from 'react';
import { Card, SectionHeader, Button } from '../../../shared/ui/components';
import type { StudentRecord } from '../types/batch-management.types';

export interface CertificateDeliveryTabProps {
  filteredStudents: StudentRecord[];
  selectedBatchId: string;
  enrollments: any[];
  getCertificateDelivery: (enrollmentId: string) => Promise<any>;
  getCertificateReceiptUrl: (path: string) => Promise<any>;
  saveCertificateDelivery: (
    enrollmentId: string,
    studentId: string,
    deliveryDate: string,
    collectedBy: string,
    count: number,
    receiptPath: string
  ) => Promise<any>;
  uploadCertificateReceipt: (file: File, path: string) => Promise<any>;
  toast: (opts: { variant: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export const CertificateDeliveryTab: React.FC<CertificateDeliveryTabProps> = ({
  filteredStudents,
  selectedBatchId,
  enrollments,
  getCertificateDelivery,
  getCertificateReceiptUrl,
  saveCertificateDelivery,
  uploadCertificateReceipt,
  toast,
}) => {
  const [certSelectedStudentId, setCertSelectedStudentId] = useState<string>('');
  const [certDeliveryDate, setCertDeliveryDate] = useState<string>('');
  const [certCollectedBy, setCertCollectedBy] = useState<string>('');
  const [certCount, setCertCount] = useState<string>('');
  const [certReceiptFile, setCertReceiptFile] = useState<File | null>(null);
  const [certReceiptPath, setCertReceiptPath] = useState<string>('');
  const [certSaving, setCertSaving] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const [certRecord, setCertRecord] = useState<any>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certReceiptUrl, setCertReceiptUrl] = useState<string>('');

  const handleStudentSelect = async (sid: string) => {
    setCertSelectedStudentId(sid);
    setCertDeliveryDate('');
    setCertCollectedBy('');
    setCertCount('');
    setCertReceiptFile(null);
    setCertReceiptPath('');
    setCertRecord(null);
    setCertReceiptUrl('');
    if (!sid) return;

    const enrollment = enrollments.find(
      (en) => en.batchId === selectedBatchId && en.studentId === sid
    );
    if (!enrollment) return;

    setCertLoading(true);
    try {
      const res = await getCertificateDelivery(enrollment.id);
      if (res.ok && res.value) {
        const rec = res.value;
        setCertRecord(rec);
        setCertDeliveryDate(rec.deliveryDate || '');
        setCertCollectedBy(rec.collectedBy || '');
        setCertCount(rec.certificateCount != null ? String(rec.certificateCount) : '');
        setCertReceiptPath(rec.certificateReceiptPath || '');
        if (rec.certificateReceiptPath) {
          const urlRes = await getCertificateReceiptUrl(rec.certificateReceiptPath);
          if (urlRes.ok) setCertReceiptUrl(urlRes.value);
        }
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Error', message: e?.message || 'Failed to fetch certificate delivery.' });
    } finally {
      setCertLoading(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!certReceiptFile || !certSelectedStudentId) return;
    setCertUploading(true);
    try {
      const ext = certReceiptFile.name.split('.').pop() || 'pdf';
      const path = `${certSelectedStudentId}/${Date.now()}.${ext}`;
      const res = await uploadCertificateReceipt(certReceiptFile, path);
      if (res.ok) {
        setCertReceiptPath(res.value);
        toast({ variant: 'success', title: 'Receipt Uploaded', message: 'Receipt file uploaded successfully.' });
        const urlRes = await getCertificateReceiptUrl(res.value);
        if (urlRes.ok) setCertReceiptUrl(urlRes.value);
      } else {
        toast({ variant: 'error', title: 'Upload Failed', message: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Upload Failed', message: e?.message || 'Failed to upload receipt.' });
    } finally {
      setCertUploading(false);
    }
  };

  const handleSave = async () => {
    if (!certSelectedStudentId) return;
    const enrollment = enrollments.find(
      (en) => en.batchId === selectedBatchId && en.studentId === certSelectedStudentId
    );
    if (!enrollment) {
      toast({ variant: 'error', title: 'Enrollment Not Found', message: 'Cannot find enrollment for this student in the selected batch.' });
      return;
    }
    const count = parseInt(certCount, 10);
    if (isNaN(count) || count <= 0) {
      toast({ variant: 'error', title: 'Invalid Count', message: 'Number of certificates must be a positive integer.' });
      return;
    }
    if (!certReceiptPath) {
      toast({ variant: 'error', title: 'Receipt Required', message: 'Please upload the certificate receipt before saving.' });
      return;
    }
    setCertSaving(true);
    try {
      const res = await saveCertificateDelivery(
        enrollment.id,
        certSelectedStudentId,
        certDeliveryDate,
        certCollectedBy,
        count,
        certReceiptPath
      );
      if (res.ok) {
        setCertRecord(res.value);
        toast({ variant: 'success', title: 'Delivery Recorded', message: 'Certificate delivery record saved successfully.' });
      } else {
        toast({ variant: 'error', title: 'Save Failed', message: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'error', title: 'Save Failed', message: e?.message || 'Failed to save delivery.' });
    } finally {
      setCertSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="📜 Certificate Delivery Record" />

      {/* Student selector */}
      <Card style={{ padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Select Student
          </label>
          <select
            className="kvj-select"
            value={certSelectedStudentId}
            onChange={(e) => handleStudentSelect(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          >
            <option value="">— Select a student —</option>
            {filteredStudents.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>

        {certLoading && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
            Loading delivery record…
          </div>
        )}

        {certSelectedStudentId && !certLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            {certRecord && (
              <div style={{ fontSize: 12, color: 'var(--success)', background: 'var(--success-bg, rgba(34,197,94,0.08))', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--success)' }}>
                ✅ Existing delivery record loaded. Saving will update it.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Delivery Date */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Delivery Date <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="date"
                  className="kvj-input"
                  value={certDeliveryDate}
                  onChange={(e) => setCertDeliveryDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                />
              </div>

              {/* Collected By */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Collected By <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="kvj-input"
                  placeholder="Name of recipient at College"
                  value={certCollectedBy}
                  onChange={(e) => setCertCollectedBy(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                />
              </div>
            </div>

            {/* No. of Certificates */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                No. of Certificates <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                type="number"
                min={1}
                className="kvj-input"
                placeholder="e.g. 1"
                value={certCount}
                onChange={(e) => setCertCount(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              />
            </div>

            {/* Certificate Receipt upload */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Certificate Receipt <span style={{ color: 'var(--error)' }}>*</span>
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  (JPEG, PNG, WEBP or PDF — max 5 MB)
                </span>
              </label>

              {certReceiptPath && (
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--success)' }}>✅ Receipt on file:</span>
                  {certReceiptUrl ? (
                    <a
                      href={certReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'underline' }}
                    >
                      View / Download
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {certReceiptPath.split('/').pop()}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  id="cert-receipt-file-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setCertReceiptFile(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={certUploading}
                  onClick={() => document.getElementById('cert-receipt-file-input')?.click()}
                >
                  {certReceiptFile ? `📎 ${certReceiptFile.name}` : certReceiptPath ? '🔄 Replace Receipt' : '📤 Attach Receipt'}
                </Button>
                {certReceiptFile && !certUploading && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUploadReceipt}
                  >
                    ☁️ Upload Now
                  </Button>
                )}
                {certUploading && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uploading…</span>
                )}
              </div>
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <Button
                size="sm"
                variant="primary"
                disabled={certSaving || !certDeliveryDate || !certCollectedBy || !certCount || !certReceiptPath}
                onClick={handleSave}
              >
                {certSaving ? 'Saving…' : '💾 Save Delivery Record'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
