const Task = require('../models/Task');
const WorkLog = require('../models/Timesheet'); // Same collection, renamed semantically
const { ensureCanStartTask } = require('../utils/taskStartAccess');

/**
 * Utility: broadcast timer state to the task's team room
 */
const broadcastTimer = (io, task) => {
  if (!io || !task.team) return;
  const teamId = task.team._id || task.team;
  io.to(`team_${teamId}`).emit('timerUpdate', {
    taskId: task._id,
    timer: task.timer
  });
};

// @desc    Start task timer
// @route   PUT /api/tasks/:id/timer/start
// @access  Private (assignee only)
exports.startTimer = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Only the assignee can control the timer
    if (!task.assignee || task.assignee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the task assignee can control the timer' });
    }

    if (task.timer.isRunning) {
      return res.status(400).json({ message: 'Timer is already running' });
    }

    const taskStartAccess = await ensureCanStartTask(req.user);
    if (!taskStartAccess.ok) {
      return res.status(taskStartAccess.status).json({ message: taskStartAccess.message });
    }

    // Constraint 2: Only one task running at a time
    const runningTask = await Task.findOne({
      _id: { $ne: task._id },
      'timer.isRunning': true,
      'timer.startedBy': req.user._id
    });

    if (runningTask) {
      return res.status(400).json({ message: `You already have an active task: "${runningTask.title}". Pause it first.` });
    }

    task.timer.isRunning = true;
    task.timer.startedAt = new Date();
    task.timer.startedBy = req.user._id;
    // Set task to In Progress automatically
    if (task.status === 'To Do') task.status = 'In Progress';

    await task.save();

    const io = req.app.get('io');
    broadcastTimer(io, task);

    res.json({ message: 'Timer started', timer: task.timer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Pause task timer (accumulates elapsed seconds)
// @route   PUT /api/tasks/:id/timer/pause
// @access  Private (assignee only)
exports.pauseTimer = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!task.timer.isRunning) {
      return res.status(400).json({ message: 'Timer is not running' });
    }

    const elapsed = Math.floor((new Date() - new Date(task.timer.startedAt)) / 1000);
    task.timer.totalSeconds += elapsed;
    task.timer.isRunning = false;
    task.timer.startedAt = null;

    await task.save();

    const io = req.app.get('io');
    broadcastTimer(io, task);

    res.json({ message: 'Timer paused', timer: task.timer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    End timer — saves a WorkLog entry automatically
// @route   PUT /api/tasks/:id/timer/end
// @access  Private (assignee only)
exports.endTimer = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Accumulate any remaining running seconds
    let totalSeconds = task.timer.totalSeconds;
    if (task.timer.isRunning && task.timer.startedAt) {
      totalSeconds += Math.floor((new Date() - new Date(task.timer.startedAt)) / 1000);
    }

    // Ensure even 1 minute is accurately recorded by increasing precision
    // and enforcing a minimum of 0.01 if totalSeconds > 0
    let hoursSpent = parseFloat((totalSeconds / 3600).toFixed(4));
    if (totalSeconds > 0 && hoursSpent === 0) hoursSpent = 0.01;

    // Create auto WorkLog entry (no approval needed)
    if (totalSeconds > 0) {
      await WorkLog.create({
        user:       req.user._id,
        task:       task._id,
        project:    task.project,
        date:       new Date(),
        hoursSpent: hoursSpent,
        notes:      req.body.notes || 'Logged via task timer',
        status:     'Approved'  // Auto-approved, no review needed
      });
    }

    // Reset timer
    task.timer = { isRunning: false, startedAt: null, totalSeconds: 0, startedBy: null };

    await task.save();

    const io = req.app.get('io');
    broadcastTimer(io, task);

    res.json({ message: 'Timer ended and work logged', hoursSpent, timer: task.timer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get live timer state for a task
// @route   GET /api/tasks/:id/timer
// @access  Private
exports.getTimer = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).select('timer title assignee');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task.timer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
