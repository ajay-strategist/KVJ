/**
 * Expense Analytics Excel Export Engine
 * Generates an 8-sheet enterprise workbook covering all 20 analytical metrics and audit trails.
 */

import * as XLSX from 'xlsx';

export interface ExportKpiData {
  academicYear: string;
  comparisonYear: string;
  totalExpenses: number;
  trainingExpenses: number;
  officeExpenses: number;
  totalStudents: number;
  costPerStudent: number;
  totalTrainingDays: number;
  costPerTrainingDay: number;
  batchesCovered: number;
  totalClaimsCount: number;
  priorYearTotalExpense: number;
  priorYearCostPerStudent: number;
  yoyExpenseDiff: number;
  yoyExpenseGrowthPct: number;
}

export interface ExportBatchRow {
  code: string;
  college: string;
  program: string;
  course: string;
  batchNo: string;
  totalExpense: number;
  studentCount: number;
  costPerStudent: number;
  trainingDays: number;
  costPerDay: number;
  sharePct: number;
  travelExpense: number;
  otherExpense: number;
  claimsCount: number;
}

export interface ExportTypeRow {
  type: string;
  category: string;
  amount: number;
  claimsCount: number;
  sharePct: number;
}

export interface ExportMonthRow {
  monthKey: string;
  monthLabel: string;
  officeExpense: number;
  trainingExpense: number;
  totalExpense: number;
  claimsCount: number;
}

export interface ExportEmployeeRow {
  name: string;
  role: string;
  claimsCount: number;
  totalAmount: number;
  avgClaim: number;
  sharePct: number;
}

export interface ExportTravelRow {
  batchCode: string;
  college: string;
  selfTravelBikeAmount: number;
  selfTravelBikeKm: number;
  selfTravelCarAmount: number;
  selfTravelCarKm: number;
  busAmount: number;
  metroAmount: number;
  autoAmount: number;
  uberAmount: number;
  totalTravelAmount: number;
  totalBatchExpense: number;
  travelSharePct: number;
}

export interface ExportMatrixData {
  batches: string[];
  types: string[];
  matrix: Record<string, Record<string, number>>; // batchCode -> type -> amount
  batchTotals: Record<string, number>;
  typeTotals: Record<string, number>;
  grandTotal: number;
}

export interface ExportYoyRow {
  college: string;
  program: string;
  course: string;
  currentBatch: string;
  currentStudents: number;
  currentExpense: number;
  currentCostPerStudent: number;
  priorBatch: string;
  priorStudents: number;
  priorExpense: number;
  priorCostPerStudent: number;
  varianceAmount: number;
  growthPct: number;
}

export interface ExportRawClaimRow {
  id: string;
  date: string;
  employeeName: string;
  category: string;
  expenseType: string;
  college: string;
  batchName: string;
  amount: number;
  vehicle?: string;
  km?: number;
  rate?: number;
  route?: string;
  status: string;
  notes?: string;
}

export interface ExportPayload {
  kpis: ExportKpiData;
  batches: ExportBatchRow[];
  types: ExportTypeRow[];
  monthly: ExportMonthRow[];
  employees: ExportEmployeeRow[];
  travel: ExportTravelRow[];
  matrix: ExportMatrixData;
  yoy: ExportYoyRow[];
  rawClaims: ExportRawClaimRow[];
}

export function exportExpenseAnalyticsToExcel(data: ExportPayload) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Executive KPI Summary ─────────────────────────────────────────
  const kpiRows = [
    { 'Metric Description': 'Academic Year Analyzed', 'Current Value': data.kpis.academicYear, 'Baseline / Prior Year': data.kpis.comparisonYear, 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Total Expenses (M1)', 'Current Value': data.kpis.totalExpenses, 'Baseline / Prior Year': data.kpis.priorYearTotalExpense, 'Variance': data.kpis.yoyExpenseDiff, 'Growth %': `${data.kpis.yoyExpenseGrowthPct.toFixed(1)}%` },
    { 'Metric Description': 'Training Expenses (M2)', 'Current Value': data.kpis.trainingExpenses, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Office Expenses', 'Current Value': data.kpis.officeExpenses, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Total Enrolled Students', 'Current Value': data.kpis.totalStudents, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Cost Per Student (M3)', 'Current Value': Number(data.kpis.costPerStudent.toFixed(2)), 'Baseline / Prior Year': Number(data.kpis.priorYearCostPerStudent.toFixed(2)), 'Variance': Number((data.kpis.costPerStudent - data.kpis.priorYearCostPerStudent).toFixed(2)), 'Growth %': data.kpis.priorYearCostPerStudent > 0 ? `${(((data.kpis.costPerStudent - data.kpis.priorYearCostPerStudent) / data.kpis.priorYearCostPerStudent) * 100).toFixed(1)}%` : '—' },
    { 'Metric Description': 'Total Active Training Days', 'Current Value': data.kpis.totalTrainingDays, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Cost Per Training Day (M4)', 'Current Value': Number(data.kpis.costPerTrainingDay.toFixed(2)), 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Batches Covered', 'Current Value': data.kpis.batchesCovered, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
    { 'Metric Description': 'Total Expense Claim Records', 'Current Value': data.kpis.totalClaimsCount, 'Baseline / Prior Year': '—', 'Variance': '—', 'Growth %': '—' },
  ];
  const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
  wsKpi['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, 'KPI Summary');

  // ── Sheet 2: Batch Analytics (M5, M6, M7, M13) ─────────────────────────────
  const batchRows = data.batches.map(b => ({
    'Batch Code': b.code,
    'College': b.college,
    'Program / Stream': b.program,
    'Course': b.course,
    'Batch No': b.batchNo,
    'Total Expense (₹)': b.totalExpense,
    'Students Enrolled': b.studentCount,
    'Cost / Student (₹)': Number(b.costPerStudent.toFixed(2)),
    'Training Days': b.trainingDays,
    'Cost / Day (₹)': Number(b.costPerDay.toFixed(2)),
    'Budget Share (%)': `${b.sharePct.toFixed(1)}%`,
    'Travel Spend (₹)': b.travelExpense,
    'Other Spend (₹)': b.otherExpense,
    'Claims Count': b.claimsCount,
  }));
  const wsBatch = XLSX.utils.json_to_sheet(batchRows);
  wsBatch['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsBatch, 'Batch Analysis');

  // ── Sheet 3: Expense Types Breakdown (M8) ──────────────────────────────────
  const typeRows = data.types.map(t => ({
    'Expense Type': t.type,
    'Category': t.category,
    'Total Amount (₹)': t.amount,
    'Claims Count': t.claimsCount,
    'Share of Total (%)': `${t.sharePct.toFixed(1)}%`,
  }));
  const wsType = XLSX.utils.json_to_sheet(typeRows);
  wsType['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsType, 'Expense Types');

  // ── Sheet 4: Monthly Trajectory (M9, M10) ──────────────────────────────────
  const monthRows = data.monthly.map(m => ({
    'Month': m.monthLabel,
    'Office Expense (₹)': m.officeExpense,
    'Training Expense (₹)': m.trainingExpense,
    'Total Expense (₹)': m.totalExpense,
    'Claims Count': m.claimsCount,
  }));
  const wsMonth = XLSX.utils.json_to_sheet(monthRows);
  wsMonth['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsMonth, 'Monthly Trajectory');

  // ── Sheet 5: Employee Leaderboard (M11) ────────────────────────────────────
  const empRows = data.employees.map(e => ({
    'Employee / Trainer Name': e.name,
    'Role': e.role,
    'Claims Count': e.claimsCount,
    'Total Claimed (₹)': e.totalAmount,
    'Average Per Claim (₹)': Number(e.avgClaim.toFixed(2)),
    'Share of Reimbursements (%)': `${e.sharePct.toFixed(1)}%`,
  }));
  const wsEmp = XLSX.utils.json_to_sheet(empRows);
  wsEmp['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Employee Breakdown');

  // ── Sheet 6: Travel Modality Analysis (M14) ────────────────────────────────
  const travelRows = data.travel.map(t => ({
    'Batch Code': t.batchCode,
    'College': t.college,
    'Bike Amount (₹)': t.selfTravelBikeAmount,
    'Bike Total KM': t.selfTravelBikeKm,
    'Car Amount (₹)': t.selfTravelCarAmount,
    'Car Total KM': t.selfTravelCarKm,
    'Bus (₹)': t.busAmount,
    'Metro (₹)': t.metroAmount,
    'Auto Rickshaw (₹)': t.autoAmount,
    'Uber / Cab (₹)': t.uberAmount,
    'Total Travel (₹)': t.totalTravelAmount,
    'Total Batch Spend (₹)': t.totalBatchExpense,
    'Travel Share (%)': `${t.travelSharePct.toFixed(1)}%`,
  }));
  const wsTravel = XLSX.utils.json_to_sheet(travelRows);
  wsTravel['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsTravel, 'Travel Modality');

  // ── Sheet 7: Batch x Type Cross-Tab Matrix (M12) ───────────────────────────
  const matrixRows: Record<string, any>[] = [];
  data.matrix.batches.forEach(bCode => {
    const row: Record<string, any> = { 'Batch Code': bCode };
    data.matrix.types.forEach(tName => {
      row[tName] = data.matrix.matrix[bCode]?.[tName] || 0;
    });
    row['Total (₹)'] = data.matrix.batchTotals[bCode] || 0;
    matrixRows.push(row);
  });
  // Grand Total row
  const totalRow: Record<string, any> = { 'Batch Code': 'TOTAL' };
  data.matrix.types.forEach(tName => {
    totalRow[tName] = data.matrix.typeTotals[tName] || 0;
  });
  totalRow['Total (₹)'] = data.matrix.grandTotal;
  matrixRows.push(totalRow);

  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
  wsMatrix['!cols'] = [{ wch: 36 }, ...data.matrix.types.map(() => ({ wch: 16 })), { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Batch x Type Matrix');

  // ── Sheet 8: Prior Year Academic Comparison (M15–M20) ──────────────────────
  const yoyRows = data.yoy.map(y => ({
    'College Name': y.college,
    'Program / Stream': y.program,
    'Program / Course': y.course,
    'Current Batch': y.currentBatch,
    'Current Students': y.currentStudents,
    'Current Expense (₹)': y.currentExpense,
    'Current Cost/Student (₹)': Number(y.currentCostPerStudent.toFixed(2)),
    'Prior Year Batch': y.priorBatch || '—',
    'Prior Students': y.priorStudents || 0,
    'Prior Expense (₹)': y.priorExpense || 0,
    'Prior Cost/Student (₹)': Number(y.priorCostPerStudent.toFixed(2)),
    'Variance (₹)': y.varianceAmount,
    'YoY Growth (%)': y.priorExpense > 0 ? `${y.growthPct.toFixed(1)}%` : 'New Baseline',
  }));
  const wsYoy = XLSX.utils.json_to_sheet(yoyRows);
  wsYoy['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsYoy, 'YoY Comparison');

  // ── Sheet 9: Raw Claims Transaction Audit Trail ───────────────────────────
  const rawRows = data.rawClaims.map(c => ({
    'Claim ID': c.id,
    'Date': c.date,
    'Employee Name': c.employeeName,
    'Category': c.category,
    'Expense Type': c.expenseType,
    'College': c.college || '—',
    'Batch Name': c.batchName || '—',
    'Amount (₹)': c.amount,
    'Vehicle': c.vehicle || '—',
    'Kilometers': c.km ?? '—',
    'Rate (₹/km)': c.rate ?? '—',
    'Travel Route': c.route || '—',
    'Status': c.status,
    'Notes': c.notes || '',
  }));
  const wsRaw = XLSX.utils.json_to_sheet(rawRows);
  wsRaw['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Claims Data');

  // Trigger download
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `KVJ_Expense_Analytics_${data.kpis.academicYear.replace(/[^a-zA-Z0-9-]/g, '_')}_${dateStamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}
