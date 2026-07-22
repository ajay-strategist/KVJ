/**
 * Deterministic demo seed for the training catalog.
 *
 * Generates a realistic, stable set of courses and batches so the Training
 * Batch carousel has content and its virtualization can be exercised against
 * the 100+ batch requirement.
 *
 * Trainer ids deliberately reference the REAL mock employee ids so the trainer
 * always resolves — earlier demo data used placeholder ids ('emp-1') that
 * matched no employee, and silently rendered as empty everywhere.
 */

import type { Course, Batch, TrainingPhase } from './training.repository';
import { TRAINING_PHASES } from './training.repository';
import { toLocalISODate } from '../../shared/utils/date';

/** Small deterministic PRNG so the demo data is identical on every load. */
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const COLLEGES = [
  'Christ Irinjalakkuda', 'MIM Kuttikkanam', 'Santhigiri', 'Rajagiri',
  'Nehru College', 'Vimala College', 'IPS Public School', 'SB College',
  "St. Teresa's", 'Sacred Heart',
];

const PROGRAMS = [
  'Data Analytics', 'Power BI', 'Excel Expert 365', 'Advanced Excel',
  'PL 900', 'Business Finance', 'Tally & GST',
];

const COURSE_GROUPS = ['1 CS', '2 CS', '3 BCA', '2 BCA', '3 BCOM', 'BCOM Self', '1 MCOM', '2 MBA', '3 BBA', '2 Maths'];

const COORDINATORS = [
  'Dr. Meera Nair', 'Prof. Anil Kumar', 'Dr. Sneha Raj', 'Prof. Vinod Menon',
  'Dr. Latha Pillai', 'Prof. RajeshВарма'.replace('Варма', 'Varma'),
];

/** Real mock-employee ids — keep in sync with mock-employee.repository.ts. */
const TRAINER_IDS = ['u-admin', 'u-ceo', 'u-ops', 'u-lead', 'u-sup', 'u-emp'];

const AUDIT = {
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
};

export const SEED_COURSES: Course[] = PROGRAMS.map((title, i) => ({
  id: `course-${i + 1}`,
  title,
  code: `KVJ-${title.split(' ')[0].toUpperCase().slice(0, 4)}-${100 + i}`,
  maxMarks: 100,
  passPercentage: 70,
  checklist: [
    'College Confirmation Form Signed',
    'Trainer Assigned',
    'Student Registry Uploaded',
    'Syllabus Dispatched',
    'Daily Sessions Logged',
    'Final Report Generated',
    'Certificates Dispatched',
    'Signed Receipt Uploaded',
  ],
  status: 'active',
  ...AUDIT,
}));

/** Generate `count` batches spread across colleges, programs and phases. */
export function makeSeedBatches(count = 120): Batch[] {
  const rand = makeRandom(20260722);
  const today = new Date();

  return Array.from({ length: count }, (_, i) => {
    const college = COLLEGES[i % COLLEGES.length];
    const courseIdx = i % PROGRAMS.length;
    const program = PROGRAMS[courseIdx];
    const group = COURSE_GROUPS[i % COURSE_GROUPS.length];
    const batchNo = `Batch ${(i % 4) + 1}`;
    const phase: TrainingPhase = TRAINING_PHASES[i % TRAINING_PHASES.length];

    // Spread start dates around today so some are past, some upcoming.
    const offset = Math.floor(rand() * 120) - 60;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 20 + Math.floor(rand() * 25));

    const totalTasks = 18;
    // Progress correlates with phase so the bar and badge agree.
    const phaseProgress = TRAINING_PHASES.indexOf(phase) / (TRAINING_PHASES.length - 1);
    const completedTasks = Math.round(phaseProgress * totalTasks);

    return {
      id: `batch-${i + 1}`,
      courseId: `course-${courseIdx + 1}`,
      code: `${college.split(' ')[0].toUpperCase().slice(0, 6)}-${group.replace(/\s/g, '')}-${i + 1}`,
      trainerId: TRAINER_IDS[i % TRAINER_IDS.length],
      startDate: toLocalISODate(start),
      endDate: toLocalISODate(end),
      capacity: 30 + Math.floor(rand() * 40),
      venue: rand() > 0.25 ? `${college} Campus` : 'Online',
      trainingName: `${group} ${program}`,
      college,
      academicYear: '2026-2027',
      batchNo,
      coordinator: COORDINATORS[i % COORDINATORS.length],
      phase,
      completedTasks,
      totalTasks,
      status: phase === 'Completed' ? 'completed' : 'scheduled',
      ...AUDIT,
    } satisfies Batch;
  });
}

export const SEED_BATCHES: Batch[] = makeSeedBatches();
