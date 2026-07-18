const cron = require('node-cron');
const Attendance = require('../models/Attendance');

// Run at 23:59 every day (FR-06.8 & FR-06.9)
cron.schedule('59 23 * * *', async () => {
  console.log('Running auto clock-out cron job...');
  try {
    // Find ALL open sessions (any date) — catches stale sessions from previous days too
    const activeAttendances = await Attendance.find({
      clockOutTime: null
    });

    const now = new Date();

    for (let attendance of activeAttendances) {
      if (attendance.breaks.length > 0 && !attendance.breaks[attendance.breaks.length - 1].breakOutTime) {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        lastBreak.breakOutTime = now;
        const breakDurationMs = now.getTime() - new Date(lastBreak.breakInTime).getTime();
        attendance.totalBreakDurationMinutes += breakDurationMs / (1000 * 60);
      }

      attendance.clockOutTime = now;
      attendance.label = 'Auto-closed'; // FR-06.10
      
      const clockInMs = new Date(attendance.clockInTime).getTime();
      const clockOutMs = now.getTime();
      const breakMs = attendance.totalBreakDurationMinutes * 60 * 1000;
      
      attendance.totalHours = ((clockOutMs - clockInMs) - breakMs) / (1000 * 60 * 60);

      await attendance.save();
      console.log(`Auto clocked out user ${attendance.user}`);
    }
  } catch (error) {
    console.error('Error in auto clock-out cron job:', error);
  }
});
