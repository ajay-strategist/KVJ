import React, { useState } from 'react';
import { supabase } from '../../../shared/integration/supabase';
import { normalizeStudentKey } from '../supabase-training.repository';
import { calculateFinalExamEligibility } from '../utils/eligibility';
import { useTraining } from '../hooks/useTraining';

export function ExamSubmissionPage() {
  const { recordExamAttempt } = useTraining({ fetchStudents: false });
  const [phone, setPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [mark, setMark] = useState<number | ''>('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [overwriteAllowed, setOverwriteAllowed] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const [passMark, setPassMark] = useState<number>(70);

  const autoResult = mark !== '' ? (Number(mark) >= passMark ? 'Passed' : 'Failed') : '';

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

      if (voucher.voucher_type === 'Retest' && voucher.payment_verified !== 'Verified') {
        setStatusMsg({ type: 'error', text: 'Retest payment verification is pending. Please contact your trainer/administrator.' });
        setLoading(false);
        return;
      }

      // Fetch batch and course to determine dynamic course-level pass percentage
      let dynamicPassMark = 70;
      if (voucher.batch_id) {
        const { data: batchData } = await supabase
          .from('flwdsk_batches')
          .select('course_id')
          .eq('id', voucher.batch_id)
          .maybeSingle();

        if (batchData?.course_id) {
          const { data: courseData } = await supabase
            .from('flwdsk_courses')
            .select('passPercentage, pass_percentage')
            .eq('id', batchData.course_id)
            .maybeSingle();

          if (courseData) {
            dynamicPassMark = courseData.passPercentage ?? courseData.pass_percentage ?? 70;
          }
        }
      }
      setPassMark(dynamicPassMark);

      // 2. Find student associated with the voucher to prevent cross-batch mismatch
      let student = null;
      let sErr = null;

      if (voucher.student_id) {
        const { data: st, error: err } = await supabase
          .from('flwdsk_student_records')
          .select('*')
          .eq('id', voucher.student_id)
          .is('deleted_at', null)
          .maybeSingle();
        student = st;
        sErr = err;
      } else {
        // Fallback for unassigned voucher with register no, scoped by batch ID
        const { data: enrollments } = await supabase
          .from('flwdsk_enrollments')
          .select('student_id')
          .eq('batch_id', voucher.batch_id);

        const studentIdsInBatch = enrollments?.map(e => e.student_id) || [];

        const { data: st, error: err } = await supabase
          .from('flwdsk_student_records')
          .select('*')
          .eq('phone', normalisedPhone)
          .in('id', studentIdsInBatch)
          .is('deleted_at', null)
          .maybeSingle();
        student = st;
        sErr = err;
      }

      if (sErr || !student) {
        setStatusMsg({ type: 'error', text: 'No registered student found matching this phone number and voucher context.' });
        setLoading(false);
        return;
      }

      // 3. Verify voucher belongs to this student (identity verification check)
      const studentPhone = normalizeStudentKey(student.phone || '');
      const belongs = voucher.student_id === student.id || 
                      normalizeStudentKey(voucher.assigned_student_register_no) === normalisedPhone;

      if (!belongs || studentPhone !== normalisedPhone) {
        setStatusMsg({ type: 'error', text: 'This Voucher ID does not belong to the entered phone number.' });
        setLoading(false);
        return;
      }

      // 3.5 Verify student eligibility for final exam
      if (voucher.batch_id) {
        const { data: eligibilityRules } = await supabase
          .from('flwdsk_batch_eligibility_rules')
          .select('*')
          .eq('batch_id', voucher.batch_id)
          .maybeSingle();

        const eligResult = calculateFinalExamEligibility(student, eligibilityRules);
        if (!eligResult.eligible) {
          setStatusMsg({
            type: 'error',
            text: `You are not eligible to submit this exam. Reason: ${eligResult.reason}`
          });
          setLoading(false);
          return;
        }
      }

      // 4. Check if already submitted
      if (voucher.status === 'Redeemed' && !overwriteAllowed && !forceOverwrite) {
        setShowOverwriteConfirm(true);
        setStatusMsg({ type: 'info', text: 'This voucher has already been submitted. Do you want to overwrite your previous submission?' });
        setLoading(false);
        return;
      }

      // 5. Submit exam attempt via Training Service
      const attemptType = voucher.voucher_type === 'Retest' ? 'Retest' : 'Initial';
      const finalResult = Number(mark) >= dynamicPassMark ? 'Passed' : 'Failed';

      const res = await recordExamAttempt(
        student.id,
        voucher.batch_id,
        attemptType,
        Number(mark),
        voucher.voucher_code,
        screenshot || null,
        'Student',
        overwriteAllowed || forceOverwrite
      );

      if (!res.ok) throw new Error(res.error);

      setStatusMsg({ type: 'success', text: `Success! Your final exam result (${finalResult}) has been uploaded successfully.` });
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
        backdropFilter: 'blur(var(--glass-blur, 12px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
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
            border: `1px solid ${statusMsg.type === 'success' ? 'var(--status-success)' : statusMsg.type === 'error' ? 'var(--status-danger)' : 'var(--brand)'}`,
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
                    background: 'var(--status-danger)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '12px',
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
                    fontSize: '12px',
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
              onBlur={async (e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                if (!voucherCode.trim()) return;
                try {
                  const { data: voucher } = await supabase
                    .from('flwdsk_vouchers')
                    .select('batch_id')
                    .eq('voucher_code', voucherCode.trim())
                    .maybeSingle();

                  if (voucher?.batch_id) {
                    const { data: batch } = await supabase
                      .from('flwdsk_batches')
                      .select('course_id')
                      .eq('id', voucher.batch_id)
                      .maybeSingle();

                    if (batch?.course_id) {
                      const { data: course } = await supabase
                        .from('flwdsk_courses')
                        .select('passPercentage, pass_percentage')
                        .eq('id', batch.course_id)
                        .maybeSingle();

                      if (course) {
                        setPassMark(course.passPercentage ?? course.pass_percentage ?? 70);
                      }
                    }
                  }
                } catch (err) {
                  console.warn('Failed to resolve pass mark for voucher:', err);
                }
              }}
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
