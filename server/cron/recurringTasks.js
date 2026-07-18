const cron = require('node-cron');
const Task = require('../models/Task');

/**
 * US-M08 – Recurring task scheduler
 * Runs every day at 00:05 and creates new task instances
 * for any recurring task whose next due date has arrived.
 *
 * Supported frequencies:
 *   daily    – every day
 *   weekly   – same weekday each week
 *   monthly  – same day each month
 *   none     – no recurrence (skipped)
 */
cron.schedule('5 0 * * *', async () => {
  console.log('[CRON] Running recurring task scheduler...');
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find all active recurring tasks whose due date is today or in the past
    const recurringTasks = await Task.find({
      recurring: { $in: ['daily', 'weekly', 'monthly'] },
      status: { $ne: 'Done' },
      dueDate: { $lte: new Date() }
    });

    for (const task of recurringTasks) {
      // Calculate the next due date based on frequency
      const nextDue = new Date(task.dueDate);

      switch (task.recurring) {
        case 'daily':
          nextDue.setDate(nextDue.getDate() + 1);
          break;
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
      }

      // Create a new task instance with reset status — preserve all other fields
      await Task.create({
        title:       task.title,
        description: task.description,
        category:    task.category,
        priority:    task.priority,
        status:      'To Do',
        project:     task.project,
        assignee:    task.assignee,
        team:        task.team,
        createdBy:   task.createdBy,
        dueDate:     nextDue,
        recurring:   task.recurring,
        isOverdue:   false
      });

      // Update the original task to point to the next cycle's due date
      task.dueDate = nextDue;
      task.status  = 'To Do';
      task.isOverdue = false;
      await task.save();

      console.log(`[CRON] Recurring task "${task.title}" re-scheduled to ${nextDue.toISOString().split('T')[0]}`);
    }
  } catch (error) {
    console.error('[CRON] Recurring task error:', error);
  }
});
