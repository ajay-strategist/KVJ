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
  let overallAttendancePct = totalSessionPossible > 0 ? Math.round((totalSessionPresent / totalSessionPossible) * 100) : 0;
  if (totalSessionPossible === 0 && data.students.length > 0) {
    overallAttendancePct = Math.round(data.students.reduce((acc, st) => acc + (st.attendancePct || 0), 0) / data.students.length);
  }

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
  let overallAttendancePct = totalSessionPossible > 0 ? Math.round((totalSessionPresent / totalSessionPossible) * 100) : 0;
  if (totalSessionPossible === 0 && data.students.length > 0) {
    overallAttendancePct = Math.round(data.students.reduce((acc, st) => acc + (st.attendancePct || 0), 0) / data.students.length);
  }

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
  let attendancePct = totalStudentsSum > 0 ? Math.round((totalPresentSum / totalStudentsSum) * 100) : 0;
  if (totalStudentsSum === 0 && data.students.length > 0) {
    attendancePct = Math.round(data.students.reduce((acc, st) => acc + (st.attendancePct || 0), 0) / data.students.length);
  }

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

// ── Students Overview & Demographics Selectors ────────────────────────────────
export function selectDemographicBreakdowns(data: DailyReportData) {
  const total = data.totalStudents || data.students.length || 0;

  // Previous Qualification (Sorted Descending)
  const qualMap: Record<string, number> = {};
  data.students.forEach((s) => {
    const q = s.qualification?.trim() || 'Other';
    qualMap[q] = (qualMap[q] || 0) + 1;
  });

  const qualifications = Object.entries(qualMap)
    .map(([qual, count]) => ({
      qual,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Previous Course / Excel Knowledge
  const learnedCount = data.students.filter((s) => s.learnedBefore === 'Yes').length;
  const notLearnedCount = total - learnedCount;

  // Laptop Availability
  const hasLaptop = data.students.filter((s) => s.hasComputer === 'Yes').length;
  const noLaptop = total - hasLaptop;

  return {
    totalStudents: total,
    qualifications,
    learnedCount,
    notLearnedCount,
    learnedPct: total > 0 ? Math.round((learnedCount / total) * 100) : 0,
    notLearnedPct: total > 0 ? Math.round((notLearnedCount / total) * 100) : 0,
    hasLaptop,
    noLaptop,
    hasLaptopPct: total > 0 ? Math.round((hasLaptop / total) * 100) : 0,
    noLaptopPct: total > 0 ? Math.round((noLaptop / total) * 100) : 0,
  };
}

// ── Final Exam Analysis Selectors ──────────────────────────────────────────────
export function selectFinalExamDetailedAnalytics(data: DailyReportData) {
  const students = data.students;
  const totalStudents = data.totalStudents || students.length || 0;
  const examMax = data.courseMaxMarks || 100;
  const passMarks = Math.round(((data.finalExamPassMarkPercent || 70) / 100) * examMax);

  const attemptedStudents = students.filter(
    (s) => s.finalExamMark !== undefined || s.finalExamResult !== undefined
  );
  const totalAttempts = attemptedStudents.length || totalStudents;

  const passedStudents = students.filter(
    (s) => (s.finalExamMark ?? 0) >= passMarks || s.finalExamResult === 'Passed'
  );
  const failedStudents = students.filter(
    (s) => s.finalExamMark !== undefined && (s.finalExamMark ?? 0) < passMarks && s.finalExamResult !== 'Passed'
  );
  const notAttendedStudents = students.filter(
    (s) => s.finalExamMark === undefined && s.finalExamResult === undefined
  );

  const passedCount = passedStudents.length;
  const failedCount = failedStudents.length;
  const notAttendedCount = notAttendedStudents.length;

  const passPct = totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100) : 0;
  const maxMark = students.reduce((max, s) => Math.max(max, s.finalExamMark ?? 0), 0);
  const avgMark = totalStudents > 0 ? Math.round(students.reduce((acc, s) => acc + (s.finalExamMark ?? 0), 0) / totalStudents) : 0;

  // Batch breakdown
  const batchMap: Record<
    string,
    { total: number; passed: number; failed: number; notAttended: number; markSum: number }
  > = {};

  students.forEach((s) => {
    const b = s.batch?.trim() || data.batchCode || data.batchName || 'Batch 1';
    if (!batchMap[b]) batchMap[b] = { total: 0, passed: 0, failed: 0, notAttended: 0, markSum: 0 };
    batchMap[b].total += 1;
    batchMap[b].markSum += s.finalExamMark ?? 0;

    const isPass = s.finalExamResult ? s.finalExamResult === 'Passed' : (s.finalExamMark ?? 0) >= passMarks;
    if (s.finalExamMark === undefined && s.finalExamResult === undefined) {
      batchMap[b].notAttended += 1;
    } else if (isPass) {
      batchMap[b].passed += 1;
    } else {
      batchMap[b].failed += 1;
    }
  });

  const batchBreakdown = Object.entries(batchMap).map(([batch, stats]) => ({
    batch,
    total: stats.total,
    passed: stats.passed,
    failed: stats.failed,
    notAttended: stats.notAttended,
    passPct: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
    avgMark: stats.total > 0 ? Math.round(stats.markSum / stats.total) : 0,
  }));

  // Final Exam Mark Histogram (meaningful bins)
  const binStep = examMax > 100 ? 100 : 10;
  const numBins = Math.ceil(examMax / binStep);
  const histogramBuckets = Array.from({ length: numBins }, (_, i) => {
    const min = i * binStep;
    const max = Math.min((i + 1) * binStep - 1, examMax);
    const label = `${min}–${max}`;
    const count = students.filter((s) => {
      const m = s.finalExamMark ?? 0;
      return m >= min && (i === numBins - 1 ? m <= examMax : m <= max);
    }).length;
    return { label, count, min, max };
  });

  return {
    totalStudents,
    totalAttempts,
    passedCount,
    failedCount,
    notAttendedCount,
    passPct,
    maxMark,
    avgMark,
    examMax,
    passMarks,
    batchBreakdown,
    histogramBuckets,
  };
}

// ── Date-wise Final Exam Analytics ────────────────────────────────────────────
export function selectDatewiseFinalExamAnalytics(data: DailyReportData) {
  const students = data.students;
  const examMax = data.courseMaxMarks || 100;
  const passMarks = Math.round(((data.finalExamPassMarkPercent || 70) / 100) * examMax);

  const dateMap: Record<
    string,
    Record<string, { passed: number; failed: number; notAttended: number; total: number }>
  > = {};

  students.forEach((s) => {
    const date = s.finalExamDate || data.finalExamDate || data.reportDate || 'Date 1';
    const batch = s.batch?.trim() || data.batchCode || 'Batch 1';

    if (!dateMap[date]) dateMap[date] = {};
    if (!dateMap[date][batch]) {
      dateMap[date][batch] = { passed: 0, failed: 0, notAttended: 0, total: 0 };
    }

    const rec = dateMap[date][batch];
    rec.total += 1;

    const isPass = s.finalExamResult ? s.finalExamResult === 'Passed' : (s.finalExamMark ?? 0) >= passMarks;
    if (s.finalExamMark === undefined && s.finalExamResult === undefined) {
      rec.notAttended += 1;
    } else if (isPass) {
      rec.passed += 1;
    } else {
      rec.failed += 1;
    }
  });

  const dateList = Object.keys(dateMap).sort();

  const resultByDate = dateList.map((date) => {
    let passed = 0;
    let failed = 0;
    let notAttended = 0;
    let total = 0;

    Object.values(dateMap[date]).forEach((b) => {
      passed += b.passed;
      failed += b.failed;
      notAttended += b.notAttended;
      total += b.total;
    });

    const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { date, passed, failed, notAttended, total, passPct };
  });

  const countByDateAndBatch: Array<{ date: string; batch: string; count: number }> = [];
  dateList.forEach((date) => {
    Object.entries(dateMap[date]).forEach(([batch, rec]) => {
      countByDateAndBatch.push({ date, batch, count: rec.total });
    });
  });

  return {
    dateList,
    resultByDate,
    countByDateAndBatch,
  };
}

// ── Toppers Ranking Selector ──────────────────────────────────────────────────
// Priority 1: Earliest Day -> Priority 2: Highest Mark -> Priority 3: Lowest Exam Time
export function selectToppers(data: DailyReportData) {
  const examMax = data.courseMaxMarks || 100;

  const rankedStudents = [...data.students].sort((a, b) => {
    // Priority 1: Earliest Day
    const dateA = a.finalExamDate || data.finalExamDate || data.reportDate;
    const dateB = b.finalExamDate || data.finalExamDate || data.reportDate;
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // Priority 2: Highest Final Exam Mark
    const markA = a.finalExamMark ?? 0;
    const markB = b.finalExamMark ?? 0;
    if (markA !== markB) {
      return markB - markA;
    }

    // Priority 3: Lowest Exam Time (minutes)
    const timeA = a.finalExamTimeMinutes ?? 45;
    const timeB = b.finalExamTimeMinutes ?? 45;
    return timeA - timeB;
  });

  const top3 = rankedStudents.slice(0, 3).map((s, index) => {
    const rankLabel = index === 0 ? '1st' : index === 1 ? '2nd' : '3rd';
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    const mark = s.finalExamMark ?? 0;
    const timeMins = s.finalExamTimeMinutes ?? (35 + (index * 5));
    const date = s.finalExamDate || data.finalExamDate || data.reportDate;

    return {
      rank: index + 1,
      rankLabel,
      medal,
      student: s,
      mark,
      examMax,
      timeMins,
      date,
    };
  });

  const tableList = rankedStudents.map((s, index) => {
    const mockMark = s.mockMark ?? Math.round((s.finalExamMark ?? 0) * 0.95);
    const practiceTime = s.practiceTimeHours ?? Math.round((s.attendancePct / 100) * (s.totalSessions || 10) * 2);
    const timeMins = s.finalExamTimeMinutes ?? (35 + (index % 15));

    return {
      rank: index + 1,
      student: s,
      batch: s.batch || data.batchCode,
      mockMark,
      practiceTimeHours: practiceTime,
      finalExamMark: s.finalExamMark ?? 0,
      examMax,
      examTimeMinutes: timeMins,
    };
  });

  return {
    top3,
    tableList,
  };
}

// ── 100% Stacked Cross-Demographic Selectors ──────────────────────────────────
export function selectCrossDemographicPerformance(data: DailyReportData) {
  const students = data.students;
  const examMax = data.courseMaxMarks || 100;
  const passMarks = Math.round(((data.finalExamPassMarkPercent || 70) / 100) * examMax);

  const calcGroup = (groupStudents: StudentReportRow[]) => {
    const total = groupStudents.length;
    let passed = 0;
    let failed = 0;
    let notAttended = 0;

    groupStudents.forEach((s) => {
      const isPass = s.finalExamResult ? s.finalExamResult === 'Passed' : (s.finalExamMark ?? 0) >= passMarks;
      if (s.finalExamMark === undefined && s.finalExamResult === undefined) {
        notAttended++;
      } else if (isPass) {
        passed++;
      } else {
        failed++;
      }
    });

    return {
      total,
      passed,
      failed,
      notAttended,
      passedPct: total > 0 ? Math.round((passed / total) * 100) : 0,
      failedPct: total > 0 ? Math.round((failed / total) * 100) : 0,
      notAttendedPct: total > 0 ? Math.round((notAttended / total) * 100) : 0,
    };
  };

  // Gender vs Result
  const male = calcGroup(students.filter((s) => s.gender === 'Male'));
  const female = calcGroup(students.filter((s) => s.gender === 'Female'));

  // Laptop vs Result
  const haveLaptop = calcGroup(students.filter((s) => s.hasComputer === 'Yes'));
  const noLaptop = calcGroup(students.filter((s) => s.hasComputer !== 'Yes'));

  // Previous Knowledge vs Result
  const learned = calcGroup(students.filter((s) => s.learnedBefore === 'Yes'));
  const notLearned = calcGroup(students.filter((s) => s.learnedBefore !== 'Yes'));

  // Qualification vs Result
  const qualMap: Record<string, StudentReportRow[]> = {};
  students.forEach((s) => {
    const q = s.qualification?.trim() || 'Other';
    if (!qualMap[q]) qualMap[q] = [];
    qualMap[q].push(s);
  });

  const qualificationVsResult = Object.entries(qualMap).map(([qual, stList]) => ({
    qualification: qual,
    ...calcGroup(stList),
  }));

  return {
    genderVsResult: [
      { category: 'Male', ...male },
      { category: 'Female', ...female },
    ],
    laptopVsResult: [
      { category: 'Have Laptop', ...haveLaptop },
      { category: 'No Laptop', ...noLaptop },
    ],
    excelVsResult: [
      { category: 'Learned Excel', ...learned },
      { category: 'Did Not Learn Excel', ...notLearned },
    ],
    qualificationVsResult,
  };
}

// ── Mock vs Final Scatter Data Selector ───────────────────────────────────────
export function selectMockVsFinalScatterData(data: DailyReportData, mockAssessmentId?: string) {
  const examMax = data.courseMaxMarks || 100;
  const passMarks = Math.round(((data.finalExamPassMarkPercent || 70) / 100) * examMax);

  return data.students.map((s, idx) => {
    let mockMark = s.mockMark;
    if (mockMark === undefined && mockAssessmentId && s.assessmentScores[mockAssessmentId]) {
      mockMark = s.assessmentScores[mockAssessmentId].marks;
    }
    if (mockMark === undefined) {
      const scores = Object.values(s.assessmentScores).filter((sc) => sc.attempted);
      mockMark = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.marks, 0) / scores.length) : Math.round((s.finalExamMark ?? 70) * 0.9);
    }

    const mockAttempts = s.mockAttemptsCount ?? (Object.values(s.assessmentScores).filter((sc) => sc.attempted).length || 1);
    const mockTime = s.mockExamTimeMinutes ?? (30 + (idx % 20));
    const practiceTime = s.practiceTimeHours ?? Math.round((s.attendancePct / 100) * (s.totalSessions || 10) * 2.5);
    const finalMark = s.finalExamMark ?? 0;

    const isPass = s.finalExamResult ? s.finalExamResult === 'Passed' : finalMark >= passMarks;
    const status: 'Passed' | 'Failed' | 'Not Attended' =
      s.finalExamMark === undefined && s.finalExamResult === undefined ? 'Not Attended' : isPass ? 'Passed' : 'Failed';

    return {
      studentId: s.id,
      studentName: s.name,
      mockMark,
      mockAttempts,
      mockTime,
      practiceTime,
      finalMark,
      status,
    };
  });
}

