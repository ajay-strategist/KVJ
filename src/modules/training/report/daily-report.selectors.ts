/**
 * Daily Report Selectors — Pure Functions
 * All mathematical calculations, KPIs, groupings, and risk metrics live HERE.
 */

import type { DailyReportData, StudentReportRow, SessionAttendanceRecord } from './daily-report.types';

// ── Executive Summary KPIs (Requested exact list) ────────────────────────────
export function selectExecutiveKPIs(data: DailyReportData) {
  const totalStudents = data.totalStudents || data.students.length || 0;

  // Gender Distribution
  const maleCount = data.students.filter((s) => s.gender === 'Male').length;
  const femaleCount = data.students.filter((s) => s.gender === 'Female').length;
  const malePct = totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePct = totalStudents > 0 ? Math.round((femaleCount / totalStudents) * 100) : 0;

  // Laptop / Computer Ownership
  const hasLaptopCount = data.students.filter((s) => s.hasComputer === 'Yes').length;
  const noLaptopCount = totalStudents - hasLaptopCount;
  const hasLaptopPct = totalStudents > 0 ? Math.round((hasLaptopCount / totalStudents) * 100) : 0;

  // Previous Knowledge
  const learnedBeforeCount = data.students.filter((s) => s.learnedBefore === 'Yes').length;
  const newLearnerCount = totalStudents - learnedBeforeCount;
  const learnedBeforePct = totalStudents > 0 ? Math.round((learnedBeforeCount / totalStudents) * 100) : 0;

  // Overall Attendance %
  const totalSessionPresent = data.sessions.reduce((acc, s) => acc + s.presentCount, 0);
  const totalSessionPossible = data.sessions.reduce((acc, s) => acc + s.totalStudents, 0);
  const overallAttendancePct = totalSessionPossible > 0 ? Math.round((totalSessionPresent / totalSessionPossible) * 100) : 0;

  // Final Exam Eligibility
  const eligibleCount = data.students.filter((st) => st.finalExamEligibility === 'Eligible').length;
  const notEligibleCount = totalStudents - eligibleCount;
  const finalExamEligibilityRatePct = totalStudents > 0 ? Math.round((eligibleCount / totalStudents) * 100) : 0;

  return {
    totalStudents,
    maleCount,
    femaleCount,
    malePct,
    femalePct,
    hasLaptopCount,
    noLaptopCount,
    hasLaptopPct,
    learnedBeforeCount,
    newLearnerCount,
    learnedBeforePct,
    overallAttendancePct,
    eligibleCount,
    notEligibleCount,
    finalExamEligibilityRatePct,
  };
}

// ── Cover Hero KPIs (7 tiles) ────────────────────────────────────────────────
export function selectCoverHeroKPIs(data: DailyReportData) {
  const totalStudents = data.totalStudents || data.students.length || 0;
  
  // Overall Attendance %
  const totalSessionPresent = data.sessions.reduce((acc, s) => acc + s.presentCount, 0);
  const totalSessionPossible = data.sessions.reduce((acc, s) => acc + s.totalStudents, 0);
  const overallAttendancePct = totalSessionPossible > 0 ? Math.round((totalSessionPresent / totalSessionPossible) * 100) : 0;

  // Present & Absent (Latest session)
  const latestSession = data.sessions[data.sessions.length - 1];
  const presentToday = latestSession ? latestSession.presentCount : 0;
  const absentToday = latestSession ? latestSession.absentCount : 0;

  // Assessment Progress %
  const totalAssessmentsPossible = data.assessments.length * totalStudents;
  let totalAttempted = 0;
  data.students.forEach((st) => {
    Object.values(st.assessmentScores).forEach((sc) => {
      if (sc.attempted) totalAttempted++;
    });
  });
  const assessmentProgressPct = totalAssessmentsPossible > 0 ? Math.round((totalAttempted / totalAssessmentsPossible) * 100) : 0;

  // Training Completion %
  const completedMilestones = data.progressMilestones.filter((m) => m.status === 'Completed').length;
  const totalMilestones = data.progressMilestones.length;
  const trainingCompletionPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  // Eligible Students
  const eligibleCount = data.students.filter((st) => st.finalExamEligibility === 'Eligible').length;

  return {
    overallAttendancePct,
    assessmentProgressPct,
    trainingCompletionPct,
    totalStudents,
    presentToday,
    absentToday,
    eligibleCount,
  };
}

// ── Executive Summary KPIs ───────────────────────────────────────────────────
export function selectExecutiveSummaryKPIs(data: DailyReportData) {
  const hero = selectCoverHeroKPIs(data);
  const eligibleCount = hero.eligibleCount;
  const notEligibleCount = hero.totalStudents - eligibleCount;

  const assessmentsCompletedToday = data.assessments.filter((a) => {
    return data.students.every((st) => st.assessmentScores[a.id]?.attempted);
  }).length;

  let pendingAssessmentsCount = 0;
  data.students.forEach((st) => {
    data.assessments.forEach((a) => {
      if (!st.assessmentScores[a.id]?.attempted) pendingAssessmentsCount++;
    });
  });

  const pendingTasksCount = data.progressMilestones.filter((m) => m.status !== 'Completed').length;

  return {
    totalStudents: hero.totalStudents,
    present: hero.presentToday,
    absent: hero.absentToday,
    attendancePct: hero.overallAttendancePct,
    assessmentsCompletedToday,
    eligibleForFinalExam: eligibleCount,
    notEligible: notEligibleCount,
    pendingAssessments: pendingAssessmentsCount,
    pendingTasks: pendingTasksCount,
  };
}

// ── Attendance Summary KPIs ──────────────────────────────────────────────────
export function selectAttendanceKPIs(data: DailyReportData) {
  const latestSession = data.sessions[data.sessions.length - 1];
  const present = latestSession ? latestSession.presentCount : 0;
  const absent = latestSession ? latestSession.absentCount : 0;
  
  const totalPresentSum = data.sessions.reduce((acc, s) => acc + s.presentCount, 0);
  const totalStudentsSum = data.sessions.reduce((acc, s) => acc + s.totalStudents, 0);
  const attendancePct = totalStudentsSum > 0 ? Math.round((totalPresentSum / totalStudentsSum) * 100) : 0;

  const lateEntries = data.sessions.reduce((acc, s) => acc + s.lateCount, 0);
  const earlyCheckouts = 0; // standard default

  const sessionPcts = data.sessions.map((s) => s.attendancePct);
  const averageAttendance = sessionPcts.length > 0 ? Math.round(sessionPcts.reduce((a, b) => a + b, 0) / sessionPcts.length) : 0;
  const highestAttendance = sessionPcts.length > 0 ? Math.max(...sessionPcts) : 0;
  const lowestAttendance = sessionPcts.length > 0 ? Math.min(...sessionPcts) : 0;

  return {
    present,
    absent,
    attendancePct,
    lateEntries,
    earlyCheckouts,
    averageAttendance,
    highestAttendance,
    lowestAttendance,
  };
}

// ── Per Selected Assessment KPIs ─────────────────────────────────────────────
export function selectAssessmentKPIs(data: DailyReportData, assessmentId: string) {
  const assessment = data.assessments.find((a) => a.id === assessmentId);
  const passMarkPercent = assessment ? assessment.passMarkPercent : 84;
  const totalStudents = data.students.length;

  let completed = 0;
  let pending = 0;
  let failed = 0;
  let notAttempted = 0;
  const scores: number[] = [];

  data.students.forEach((st) => {
    const sc = st.assessmentScores[assessmentId];
    if (!sc || !sc.attempted) {
      notAttempted++;
      pending++;
    } else {
      completed++;
      const markPct = Math.round((sc.marks / sc.maxMarks) * 100);
      scores.push(markPct);
      if (markPct >= passMarkPercent) {
        // Passed
      } else {
        failed++;
      }
    }
  });

  const averageMark = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highestMark = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestMark = scores.length > 0 ? Math.min(...scores) : 0;
  const passPct = completed > 0 ? Math.round(((completed - failed) / completed) * 100) : 0;
  const completionPct = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;

  return {
    assessmentId,
    title: assessment?.title || 'Assessment',
    passMarkPercent,
    isCustomPassMark: assessment?.isCustomPassMark || false,
    totalStudents,
    completed,
    pending,
    failed,
    notAttempted,
    averageMark,
    highestMark,
    lowestMark,
    passPct,
    completionPct,
  };
}

// ── Date-Wise Assessment Status Selector ──────────────────────────────────────
export interface DatewiseAssessmentProgressRow {
  date: string;
  attemptedToday: number;
  passedToday: number;
  dayPassPct: number;
  cumulativePassed: number;
  cumulativeAttempted: number;
  enrolledTotal: number;
  cumulativePassPct: number;
}

export function selectDatewiseAssessmentStatus(data: DailyReportData, assessmentId: string): DatewiseAssessmentProgressRow[] {
  const assessment = data.assessments.find((a) => a.id === assessmentId);
  const passMarkPercent = assessment ? assessment.passMarkPercent : 84;
  const enrolledTotal = data.totalStudents || data.students.length || 0;

  // Flatten all attempts for this assessment: { studentId, date, marks }
  const rawAttempts: Array<{ studentId: string; date: string; marks: number; maxMarks: number }> = [];

  data.students.forEach((st) => {
    const sc = st.assessmentScores[assessmentId];
    if (sc && sc.attempted) {
      if (sc.attempts && sc.attempts.length > 0) {
        sc.attempts.forEach((att) => {
          rawAttempts.push({
            studentId: st.id,
            date: att.date,
            marks: att.marks,
            maxMarks: att.maxMarks || sc.maxMarks || 100,
          });
        });
      } else if (sc.date) {
        rawAttempts.push({
          studentId: st.id,
          date: sc.date,
          marks: sc.marks,
          maxMarks: sc.maxMarks || 100,
        });
      } else {
        // Fallback: assign to the first session date if missing
        const fallbackDate = data.sessions[0]?.date || data.reportDate;
        rawAttempts.push({
          studentId: st.id,
          date: fallbackDate,
          marks: sc.marks,
          maxMarks: sc.maxMarks || 100,
        });
      }
    }
  });

  // Extract unique sorted dates where at least 1 attempt took place
  const uniqueDates = Array.from(new Set(rawAttempts.map((a) => a.date))).sort();

  if (uniqueDates.length === 0) return [];

  const result: DatewiseAssessmentProgressRow[] = [];

  uniqueDates.forEach((date) => {
    // Attempts on this specific date
    const attemptsToday = rawAttempts.filter((a) => a.date === date);
    const attemptedTodayStudents = Array.from(new Set(attemptsToday.map((a) => a.studentId)));
    const attemptedToday = attemptedTodayStudents.length;

    // RULE: "if a day they didn't attend the assessment (no one attended do not show that date)"
    if (attemptedToday === 0) return;

    // For students who attempted today, calculate their highest mark ON this date
    let passedToday = 0;
    attemptedTodayStudents.forEach((stId) => {
      const stTodayAttempts = attemptsToday.filter((a) => a.studentId === stId);
      const highestMarkToday = Math.max(...stTodayAttempts.map((a) => Math.round((a.marks / a.maxMarks) * 100)));
      if (highestMarkToday >= passMarkPercent) {
        passedToday++;
      }
    });

    const dayPassPct = attemptedToday > 0 ? Math.round((passedToday / attemptedToday) * 100) : 0;

    // All attempts up to and including this date
    const attemptsUpToDate = rawAttempts.filter((a) => a.date <= date);
    const uniqueStudentsUpToDate = Array.from(new Set(attemptsUpToDate.map((a) => a.studentId)));
    const cumulativeAttempted = uniqueStudentsUpToDate.length;

    // RULE: "(Some time they will attend 2 times and passed but show only the highest mark of that student)"
    let cumulativePassed = 0;
    uniqueStudentsUpToDate.forEach((stId) => {
      const stCumulativeAttempts = attemptsUpToDate.filter((a) => a.studentId === stId);
      const highestMarkUpToDate = Math.max(...stCumulativeAttempts.map((a) => Math.round((a.marks / a.maxMarks) * 100)));
      if (highestMarkUpToDate >= passMarkPercent) {
        cumulativePassed++;
      }
    });

    // Current Pass % (based on enrolledTotal)
    const cumulativePassPct = enrolledTotal > 0 ? Math.round((cumulativePassed / enrolledTotal) * 100) : 0;

    result.push({
      date,
      attemptedToday,
      passedToday,
      dayPassPct,
      cumulativePassed,
      cumulativeAttempted,
      enrolledTotal,
      cumulativePassPct,
    });
  });

  return result;
}

// ── Score Histogram Buckets (0-9, 10-19, ..., 90-100) ─────────────────────────
export function selectScoreHistogramBuckets(data: DailyReportData, assessmentId: string) {
  const buckets = Array(10).fill(0);
  const labels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];

  data.students.forEach((st) => {
    const sc = st.assessmentScores[assessmentId];
    if (sc && sc.attempted) {
      const pct = Math.min(Math.max(Math.round((sc.marks / sc.maxMarks) * 100), 0), 100);
      const idx = Math.min(Math.floor(pct / 10), 9);
      buckets[idx]++;
    }
  });

  return labels.map((label, i) => ({ label, count: buckets[i] }));
}

// ── Final Exam Eligibility KPIs ──────────────────────────────────────────────
export function selectEligibilityKPIs(data: DailyReportData, selectedAssessmentIds: string[]) {
  const total = data.students.length;
  const eligibleCount = data.students.filter((st) => st.finalExamEligibility === 'Eligible').length;
  const notEligibleCount = total - eligibleCount;
  const eligibilityPct = total > 0 ? Math.round((eligibleCount / total) * 100) : 0;

  const requiredAssessments = data.assessments
    .filter((a) => selectedAssessmentIds.includes(a.id))
    .map((a) => ({
      title: a.title,
      passMarkPercent: a.passMarkPercent,
      isCustomPassMark: a.isCustomPassMark,
    }));

  return {
    totalStudents: total,
    eligibleCount,
    notEligibleCount,
    eligibilityPct,
    requiredAssessments,
  };
}

// ── Date-wise Absent Students List ───────────────────────────────────────────
export function selectDatewiseAbsentStudents(data: DailyReportData) {
  return data.sessions.map((sess) => {
    const absentStudents = data.students.filter((st) => sess.absentStudentIds.includes(st.id));
    return {
      date: sess.date,
      attendancePct: sess.attendancePct,
      isWarning: sess.attendancePct < 75,
      absentStudents,
    };
  });
}

// ── Failed / Not-Attended Students ───────────────────────────────────────────
export function selectFailedStudents(data: DailyReportData, selectedAssessmentIds: string[]) {
  const result: Array<{ student: StudentReportRow; failedAssessments: Array<{ title: string; score: number; passMark: number }> }> = [];

  data.students.forEach((st) => {
    const failedList: Array<{ title: string; score: number; passMark: number }> = [];
    selectedAssessmentIds.forEach((assId) => {
      const ass = data.assessments.find((a) => a.id === assId);
      const sc = st.assessmentScores[assId];
      if (ass && sc && sc.attempted && !sc.passed) {
        failedList.push({
          title: ass.title,
          score: sc.marks,
          passMark: ass.passMarkPercent,
        });
      }
    });
    if (failedList.length > 0) {
      result.push({ student: st, failedAssessments: failedList });
    }
  });

  return result;
}

export function selectNotAttendedStudents(data: DailyReportData, selectedAssessmentIds: string[]) {
  const result: Array<{ student: StudentReportRow; missedAssessments: string[] }> = [];

  data.students.forEach((st) => {
    const missedList: string[] = [];
    selectedAssessmentIds.forEach((assId) => {
      const ass = data.assessments.find((a) => a.id === assId);
      const sc = st.assessmentScores[assId];
      if (ass && (!sc || !sc.attempted)) {
        missedList.push(ass.title);
      }
    });
    if (missedList.length > 0) {
      result.push({ student: st, missedAssessments: missedList });
    }
  });

  return result;
}

// ── Risk Distribution Selector ───────────────────────────────────────────────
export function selectRiskDistribution(data: DailyReportData) {
  const counts = {
    'Low Attendance (<75%)': 0,
    'Failed Assessments': 0,
    'Pending Assessments': 0,
    'Multiple Issues': 0,
  };

  data.riskItems.forEach((item) => {
    if (counts[item.riskReason] !== undefined) {
      counts[item.riskReason]++;
    }
  });

  return [
    { reason: 'Low Attendance (<75%)', count: counts['Low Attendance (<75%)'], color: '#ef4444' },
    { reason: 'Failed Assessments', count: counts['Failed Assessments'], color: '#f59e0b' },
    { reason: 'Pending Assessments', count: counts['Pending Assessments'], color: '#3b82f6' },
    { reason: 'Multiple Issues', count: counts['Multiple Issues'], color: '#dc2626' },
  ];
}
