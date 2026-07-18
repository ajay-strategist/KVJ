const User = require('../models/User');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Expense = require('../models/Expense');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/dashboard/admin
// @access  Private (Admin)
exports.getAdminStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [
      totalUsers,
      totalProjects,
      completedProjects,
      todaysAttendance,
      pendingLeaves,
      pendingExpenses,
      allExpenses
    ] = await Promise.all([
      User.countDocuments({ status: 'Active' }),
      Project.countDocuments({}),
      Project.countDocuments({ status: 'Completed' }),
      Attendance.distinct('user', { 
        date: { $gte: todayStart, $lte: todayEnd },
        clockInTime: { $ne: null }
      }).then(users => users.length),
      Leave.find({ status: 'Pending' }).populate('user', 'fullName').sort({ createdAt: -1 }).limit(10),
      Expense.find({ status: 'Pending' }).populate('user', 'fullName').sort({ createdAt: -1 }).limit(10),
      Expense.find({ status: 'Pending' })
    ]);

    const totalPendingExpenseAmount = allExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    res.json({
      users: { total: totalUsers },
      projects: { total: totalProjects, completed: completedProjects },
      attendance: { todayCount: todaysAttendance },
      financials: { totalPendingExpenses: totalPendingExpenseAmount },
      pendingLeaves,
      pendingExpenses
    });

  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching admin stats', error: error.message });
  }
};
