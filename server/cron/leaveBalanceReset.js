const cron = require('node-cron');
const User = require('../models/User');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');

/**
 * Seed leave balances for a single user for the given year.
 * Called on user approval AND via the annual cron.
 */
exports.seedLeaveBalances = async (userId, year) => {
  const y = year || new Date().getFullYear();
  const leaveTypes = await LeaveType.find();
  for (const type of leaveTypes) {
    await LeaveBalance.findOneAndUpdate(
      { user: userId, leaveType: type._id, year: y },
      { $setOnInsert: { totalDays: type.daysPerYear, usedDays: 0 } },
      { upsert: true, new: true }
    );
  }
};

/**
 * Annual Reset – runs every Jan 1 at 00:05.
 * Creates fresh LeaveBalance records for ALL active users for the new year.
 * (Does NOT modify the previous year's records.)
 */
cron.schedule('5 0 1 1 *', async () => {
  console.log('[CRON] Running annual leave balance reset...');
  try {
    const year = new Date().getFullYear();
    const activeUsers = await User.find({ status: 'Active' }).select('_id');
    for (const u of activeUsers) {
      await exports.seedLeaveBalances(u._id, year);
    }
    console.log(`[CRON] Leave balances seeded for ${activeUsers.length} users (year ${year}).`);
  } catch (err) {
    console.error('[CRON] Leave balance reset error:', err.message);
  }
});
