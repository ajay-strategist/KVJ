const Timesheet = require('../models/Timesheet');

// @desc    Get all work log entries (admin only) with filters
// @route   GET /api/admin/worklog
// @access  Admin only
exports.getAdminWorklog = async (req, res) => {
  try {
    const filter = {};

    if (req.query.userId) {
      filter.user = req.query.userId;
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(`${req.query.from}T00:00:00`);
      if (req.query.to)   filter.date.$lte = new Date(`${req.query.to}T23:59:59`);
    }

    const entries = await Timesheet.find(filter)
      .populate('user', 'fullName')
      .populate('task', 'title')
      .populate('project', 'name')
      .sort({ date: -1 });

    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
