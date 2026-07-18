const User = require('../models/User');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const Timesheet = require('../models/Timesheet');
const Leave = require('../models/Leave');

/**
 * US-M21 – Manager (or Admin) views a team member's full profile dashboard.
 * Returns: basic info + today's attendance + active task + task summary + leave balance.
 *
 * @route   GET /api/users/:id/profile
 * @access  Private (Admin / Manager of same team)
 */
exports.getMemberProfile = async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
      .select('-password')
      .populate('team', 'name manager');

    if (!member) return res.status(404).json({ message: 'User not found' });

    // Manager can only view members of their own team
    if (req.user.role === 'Manager' && member.team?._id?.toString() !== req.user.team?.toString()) {
      return res.status(403).json({ message: 'Access denied — not your team member' });
    }

    // Today's attendance
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.findOne({
      user: member._id,
      date: { $gte: today }
    });

    // Task summary (counts by status)
    const taskCounts = await Task.aggregate([
      { $match: { assignee: member._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const taskSummary = {};
    taskCounts.forEach(t => { taskSummary[t._id] = t.count; });

    // Currently active task
    const activeTask = await Task.findOne({ assignee: member._id, status: 'In Progress' })
      .populate('project', 'name')
      .select('title priority dueDate project');

    // Overdue tasks
    const overdueCount = await Task.countDocuments({ assignee: member._id, isOverdue: true, status: { $ne: 'Done' } });

    // Recent attendance (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAttendance = await Attendance.find({
      user: member._id,
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 });

    // Pending leave requests
    const pendingLeaves = await Leave.find({ user: member._id, status: 'Pending' })
      .select('leaveType startDate endDate');

    // Hours logged this month (from Timesheet)
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const monthHoursResult = await Timesheet.aggregate([
      { $match: { user: member._id, status: 'Approved', date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$hoursSpent' } } }
    ]);
    const monthHours = monthHoursResult[0]?.total || 0;

    res.json({
      member,
      todayAttendance,
      activeTask,
      taskSummary,
      overdueCount,
      recentAttendance,
      pendingLeaves,
      monthHours
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
