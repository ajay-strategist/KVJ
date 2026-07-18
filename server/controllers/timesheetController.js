const Timesheet = require('../models/Timesheet');
const User = require('../models/User');

// @desc    Log time to task
// @route   POST /api/timesheets
// @access  Private
exports.createTimesheet = async (req, res) => {
  try {
    const { task, project, date, hoursSpent, notes } = req.body;

    const timesheet = await Timesheet.create({
      user: req.user._id,
      task,
      project,
      date,
      hoursSpent,
      notes,
      status: 'Approved' // Feature 4: Work logs are auto-approved, no review needed
    });

    res.status(201).json(timesheet);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's timesheets
// @route   GET /api/timesheets/me
// @access  Private
exports.getMyTimesheets = async (req, res) => {
  try {
    let filter = { user: req.user._id };
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const timesheets = await Timesheet.find(filter)
      .populate('task', 'title')
      .populate('project', 'name')
      .sort({ date: -1 });
    res.json(timesheets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all team timesheets (Admin/Manager)
// @route   GET /api/timesheets
// @access  Private (Admin/Manager)
exports.getTeamTimesheets = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Manager') {
      const teamUsers = await User.find({ team: req.user.team }).select('_id');
      filter.user = { $in: teamUsers.map(u => u._id) };
    }
    
    // FR-11.11 Filter by specific employee (Admin sees all, Manager sees team only)
    if (req.query.userId) {
      const requestedUserId = req.query.userId;
      // For manager, ensure the requested user is in their team
      if (req.user.role === 'Manager') {
        const teamUserIds = filter.user?.$in || [];
        const isInTeam = teamUserIds.some(id => id.toString() === requestedUserId);
        if (isInTeam) filter.user = requestedUserId;
        // else ignore — can't filter outside their team
      } else {
        filter.user = requestedUserId;
      }
    }

    // FR-11.5 Filterable by date and project
    if (req.query.project) filter.project = req.query.project;
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setUTCHours(23, 59, 59, 999); // Include the entire end day
        filter.date.$lte = end;
      }
    }

    const timesheets = await Timesheet.find(filter)
      .populate('user', 'fullName grade')
      .populate('task', 'title')
      .populate('project', 'name')
      .sort({ date: -1 });
    res.json(timesheets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve/Reject timesheet
// @route   PUT /api/timesheets/:id/status
// @access  Private (Admin/Manager)
exports.updateTimesheetStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'Approved' or 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const timesheet = await Timesheet.findById(req.params.id).populate('user', 'salaryRate');

    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    timesheet.status = status;

    // US-S06 – cost = approved hours individual hourly rate
    if (status === 'Approved') {
      const rate = timesheet.user?.salaryRate || 0;
      timesheet.cost = parseFloat((timesheet.hoursSpent * rate).toFixed(2));
    } else {
      timesheet.cost = 0;
    }

    await timesheet.save();
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update timesheet (Employee only if pending)
// @route   PUT /api/timesheets/:id
// @access  Private
exports.updateTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) return res.status(404).json({ message: 'Not found' });
    if (timesheet.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    if (timesheet.status === 'Approved') return res.status(400).json({ message: 'Cannot edit approved timesheet' });

    const { hoursSpent, notes, date } = req.body;
    if (hoursSpent) timesheet.hoursSpent = hoursSpent;
    if (notes !== undefined) timesheet.notes = notes;
    if (date) timesheet.date = date;

    await timesheet.save();
    res.json(timesheet);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Delete timesheet (Employee only if pending)
// @route   DELETE /api/timesheets/:id
// @access  Private
exports.deleteTimesheet = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) return res.status(404).json({ message: 'Not found' });
    if (timesheet.user.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Timesheet.findByIdAndDelete(req.params.id);
    res.json({ message: 'Removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Export timesheets
// @route   GET /api/timesheets/export
// @access  Private/Admin
exports.exportTimesheets = async (req, res) => {
  try {
    let filter = {};
    const { scope } = req.query;

    if (scope === 'weekly') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      filter.date = { $gte: d };
    } else if (scope === 'monthly') {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      filter.date = { $gte: d };
    }

    const timesheets = await Timesheet.find(filter)
      .populate('user', 'fullName grade')
      .populate('task', 'title')
      .populate('project', 'name')
      .sort({ date: -1 });

    const header = 'Employee Name,Grade,Date,Task,Project,Hours Logged,Approval Status';
    const rows = timesheets.map(t => {
      return [
        `"${t.user?.fullName || ''}"`,
        t.user?.grade || '',
        t.date ? new Date(t.date).toISOString().split('T')[0] : '',
        `"${(t.task?.title || '').replace(/"/g, '""')}"`,
        `"${(t.project?.name || '').replace(/"/g, '""')}"`,
        t.hoursSpent,
        t.status
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheets_export.csv');
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
