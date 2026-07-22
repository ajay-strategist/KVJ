import React from 'react';
import type { SectionId } from './daily-report.types';
import type { SectionProps } from './sections/CoverPageSection';

import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { DatewiseAttendanceSection } from './sections/DatewiseAttendanceSection';
import { AssessmentStatusSection } from './sections/AssessmentStatusSection';
import { FinalExamEligibilitySection } from './sections/FinalExamEligibilitySection';
import { StudentDataSection } from './sections/StudentDataSection';
import { TrainerNotesSection } from './sections/TrainerNotesSection';

export interface SectionDefinition {
  id: SectionId;
  label: string;
  category: 'Overview' | 'Attendance' | 'Assessments' | 'Eligibility' | 'Student Data' | 'Analytics & Notes';
  defaultOn: boolean;
  component: React.ComponentType<SectionProps>;
}

export const SECTIONS: SectionDefinition[] = [
  { id: 'executive-summary', label: '1. Executive Summary & Student Demographics', category: 'Overview', defaultOn: true, component: ExecutiveSummarySection },
  { id: 'datewise-attendance', label: '2. Date-wise Attendance Log, Trend & Absentees', category: 'Attendance', defaultOn: true, component: DatewiseAttendanceSection },
  { id: 'assessment-status', label: '3. Assessment Performance, Histograms & Outcomes', category: 'Assessments', defaultOn: true, component: AssessmentStatusSection },
  { id: 'final-exam-eligibility', label: '4. Final Exam Eligibility Status & Rates', category: 'Eligibility', defaultOn: true, component: FinalExamEligibilitySection },
  { id: 'student-data', label: '5. Master Student Data Directory', category: 'Student Data', defaultOn: true, component: StudentDataSection },
  { id: 'trainer-notes', label: '6. Trainer Observations & Notes', category: 'Analytics & Notes', defaultOn: false, component: TrainerNotesSection },
];
