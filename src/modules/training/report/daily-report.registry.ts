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
import { TrainingDeliveryLogSection } from './sections/TrainingDeliveryLogSection';

export interface SectionDefinition {
  id: SectionId;
  label: string;
  category: 'Overview' | 'Attendance' | 'Assessments' | 'Eligibility' | 'Student Data' | 'Analytics & Notes';
  defaultOn: boolean;
  component: React.ComponentType<SectionProps>;
}

export const SECTIONS: SectionDefinition[] = [
  { id: 'executive-summary', label: '1. Executive Summary & Student Overview', category: 'Overview', defaultOn: true, component: ExecutiveSummarySection },
  { id: 'training-delivery-logs', label: '2. Training Delivery Log (Cumulative Hours)', category: 'Overview', defaultOn: true, component: TrainingDeliveryLogSection as any },
  { id: 'datewise-attendance', label: '3. Date-wise Attendance Log & Trend', category: 'Attendance', defaultOn: true, component: DatewiseAttendanceSection },
  { id: 'final-exam-eligibility', label: '4. Final Exam Eligibility Status', category: 'Eligibility', defaultOn: true, component: FinalExamEligibilitySection },
  { id: 'assessment-status', label: '5. Assessment Performance & Outcomes', category: 'Assessments', defaultOn: true, component: AssessmentStatusSection },
  { id: 'progress-analytics', label: '6. Dynamic Student Progress Analytics', category: 'Assessments', defaultOn: true, component: StudentProgressSection },
  { id: 'final-exam-results', label: '7. Final Exam Outcomes & Cross-Demographics', category: 'Assessments', defaultOn: true, component: FinalExamResultsSection },
  { id: 'toppers-overview', label: '8. Top Performing Students & Honor Roll', category: 'Assessments', defaultOn: true, component: ToppersSection },
  { id: 'mock-vs-final', label: '9. Mock Exam vs. Final Performance Correlation', category: 'Assessments', defaultOn: true, component: MockVsFinalSection },
  { id: 'student-data', label: '10. Master Student Data Directory', category: 'Student Data', defaultOn: true, component: StudentDataSection },
  { id: 'trainer-notes', label: '11. Trainer Observations & Notes', category: 'Analytics & Notes', defaultOn: false, component: TrainerNotesSection },
];
