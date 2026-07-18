const Attendance = require('../models/Attendance');

const getTodayStart = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

const getActiveAttendance = async (userId) => {
  const today = getTodayStart();
  return Attendance.findOne({
    user: userId,
    date: { $gte: today },
    clockInTime: { $ne: null },
    clockOutTime: null
  });
};

const ensureCanStartTask = async (user) => {
  if (user.role === 'Admin') {
    return { ok: true, attendance: null };
  }

  const activeAttendance = await getActiveAttendance(user._id);
  if (!activeAttendance) {
    return {
      ok: false,
      status: 403,
      message: 'You must be clocked in to start a task.'
    };
  }

  const lastBreak = activeAttendance.breaks[activeAttendance.breaks.length - 1];
  if (lastBreak && !lastBreak.breakOutTime) {
    return {
      ok: false,
      status: 403,
      message: 'You cannot start a task while on break.'
    };
  }

  return { ok: true, attendance: activeAttendance };
};

module.exports = {
  ensureCanStartTask,
  getActiveAttendance
};
