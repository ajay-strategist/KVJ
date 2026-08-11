export interface EligibilityResult {
  eligible: boolean;
  assessmentEligible: boolean;
  attendanceConsidered: boolean;
  attendanceEligible: boolean | null;
  reason: string;
}

export function calculateFinalExamEligibility(
  student: any,
  rules?: {
    consider_attendance?: boolean;
    attendance_pass_percentage?: number;
    eligibility_criteria?: Array<{ assessment: string; threshold: number }>;
  }
): EligibilityResult {
  const fields = student?.custom_fields || student || {};
  
  // 1. Prerequisite Assessment Criteria
  let assessmentEligible = true;
  const criteria = rules?.eligibility_criteria || [];
  const failedAssessments: string[] = [];

  criteria
    .filter((crit) => crit.assessment !== 'finalExam')
    .forEach((crit) => {
      let score = 0;
      if (student?.assessmentScores?.[crit.assessment] !== undefined) {
        score = Number(student.assessmentScores[crit.assessment].marks ?? 0);
      } else if (fields[crit.assessment] !== undefined) {
        score = Number(fields[crit.assessment] ?? 0);
      } else if (student[crit.assessment] !== undefined) {
        score = Number(student[crit.assessment] ?? 0);
      }
      
      if (score < crit.threshold) {
        assessmentEligible = false;
        failedAssessments.push(crit.assessment.toUpperCase());
      }
    });

  // 2. Attendance Criteria
  const considerAttendance = rules?.consider_attendance ?? false;
  const attendanceThreshold = rules?.attendance_pass_percentage ?? 84;
  const studentAttPct = Number(fields.attendancePct ?? student?.attendancePct ?? 0);
  
  let attendanceEligible: boolean | null = null;
  if (considerAttendance) {
    attendanceEligible = studentAttPct >= attendanceThreshold;
  }

  // 3. Overall Eligibility
  const eligible = assessmentEligible && (considerAttendance ? (attendanceEligible ?? false) : true);

  // 4. Generate Reason
  let reason = 'Eligible';
  if (!eligible) {
    if (!assessmentEligible && considerAttendance && !attendanceEligible) {
      reason = `Failed prerequisites (${failedAssessments.join(', ')}) & Low attendance (<${attendanceThreshold}%)`;
    } else if (!assessmentEligible) {
      reason = `Failed prerequisite assessment(s): ${failedAssessments.join(', ')}`;
    } else if (considerAttendance && !attendanceEligible) {
      reason = `Low attendance (<${attendanceThreshold}%)`;
    }
  } else if (!considerAttendance) {
    reason = 'Eligible (Attendance not considered)';
  }

  return {
    eligible,
    assessmentEligible,
    attendanceConsidered: considerAttendance,
    attendanceEligible,
    reason,
  };
}
