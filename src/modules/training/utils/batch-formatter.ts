/**
 * Batch Formatter Utility — Single source of truth for standardized 5-part batch codes,
 * normalization, duplicate detection, and backward-compatible display formatting.
 *
 * Canonical Batch Code Format:
 *   COLLEGE_CODE - PROGRAM - ACADEMIC_YEAR - BATCH_NO - COURSE_CODE
 *   Example: ABC - BCOM SELF - 2026-2027 - BATCH 1 - EXCEL
 */

/**
 * Normalizes a single batch code segment:
 * - trims leading/trailing whitespace
 * - collapses multiple spaces into a single space
 * - removes stray separator characters that would break 5-part splitting
 * - uppercases consistently
 */
export function normalizeCodeSegment(val: string | undefined | null): string {
  if (!val) return '';
  return String(val)
    .replace(/(\s*-\s*Copy|\s*\(Copy\))+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Normalizes a full batch code string for consistent storage & uniqueness comparison.
 * Standardizes separator spacing (" - "), collapses whitespace, and uppercases.
 */
export function normalizeBatchCode(code: string | undefined | null): string {
  if (!code) return '';
  return String(code)
    .replace(/(\s*-\s*Copy|\s*\(Copy\))+/gi, '')
    .split(/\s+-\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim().toUpperCase())
    .filter(Boolean)
    .join(' - ');
}

export interface StandardBatchCodeInput {
  collegeCode?: string | null;
  program?: string | null;
  academicYear?: string | null;
  batchNo?: string | null;
  courseCode?: string | null;
}

/**
 * Generates the canonical 5-part standardized batch code:
 *   COLLEGE_CODE - PROGRAM - ACADEMIC_YEAR - BATCH_NO - COURSE_CODE
 *
 * Returns an empty string if any required segment is missing, or when
 * `allowPartial` is true, substitutes placeholder labels for live UI preview.
 */
export function generateStandardBatchCode(
  input: StandardBatchCodeInput,
  options?: { allowPartial?: boolean }
): string {
  const collegeCode = normalizeCodeSegment(input.collegeCode);
  const program = normalizeCodeSegment(input.program);
  const academicYear = normalizeCodeSegment(input.academicYear);
  const batchNo = normalizeCodeSegment(input.batchNo);
  const courseCode = normalizeCodeSegment(input.courseCode);

  if (options?.allowPartial) {
    return [
      collegeCode || 'COLLEGE_CODE',
      program || 'PROGRAM',
      academicYear || 'ACADEMIC_YEAR',
      batchNo || 'BATCH_NO',
      courseCode || 'COURSE_CODE',
    ].join(' - ');
  }

  if (!collegeCode || !program || !academicYear || !batchNo || !courseCode) {
    return '';
  }

  return [collegeCode, program, academicYear, batchNo, courseCode].join(' - ');
}

/**
 * Checks whether a candidate batch code collides with an existing active batch
 * (case-insensitive and whitespace-normalized).
 */
export function isDuplicateBatchCode(
  candidateCode: string,
  existingBatches: Array<{ id?: string; code?: string | null; deletedAt?: string | null }>,
  excludeBatchId?: string
): boolean {
  const normalizedCandidate = normalizeBatchCode(candidateCode);
  if (!normalizedCandidate) return false;
  return existingBatches.some((b) => {
    if (!b || b.deletedAt) return false;
    if (excludeBatchId && b.id === excludeBatchId) return false;
    return normalizeBatchCode(b.code) === normalizedCandidate;
  });
}

export function cleanBatchCode(code: string | undefined | null, batchNo?: string | null): string {
  if (!code) return '';
  let cleaned = code
    .replace(/(\s*-\s*Copy|\s*\(Copy\))+/gi, '')
    .trim();

  // If a distinct batchNo is provided (e.g. "Batch 2"), sync it if code contains an outdated "Batch 1" from cloning
  if (batchNo && batchNo.trim()) {
    const cleanNo = batchNo.trim();
    cleaned = cleaned.replace(/Batch\s*\d+/gi, cleanNo);
  }

  return cleaned
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatBatchTitle(
  batch: {
    code?: string;
    college?: string;
    program?: string;
    academicYear?: string;
    batchNo?: string;
    trainingName?: string;
  },
  courseTitle?: string
): string {
  const cleaned = cleanBatchCode(batch.code);
  if (cleaned) return cleaned;

  const parts = [
    batch.college,
    batch.program || batch.trainingName || courseTitle,
    batch.academicYear,
    batch.batchNo,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : 'Training Batch';
}

export function formatBatchWithCourse(
  batch?: {
    code?: string;
    batchNo?: string;
    trainingName?: string;
    name?: string;
    college?: string;
    program?: string;
  } | null,
  courseTitle?: string
): string {
  if (!batch) return 'Training Batch';
  const base = cleanBatchCode(batch.code, batch.batchNo) || batch.name || 'Batch';
  const course = (batch.trainingName || courseTitle || '').trim();
  if (course && !base.toLowerCase().includes(course.toLowerCase())) {
    return `${base} — ${course}`;
  }
  return base;
}
