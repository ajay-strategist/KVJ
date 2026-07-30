/**
 * Batch Formatter Utility — Cleans up duplicate copy suffixes and provides
 * clean, professional display titles for training batches across all pages.
 */

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
