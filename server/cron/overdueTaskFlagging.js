const cron = require('node-cron');
const Task = require('../models/Task');

/**
 * US-S01 – Proactive overdue task flagging
 * Runs every day at 00:01 and flags all non-Done tasks past their due date.
 * This complements the reactive check in getTasks, ensuring tasks are
 * visible as overdue even when no one fetches tasks overnight.
 */
cron.schedule('1 0 * * *', async () => {
  console.log('[CRON] Running overdue task flagging...');
  try {
    const result = await Task.updateMany(
      {
        dueDate:   { $lt: new Date() },
        status:    { $nin: ['Done', 'Completed'] },
        isOverdue: false
      },
      { $set: { isOverdue: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[CRON] Flagged ${result.modifiedCount} overdue task(s).`);
    }
  } catch (error) {
    console.error('[CRON] Overdue flagging error:', error);
  }
});
