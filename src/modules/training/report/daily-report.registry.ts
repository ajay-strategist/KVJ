import React from 'react';
import type { SectionId } from './daily-report.types';
import type { SectionProps } from './sections/CoverPageSection';

import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { DatewiseAttendanceSection } from './sections/DatewiseAttendanceSection';
import { AssessmentStatusSection } from './sections/AssessmentStatusSection';
import { FinalExamEligibilitySection } from './sections/FinalExamEligibilitySection';
import { FinalExamResultsSection } from './sections/FinalExamResultsSection';
import { ToppersSection } from './sections/ToppersSection';
import { MockVsFinalSection } from './sections/MockVsFinalSection';
import { StudentProgressSection } from './sections/StudentProgressSection';
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
  { id: 'executive-summary', label: '1. Executive Summary & Student Overview', category: 'Overview', defaultOn: true, component: ExecutiveSummarySection },
  { id: 'datewise-attendance', label: '2. Date-wise Attendance Log & Trend', category: 'Attendance', defaultOn: true, component: DatewiseAttendanceSection },
  { id: 'final-exam-eligibility', label: '3. Final Exam Eligibility Status', category: 'Eligibility', defaultOn: true, component: FinalExamEligibilitySection },
  { id: 'assessment-status', label: '4. Assessment Performance & Outcomes', category: 'Assessments', defaultOn: true, component: AssessmentStatusSection },
  { id: 'progress-analytics', label: '5. Dynamic Student Progress Analytics', category: 'Assessments', defaultOn: true, component: StudentProgressSection },
  { id: 'final-exam-results', label: '6. Final Exam Outcomes & Cross-Demographics', category: 'Assessments', defaultOn: true, component: FinalExamResultsSection },
  { id: 'toppers-overview', label: '7. Top Performing Students & Honor Roll', category: 'Assessments', defaultOn: true, component: ToppersSection },
  { id: 'mock-vs-final', label: '8. Mock Exam vs. Final Performance Correlation', category: 'Assessments', defaultOn: true, component: MockVsFinalSection },
  { id: 'student-data', label: '9. Master Student Data Directory', category: 'Student Data', defaultOn: true, component: StudentDataSection },
  { id: 'trainer-notes', label: '10. Trainer Observations & Notes', category: 'Analytics & Notes', defaultOn: false, component: TrainerNotesSection },
];
