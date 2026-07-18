const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Expense = require('../models/Expense');
const TrainerLog = require('../models/TrainerLog');
const PublicHoliday = require('../models/PublicHoliday');

exports.getDetailedReport = async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId || !from || !to) {
      return res.status(400).json({ message: 'userId, from, and to are required' });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);

    const [user, attendance, leaves, expenses, trainerLogs, holidays] = 
      await Promise.all([
        User.findById(userId).select('fullName'),
        Attendance.find({
          user: userId,
          date: { $gte: fromDate, $lte: toDate }
        }).sort({ date: 1 }),
        Leave.find({
          user: userId,
          status: 'Approved',
          fromDate: { $lte: toDate },
          toDate: { $gte: fromDate }
        }),
        Expense.find({
          user: userId,
          $or: [
            { date: { $gte: fromDate, $lte: toDate } },
            { dateIncurred: { $gte: fromDate, $lte: toDate } }
          ]
        }),
        TrainerLog.find({
          userId,
          date: { $gte: fromDate, $lte: toDate }
        }).sort({ date: 1 }),
        PublicHoliday.find({
          date: { $gte: fromDate, $lte: toDate }
        })
      ]);

    // Build holiday date set
    const holidayMap = {};
    holidays.forEach(h => {
      const d = new Date(h.date).toISOString().split('T')[0];
      holidayMap[d] = h.name;
    });

    // Build leave date sets (half-day leaves are treated as worked days)
    const leaveDateSet = new Set();
    const halfDayLeaveDateSet = new Set();
    leaves.forEach(l => {
      if (l.isHalfDay) {
        const d = new Date(l.fromDate).toISOString().split('T')[0];
        halfDayLeaveDateSet.add(d);
      } else {
        let cur = new Date(l.fromDate);
        const end = new Date(l.toDate);
        while (cur <= end) {
          leaveDateSet.add(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    // Build expense map: dateStr -> total amount
    const expenseMap = {};
    expenses.forEach(e => {
      const d = new Date(e.date || e.dateIncurred);
      if (!d || isNaN(d)) return;
      const dateStr = d.toISOString().split('T')[0];
      expenseMap[dateStr] = (expenseMap[dateStr] || 0) + (e.amount || 0);
    });

    // Build trainer log map: dateStr -> log entry
    const trainerLogMap = {};
    trainerLogs.forEach(t => {
      const d = new Date(t.date).toISOString().split('T')[0];
      trainerLogMap[d] = t;
    });

    // Build attendance map: dateStr -> record
    const attendanceMap = {};
    attendance.forEach(a => {
      const d = new Date(a.date).toISOString().split('T')[0];
      attendanceMap[d] = a;
    });

    // Generate all dates in range
    const rows = [];
    let cur = new Date(fromDate);
    while (cur <= toDate) {
      const dateStr = cur.toISOString().split('T')[0];
      const dow = cur.getDay();
      const isSunday = dow === 0;
      const holidayName = holidayMap[dateStr] || null;
      const isHoliday = isSunday || !!holidayName;
      const isLeave = leaveDateSet.has(dateStr);
      const att = attendanceMap[dateStr] || null;
      const tlog = trainerLogMap[dateStr] || null;
      const expenseAmount = expenseMap[dateStr] || 0;

      // 12-hour time formatter (used for attendance clock times)
      const fmt12 = (date) => {
        if (!date) return '';
        const d = new Date(date);
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      };

      let duration = '';
      let durationMinutes = 0;
      let organisation = '';
      let classWork = '';
      let mode = '';
      let startTime = '';
      let endTime = '';
      let breakMins = 0;
      let breakHours = '';

      if (tlog) {
        // ── Trainer log takes full priority for this date ──────────────────
        organisation = tlog.organisation || '';
        classWork    = tlog.type         || '';
        mode         = tlog.mode         || '';
        startTime    = tlog.startTime    || '';
        endTime      = tlog.endTime      || '';

        // Use stored duration (minutes) from trainer log
        if (tlog.duration && tlog.duration > 0) {
          durationMinutes = tlog.duration;
          const h = Math.floor(durationMinutes / 60);
          const m = durationMinutes % 60;
          duration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        } else if (tlog.startTime && tlog.endTime) {
          // Fallback: parse HH:MM strings to derive duration
          const [sh, sm] = tlog.startTime.split(':').map(Number);
          const [eh, em] = tlog.endTime.split(':').map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            durationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
            const h = Math.floor(durationMinutes / 60);
            const m = durationMinutes % 60;
            duration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          }
        }

        // Break from attendance if available on the same day
        if (att && att.breaks && att.breaks.length > 0) {
          att.breaks.forEach(b => {
            if (b.breakInTime && b.breakOutTime) {
              breakMins += Math.floor((new Date(b.breakOutTime) - new Date(b.breakInTime)) / 60000);
            }
          });
        }
        if (breakMins === 0 && att && att.totalBreakDurationMinutes) {
          breakMins = Math.round(att.totalBreakDurationMinutes);
        }
        breakHours = breakMins > 0 ? `${Math.floor(breakMins / 60)}h ${breakMins % 60}m` : '';

      } else if (att && att.clockInTime) {
        // ── No trainer log — use attendance clock records ──────────────────
        organisation = 'Office';
        classWork    = 'Work';
        startTime    = fmt12(att.clockInTime);
        endTime      = att.clockOutTime ? fmt12(att.clockOutTime) : '';

        if (att.clockInTime && att.clockOutTime) {
          const ms = new Date(att.clockOutTime) - new Date(att.clockInTime);
          const totalMins = Math.floor(ms / 60000);
          durationMinutes = Math.max(0, totalMins);
          const h = Math.floor(durationMinutes / 60);
          const m = durationMinutes % 60;
          duration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }

        if (att.breaks && att.breaks.length > 0) {
          att.breaks.forEach(b => {
            if (b.breakInTime && b.breakOutTime) {
              breakMins += Math.floor((new Date(b.breakOutTime) - new Date(b.breakInTime)) / 60000);
            }
          });
        }
        if (breakMins === 0 && att.totalBreakDurationMinutes) {
          breakMins = Math.round(att.totalBreakDurationMinutes);
        }
        breakHours = breakMins > 0 ? `${Math.floor(breakMins / 60)}h ${breakMins % 60}m` : '';
      }

      // Full leave days: clear all work-log fields
      if (isLeave) {
        organisation  = '';
        classWork     = '';
        mode          = '';
        startTime     = '';
        endTime       = '';
        duration      = '';
        durationMinutes = 0;
        breakHours    = '';
        breakMins     = 0;
      }

      rows.push({
        date: dateStr,
        name: user.fullName,
        holiday: holidayName || (isSunday ? 'Sunday' : ''),
        organisation,
        classWork,
        mode,
        startTime,
        endTime,
        duration,
        durationMinutes,
        otherExpenses: expenseAmount > 0 
          ? expenseAmount.toFixed(2) 
          : '',
        breakHours,
        breakMins,
        isHoliday,
        isLeave,
        hasAttendance: isLeave ? false : (!!tlog || (!!att && !!att.clockInTime))
      });

      cur.setDate(cur.getDate() + 1);
    }

    // Summary calculations

    // Count Sundays in range
    let sundayCount = 0;
    let tempDate = new Date(fromDate);
    while (tempDate <= toDate) {
      if (tempDate.getDay() === 0) sundayCount++;
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Total calendar days in range
    const totalCalendarDays = Math.floor(
      (toDate - fromDate) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Count public holidays that are NOT Sundays
    const nonSundayHolidays = holidays.filter(h => {
      return new Date(h.date).getDay() !== 0;
    }).length;

    // Count approved non-half-day leave days within range
    let leaveDaysInRange = 0;
    leaves.forEach(l => {
      if (l.isHalfDay) return;
      let cur = new Date(l.fromDate > fromDate ? l.fromDate : fromDate);
      const end = new Date(l.toDate < toDate ? l.toDate : toDate);
      while (cur <= end) {
        if (cur.getDay() !== 0) leaveDaysInRange++;
        cur.setDate(cur.getDate() + 1);
      }
    });

    const workingDays = totalCalendarDays
      - sundayCount
      - nonSundayHolidays
      - leaveDaysInRange;


    // daysActuallyWorked = rows that have actual clock-in and clock-out
    const daysActuallyWorked = rows.filter(
      r => r.hasAttendance && r.durationMinutes > 0
    ).length;

    const totalDurationMins = rows.reduce(
      (sum, r) => sum + r.durationMinutes, 0
    );

    const avgDurationHrs = daysActuallyWorked > 0
      ? (totalDurationMins / daysActuallyWorked / 60).toFixed(2)
      : '0.00';

    const totalBreakMins = rows.reduce((sum, r) => sum + (r.breakMins || 0), 0);
    const avgBreakMins = workingDays > 0 
      ? (totalBreakMins / workingDays).toFixed(2) 
      : '0.00';

    const totalExpenses = expenses.reduce(
      (sum, e) => sum + (e.amount || 0), 0
    );

    // Avg duration by organisation
    const orgMap = {};
    rows.forEach(r => {
      if (!r.organisation || !r.durationMinutes) return;
      if (!orgMap[r.organisation]) orgMap[r.organisation] = { total: 0, count: 0 };
      orgMap[r.organisation].total += r.durationMinutes;
      orgMap[r.organisation].count += 1;
    });
    const orgAvgDurations = Object.entries(orgMap).map(([org, v]) => ({
      organisation: org,
      avgDuration: (v.total / v.count / 60).toFixed(2)
    }));

    res.json({
      employeeName: user.fullName,
      from,
      to,
      summary: {
        workingDays: Math.max(0, workingDays),
        totalLeaves: leaveDaysInRange,
        holidayWorked: rows.filter(r => r.isHoliday && r.hasAttendance).length,
        totalExpenses: totalExpenses.toFixed(2),
        avgDuration: avgDurationHrs,
        avgBreakMins,
        totalBreakMins: totalBreakMins.toFixed(2)
      },
      orgAvgDurations,
      rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.exportDetailedReportXlsx = async (req, res) => {
  // Returns CSV format for now — same data as getDetailedReport
  try {
    const { userId, from, to } = req.query;
    if (!userId || !from || !to) {
      return res.status(400).json({ message: 'userId, from, to required' });
    }

    // Reuse same data fetching logic
    const reportRes = await new Promise((resolve, reject) => {
      const fakeReq = { query: { userId, from, to } };
      const fakeRes = {
        json: resolve,
        status: () => ({ json: reject })
      };
      exports.getDetailedReport(fakeReq, fakeRes);
    });

    const headers = [
      'Date','Name','Holiday','Organisation','Class/Work',
      'Mode','Start Time','End Time','Duration',
      'Other Expenses','Break'
    ];

    const rows = reportRes.rows.map(r => [
      r.date, r.name, r.holiday, r.organisation,
      r.classWork, r.mode, r.startTime, r.endTime,
      r.duration, r.otherExpenses, r.breakHours
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const safeUser = (reportRes.employeeName || 'user')
      .replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 
      `attachment; filename="${safeUser}-${from}-${to}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
