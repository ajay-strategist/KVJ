const cron = require('node-cron');
const Task = require('../models/Task');

// Run daily at 02:00 UTC — FR-08.22
cron.schedule('0 2 * * *', async () => {
  console.log('[deleteOldArchivedTasks] Running daily archived task cleanup...');
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 365 days ago

    const result = await Task.deleteMany({
      archived: true,
      completedDate: { $lt: cutoffDate }
    });

    console.log(`[deleteOldArchivedTasks] Deleted ${result.deletedCount} archived tasks older than 1 year.`);
  } catch (error) {
    console.error('[deleteOldArchivedTasks] Error during cleanup:', error);
  }
});
