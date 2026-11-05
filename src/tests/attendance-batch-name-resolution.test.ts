import { describe, it, expect } from 'vitest';
import { cleanBatchCode } from '../modules/training/utils/batch-formatter';

function batchDisplayName(b?: {
  college?: string; program?: string; academicYear?: string;
  batchNo?: string; trainingName?: string; code?: string;
} | null): string {
  if (!b) return 'Training Batch';
  const cleaned = cleanBatchCode(b.code, b.batchNo);
  if (cleaned) return cleaned;
  const parts = [b.college, b.program, b.academicYear, b.batchNo].filter(Boolean);
  if (parts.length) return parts.join(' - ');
  return b.trainingName || 'Training Batch';
}

function resolveBatchHelper(
  workType?: string,
  sessionNotes?: string,
  recordNotes?: string,
  recordBatchId?: string,
  batches: any[] = []
) {
  const wt = workType || 'Office';
  const safeBatches = Array.isArray(batches) ? batches : [];
  const isTraining = wt.startsWith('Training:') || wt === 'Training' || (sessionNotes || '').toLowerCase().includes('training') || (recordNotes || '').toLowerCase().includes('training');

  let foundBatch: any = null;
  let extractedBatchName: string | null = null;
  let extractedLoc: string | null = null;

  const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;

  if (recordBatchId) {
    foundBatch = safeBatches.find((b) => b && (b.id === recordBatchId || b.code === recordBatchId || b.trainingName === recordBatchId));
    if (foundBatch) {
      extractedBatchName = batchDisplayName(foundBatch);
    }
  }

  let candidate: string | null = null;
  if (wt.startsWith('Training:')) {
    candidate = wt.substring(9).trim();
  }
  if (!candidate && rawNotes) {
    const bracketMatch = rawNotes.match(/\[(?:Training|Batch):\s*([^\]\-]+?)(?:\s*-\s*[^\]]+)?\]/i);
    if (bracketMatch && bracketMatch[1].trim()) {
      candidate = bracketMatch[1].trim();
    }
  }
  if (!candidate && rawNotes) {
    const tbMatch = rawNotes.match(/(?:Training|Batch):\s*([^\n,\]]+)/i);
    if (tbMatch && tbMatch[1].trim()) {
      candidate = tbMatch[1].trim();
    }
  }
  if (!candidate && rawNotes) {
    const classLocMatch = rawNotes.match(/Classification:\s*Training[^\n,]*Location:\s*([^\n,\]]+)/i);
    if (classLocMatch && classLocMatch[1].trim()) {
      candidate = classLocMatch[1].trim();
    }
  }

  const locMatch = rawNotes.match(/Location:\s*([^\n,]+)/i);
  if (locMatch && locMatch[1].trim()) {
    const parsedLoc = locMatch[1].trim().replace(/\.$/, '').trim();
    if (parsedLoc.toLowerCase() !== 'office work' && parsedLoc.toLowerCase() !== 'office') {
      extractedLoc = parsedLoc;
    }
  }

  if (candidate) {
    candidate = candidate.replace(/[.,\])]+$/, '').trim();
    const lowerCandidate = candidate.toLowerCase();
    if (['training session', 'training batch', 'office work', 'office', 'training', 'approved session'].includes(lowerCandidate)) {
      candidate = null;
    }
  }

  if (!foundBatch && candidate) {
    const lowerCandidate = candidate.toLowerCase();
    const cleanCandidate = cleanBatchCode(candidate).toLowerCase();

    foundBatch = safeBatches.find((b) => {
      if (!b) return false;
      if (b.id && b.id.toLowerCase() === lowerCandidate) return true;
      if (b.code && b.code.toLowerCase() === lowerCandidate) return true;
      if (b.trainingName && b.trainingName.toLowerCase() === lowerCandidate) return true;
      if (batchDisplayName(b).toLowerCase() === lowerCandidate) return true;

      const cleanB = cleanBatchCode(b.code, b.batchNo).toLowerCase();
      if (cleanB && (cleanB === cleanCandidate || cleanB === lowerCandidate)) return true;
      if (cleanCandidate && cleanB && (cleanB.includes(cleanCandidate) || cleanCandidate.includes(cleanB))) return true;
      return false;
    });

    if (foundBatch) {
      extractedBatchName = batchDisplayName(foundBatch);
    } else {
      extractedBatchName = cleanBatchCode(candidate) || candidate;
    }
  }

  if (!foundBatch && !extractedBatchName && extractedLoc) {
    const lowerLoc = extractedLoc.toLowerCase();
    foundBatch = safeBatches.find((b) => {
      if (!b) return false;
      const disp = batchDisplayName(b).toLowerCase();
      if (disp === lowerLoc) return true;
      if (b.code && b.code.toLowerCase() === lowerLoc) return true;
      return false;
    });
    if (foundBatch) {
      extractedBatchName = batchDisplayName(foundBatch);
    } else if (lowerLoc !== 'training session' && lowerLoc !== 'training batch') {
      extractedBatchName = cleanBatchCode(extractedLoc) || extractedLoc;
    }
  }

  return { foundBatch, extractedBatchName, extractedLoc, isTraining };
}

function resolveOrgValue(
  workType?: string,
  sessionNotes?: string,
  recordNotes?: string,
  recordBatchId?: string,
  batches: any[] = []
): string {
  const wt = (workType || '').toLowerCase().trim();
  const rawNotes = `${sessionNotes || ''} ${recordNotes || ''}`;
  const lowerNotes = rawNotes.toLowerCase();

  if (wt.includes('marketing') || lowerNotes.includes('classification: marketing')) {
    return 'Marketing';
  }
  if (wt === 'work from home' || wt === 'remote' || wt === 'wfh' || wt.includes('remote') || wt.includes('wfh') || wt.includes('work from home') || lowerNotes.includes('remote') || lowerNotes.includes('wfh') || lowerNotes.includes('work from home')) {
    return 'Remote';
  }

  const { foundBatch, extractedBatchName, extractedLoc, isTraining } = resolveBatchHelper(workType, sessionNotes, recordNotes, recordBatchId, batches);
  if (foundBatch) {
    return batchDisplayName(foundBatch);
  }
  if (extractedBatchName) {
    return extractedBatchName;
  }
  if (extractedLoc) {
    return extractedLoc;
  }
  return isTraining ? 'Training Batch' : (wt === 'office' || !wt ? 'KVJ Analytics' : (workType || '—'));
}

describe('Attendance Batch Name Resolution', () => {
  const mockBatches = [
    { id: 'b1', code: 'Asian School of Business - 2 MBA - Batch 2', trainingName: 'Advanced Excel', college: 'Asian School of Business' },
    { id: 'b2', code: 'Christ - Christ Teachers - Batch 1', trainingName: 'Python for beginners', college: 'Christ' },
    { id: 'b3', code: 'SJCET - 2 MBA - Batch 1', trainingName: 'Excel Expert 365', college: 'SJCET' },
    { id: 'b4', code: 'SB - 2 MBA - Batch 2', trainingName: 'Excel Expert 365', college: 'SB' },
  ];

  it('resolves batch name when workType is Training: <batch>', () => {
    const org = resolveOrgValue('Training: SB - 2 MBA - Batch 2', undefined, undefined, undefined, mockBatches);
    expect(org).toBe('SB - 2 MBA - Batch 2');
  });

  it('resolves batch name when workType is Training and notes has Training: <batch>', () => {
    const org1 = resolveOrgValue('Training', 'Training: Asian School of Business - 2 MBA - Batch 2', undefined, undefined, mockBatches);
    expect(org1).toBe('Asian School of Business - 2 MBA - Batch 2');

    const org2 = resolveOrgValue('Training', 'Training: Christ - Christ Teachers - Batch 1', undefined, undefined, mockBatches);
    expect(org2).toBe('Christ - Christ Teachers - Batch 1');
  });

  it('resolves batch name when notes has bracketed format [Training: <batch>]', () => {
    const org = resolveOrgValue('Training', '[Training: SJCET - 2 MBA - Batch 1]', undefined, undefined, mockBatches);
    expect(org).toBe('SJCET - 2 MBA - Batch 1');
  });

  it('resolves batch name when batch is not in safeBatches list but note contains descriptive batch title', () => {
    const org = resolveOrgValue('Training', 'Training: Rajagiri - 1 MBA - Batch 3', undefined, undefined, mockBatches);
    expect(org).toBe('Rajagiri - 1 MBA - Batch 3');
  });

  it('resolves Office sessions as KVJ Analytics', () => {
    const org = resolveOrgValue('Office', undefined, undefined, undefined, mockBatches);
    expect(org).toBe('KVJ Analytics');
  });
});

