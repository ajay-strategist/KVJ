import React, { useState } from 'react';
import { supabase } from '../../../shared/integration/supabase';
import { normalizeStudentKey } from '../supabase-training.repository';

export function ExamSubmissionPage() {
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [mark, setMark] = useState<number | ''>('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [overwriteAllowed, setOverwriteAllowed] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const autoResult = mark !== '' ? (Number(mark) >= 50 ? 'Passed' : 'Failed') : '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateAndSubmit = async (forceOverwrite = false) => {
    setStatusMsg(null);
    const normalisedPhone = normalizeStudentKey(phone);

    if (!normalisedPhone || normalisedPhone.length < 10) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid 10-digit Phone Number.' });
      return;
    }
    if (!voucherCode.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter your Voucher ID.' });
      return;
    }
    if (mark === '' || Number(mark) < 0 || Number(mark) > 100) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid Final Mark between 0 and 100.' });
      return;
    }

    setLoading(true);
    try {
      // 1. Find voucher
      const { data: voucher, error: vErr } = await supabase
        .from('flwdsk_vouchers')
        .select('*')
        .eq('voucher_code', voucherCode.trim())
        .limit(1)
        .maybeSingle();

      if (vErr || !voucher) {
        setStatusMsg({ type: 'error', text: 'Invalid Voucher ID. Please double-check and try again.' });
        setLoading(false);
        return;
      }

      // 2. Find student by phone
      const { data: student, error: sErr } = await supabase
        .from('flwdsk_student_records')
        .select('*')
        .eq('phone', normalisedPhone)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (sErr || !student) {
        setStatusMsg({ type: 'error', text: 'No registered student found with this phone number.' });
        setLoading(false);
        return;
      }

      // 3. Verify voucher belongs to this student
      // Check either student_id or assigned_student_register_no
      const belongs = voucher.student_id === student.id || 
                      normalizeStudentKey(voucher.assigned_student_register_no) === normalisedPhone;

      if (!belongs) {
        setStatusMsg({ type: 'error', text: 'This Voucher ID does not belong to the entered phone number.' });
        setLoading(false);
        return;
      }

      // 4. Check if already submitted
      if (voucher.status === 'Redeemed' && !overwriteAllowed && !forceOverwrite) {
        setShowOverwriteConfirm(true);
        setStatusMsg({ type: 'info', text: 'This voucher has already been submitted. Do you want to overwrite your previous submission?' });
        setLoading(false);
        return;
      }

      // 5. Determine attempt type and number
      const attemptType = voucher.voucher_type === 'Retest' ? 'Retest' : 'Initial';
      const { data: existingAttempts } = await supabase
        .from('flwdsk_exam_attempts')
        .select('attempt_number')
        .eq('student_id', student.id)
        .eq('attempt_type', attemptType);

      const attemptNum = (existingAttempts?.length ?? 0) + 1;

      // 6. Submit exam attempt
      const attemptPayload = {
        student_id: student.id,
        batch_id: voucher.batch_id,
        attempt_type: attemptType,
        attempt_number: attemptNum,
        mark: Number(mark),
        result: autoResult,
        screenshot_url: screenshot || null,
        submitted_by: 'Student',
        remarks: 'Uploaded by student via secure portal.'
      };

      const { error: attemptErr } = await supabase
        .from('flwdsk_exam_attempts')
        .insert(attemptPayload);

      if (attemptErr) throw attemptErr;

      // 7. Update voucher status
      await supabase
        .from('flwdsk_vouchers')
        .update({ status: 'Redeemed', sent_status: 'Sent' })
        .eq('id', voucher.id);

      // 8. Log audit
      await supabase.from('flwdsk_audit_logs').insert({
        action: 'Exam Submission',
        entity_type: 'exam_attempts',
        entity_id: student.id,
        new_value: { mark, result: autoResult, attemptType, attemptNum },
        reason: 'Student self-submission'
      });

      setStatusMsg({ type: 'success', text: `Success! Your final exam result (${autoResult}) has been uploaded successfully.` });
      // Reset form fields
      setPhone('');
      setVoucherCode('');
      setMark('');
      setScreenshot(null);
      setScreenshotName('');
      setShowOverwriteConfirm(false);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to submit exam results.' });
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1e1b4b, #09090b)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
      color: '#ffffff'
    }}>
      {/* Frosted Glass Card Container */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#818cf8', marginBottom: '8px' }}>
            KVJ Analytics
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #ffffff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Submit Final Exam Result
          </h2>
          <p style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '8px', lineHeight: '1.4' }}>
            Enter your verification credentials and final exam marks to register your completion certificate.
          </p>
        </div>

        {statusMsg && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            lineHeight: '1.4',
            marginBottom: '24px',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            border: `1px solid ${statusMsg.type === 'success' ? '#10b981' : statusMsg.type === 'error' ? '#ef4444' : '#3b82f6'}`,
            color: statusMsg.type === 'success' ? '#34d399' : statusMsg.type === 'error' ? '#f87171' : '#60a5fa',
          }}>
            {statusMsg.text}
            {showOverwriteConfirm && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setOverwriteAllowed(true);
                    validateAndSubmit(true);
                  }}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Yes, Overwrite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOverwriteConfirm(false);
                    setStatusMsg(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); validateAndSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 9847012345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#818cf8'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
              Voucher ID
            </label>
            <input
              type="text"
              placeholder="e.g. VOUCH-123456"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#818cf8'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
                Final Mark (%)
              </label>
              <input
                type="number"
                placeholder="0 - 100"
                min="0"
                max="100"
                value={mark}
                onChange={(e) => setMark(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
                Result
              </label>
              <input
                type="text"
                readOnly
                placeholder="Auto-calculated"
                value={autoResult}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: autoResult === 'Passed' ? '#34d399' : autoResult === 'Failed' ? '#f87171' : '#a1a1aa',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
              Upload Screenshot (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={loading}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <div style={{
                padding: '12px 16px',
                fontSize: '13px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#d4d4d8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  {screenshotName || 'Choose image...'}
                </span>
                <span style={{ fontSize: '16px' }}>📸</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '12px',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(to right, #4f46e5, #6366f1)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
            }}
          >
            {loading ? 'Submitting...' : 'Submit Result'}
          </button>
        </form>
      </div>
    </div>
  );
}
