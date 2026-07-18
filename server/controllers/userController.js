const User = require('../models/User');
const Task = require('../models/Task');
const Team = require('../models/Team');
const Channel = require('../models/Channel');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const Timesheet = require('../models/Timesheet');
const Leave = require('../models/Leave');
const TrainerLog = require('../models/TrainerLog');
const Expense = require('../models/Expense');
const { sendApprovalEmail } = require('../utils/mailer');
const { seedLeaveBalances } = require('../cron/leaveBalanceReset');

// ─── Helper: sync a user into/out of team channels ───────────────────────────
const syncUserTeamChannel = async (userId, oldTeamId, newTeamId) => {
  const uid = userId.toString();

  // Remove from old team channel
  if (oldTeamId) {
    await Channel.findOneAndUpdate(
      { type: 'Team', team: oldTeamId },
      { $pull: { members: userId } }
    );
  }

  // Add to new team channel
  if (newTeamId) {
    await Channel.findOneAndUpdate(
      { type: 'Team', team: newTeamId },
      { $addToSet: { members: userId } }
    );
  }
};

// ─── Helper: broadcast project progress update via Socket.io ──────────────────
const broadcastProjectProgress = async (projectId, io) => {
  if (!projectId || !io) return;
  try {
    const totalTasks = await Task.countDocuments({ project: projectId });
    const completedTasks = await Task.countDocuments({ project: projectId, status: 'Done' });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    io.to(`project_${projectId}`).emit('projectProgressUpdated', {
      projectId,
      totalTasks,
      completedTasks,
      progress
    });
  } catch (_) { }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin (Manager sees own team)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.user.role === 'Manager') {
      filter.team = req.user.team;
    } else if (req.query.team) {
      filter.team = req.query.team;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.grade) filter.grade = req.query.grade;
    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .populate('team', 'name')
      .skip(skip)
      .limit(limit);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve user and assign role, team, grade, salary
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
exports.approveUser = async (req, res) => {
  try {
    const { role, team, grade, salaryRate } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'Pending') return res.status(400).json({ message: 'User is not in pending status' });

    const oldTeam = user.team;

    user.status = 'Active';
    user.role = role || 'Employee';
    if (team) {
      user.team = team;
      // Sync team channel membership
      await syncUserTeamChannel(user._id, oldTeam, team);
    }
    if (grade) user.grade = grade;
    if (salaryRate) user.salaryRate = salaryRate;

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    // Feature 1 – Seed leave balances for new user (run in background)
    seedLeaveBalances(user._id).catch(e => console.error('Leave seed error:', e.message));

    // Feature 3 – Send approval email (run in background)
    const runMailer = async () => {
      try {
        const teamDoc = team ? await Team.findById(team).select('name') : null;
        await sendApprovalEmail({
          to: user.email,
          fullName: user.fullName,
          role: user.role,
          teamName: teamDoc?.name || null
        });
      } catch (e) {
        console.error('Mailer error:', e.message);
      }
    };
    runMailer();

    // Notify all admins/managers in real time
    const io = req.app.get('io');
    if (io) io.emit('userApproved', { userId: user._id, fullName: user.fullName });

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reject user signup
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'Pending') return res.status(400).json({ message: 'User is not in pending status' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User signup rejected and removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user status (Deactivate / Reactivate)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Deactivated'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.status = status;
    await user.save();

    const io = req.app.get('io');

    if (status === 'Deactivated') {
      // 1. Flag all incomplete tasks for review
      await Task.updateMany(
        { assignee: user._id, status: { $ne: 'Done' } },
        { $set: { flaggedForReview: true } }
      );

      // 2. Release In-Progress tasks back to team pool (unassign them)
      const releasedTasks = await Task.find({ assignee: user._id, status: 'In Progress' });
      await Task.updateMany(
        { assignee: user._id, status: 'In Progress' },
        { $set: { assignee: null, status: 'To Do' } }
      );

      // 3. Remove from their team channel
      if (user.team) {
        await Channel.findOneAndUpdate(
          { type: 'Team', team: user.team },
          { $pull: { members: user._id } }
        );
      }

      // 4. Broadcast: recalculate progress for all affected projects
      if (io) {
        const projectIds = [...new Set(releasedTasks.map(t => t.project?.toString()).filter(Boolean))];
        for (const pid of projectIds) {
          await broadcastProjectProgress(pid, io);
        }
        // Notify the deactivated user's socket to force logout
        io.to(`user_${user._id}`).emit('forceLogout', { reason: 'Your account has been deactivated.' });
        // Notify admin dashboard of user list change
        io.emit('userStatusChanged', { userId: user._id, status });
      }
    } else if (status === 'Active') {
      // Re-add to team channel if they have a team
      if (user.team) {
        await Channel.findOneAndUpdate(
          { type: 'Team', team: user.team },
          { $addToSet: { members: user._id } }
        );
      }
      if (io) io.emit('userStatusChanged', { userId: user._id, status });
    }

    res.json({ message: `User status updated to ${status}`, userId: user._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user details (role, team, grade, salary)
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { fullName, role, team, grade, salaryRate } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const oldTeam = user.team;

    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (team !== undefined) {
      const newTeam = team || null;
      const oldTeamStr = oldTeam?.toString();
      const newTeamStr = newTeam?.toString();

      if (oldTeamStr !== newTeamStr) {
        // If they were a manager of a team, clear that
        await Team.updateMany({ manager: user._id }, { $unset: { manager: '' } });

        // Sync team channel membership
        await syncUserTeamChannel(user._id, oldTeam, newTeam);
      }
      user.team = newTeam;
    }
    if (grade !== undefined) user.grade = grade;
    if (salaryRate !== undefined) user.salaryRate = salaryRate;

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    // Notify all connected clients of the user update
    const io = req.app.get('io');
    if (io) io.emit('userUpdated', { userId: user._id, team: user.team, role: user.role, isTrainer: user.isTrainer });

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndDelete(req.params.id);

    // Remove from their team channel
    if (user.team) {
      await Channel.findOneAndUpdate(
        { type: 'Team', team: user.team },
        { $pull: { members: user._id } }
      );
    }

    // Force logout and notify
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user._id}`).emit('forceLogout', { reason: 'Your account has been deleted.' });
      io.emit('userStatusChanged', { userId: user._id, status: 'Deleted' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Export performance report CSV for a single employee
// @route   GET /api/users/:id/performance-csv?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Private/Admin
exports.exportPerformanceCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to query params are required.' });

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);
    if (isNaN(fromDate) || isNaN(toDate) || fromDate > toDate) return res.status(400).json({ message: 'Invalid date range.' });

    const userId = req.params.id;
    const user = await User.findById(userId).select('fullName email role grade team');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Fetch data
    const [attendanceRecs, timesheetRecs, leaveRecs, taskRecs, trainerLogs, expenses] = await Promise.all([
      Attendance.find({ user: userId, date: { $gte: fromDate, $lte: toDate } }).sort({ date: 1 }),
      Timesheet.find({ user: userId, date: { $gte: fromDate, $lte: toDate } }).populate('task', 'title').populate('project', 'name').sort({ date: 1 }),
      Leave.find({ user: userId, status: 'Approved', fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }),
      Task.find({ assignee: userId }).select('title status dueDate isOverdue').lean(),
      TrainerLog.find({ userId: userId, date: { $gte: fromDate, $lte: toDate } }).sort({ date: 1 }),
      Expense.find({ user: userId, date: { $gte: fromDate, $lte: toDate } })
    ]);

    // Setup helper maps
    const attByDate = {};
    attendanceRecs.forEach(r => attByDate[r.date.toISOString().split('T')[0]] = r);
    const logByDate = {};
    trainerLogs.forEach(r => logByDate[r.date.toISOString().split('T')[0]] = r);
    const expByDate = {};
    expenses.forEach(r => {
      const d = r.date.toISOString().split('T')[0];
      expByDate[d] = (expByDate[d] || 0) + (r.amount || 0);
    });
    const tsByDate = {};
    timesheetRecs.forEach(r => {
      const d = r.date.toISOString().split('T')[0];
      if (!tsByDate[d]) tsByDate[d] = [];
      tsByDate[d].push(r);
    });

    const isLeave = (d) => leaveRecs.some(l => d >= new Date(l.fromDate) && d <= new Date(l.toDate));

    // Calculate metrics
    let noOfDaysToBeWorked = 0;
    let noOfLeaves = 0;
    let holidayWorked = 0;
    let workingDays = 0;
    let breakSum = 0;
    let lateReporting = 0;
    let earlyLeaving = 0;

    let totalExp = 0;
    let totalDur = 0;
    let durCount = 0;

    const orgStats = {};

    const rows = [];
    const fromStr = fromDate.toLocaleDateString('en-IN').replace(/\//g, '-');
    const toStr = toDate.toLocaleDateString('en-IN').replace(/\//g, '-');

    const d = new Date(fromDate);
    while (d <= toDate) {
      const dStrLocal = d.toLocaleDateString('en-IN').replace(/\//g, '-');
      const dIso = d.toISOString().split('T')[0];

      const isSunday = d.getDay() === 0;
      const att = attByDate[dIso];
      const tlog = logByDate[dIso];
      const exp = expByDate[dIso] || 0;
      const tss = tsByDate[dIso] || [];

      const leave = isLeave(d);

      let holidayText = isSunday ? 'Sunday' : '';
      let clsWork = '';
      let mode = '';
      let sTime = '';
      let eTime = '';
      let dur = '';
      let brk = '';
      let hw = '';
      let org = '';
      let nts = '';

      if (leave) {
        noOfLeaves++;
        clsWork = 'Leave';
      } else {
        if (!isSunday) noOfDaysToBeWorked++;
      }

      if (tlog) {
        org = tlog.organisation || '';
        clsWork = tlog.type || '';
        mode = tlog.mode || '';
        sTime = tlog.startTime || '';
        eTime = tlog.endTime || '';
        dur = tlog.duration ? (tlog.duration / 60).toFixed(2) : '';
      }

      if (att) {
        if (!sTime) sTime = att.clockInTime ? new Date(att.clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
        if (!eTime) eTime = att.clockOutTime ? new Date(att.clockOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
        if (!dur) dur = att.totalHours ? att.totalHours.toFixed(2) : '';
        brk = att.totalBreakDurationMinutes ? (att.totalBreakDurationMinutes / 60).toFixed(2) : '';
        breakSum += (att.totalBreakDurationMinutes || 0) / 60;
      }

      if (!clsWork && !leave) {
        if (att) clsWork = 'Work';
        else if (isSunday) clsWork = 'Holiday';
      }

      if (att || tlog || tss.length > 0) {
        workingDays++;
        if (isSunday) {
          holidayWorked++;
          hw = dur;
        }
      }

      if (exp > 0) totalExp += exp;

      if (dur) {
        totalDur += parseFloat(dur);
        durCount++;
        if (!org) org = 'Office';
        if (org) {
          if (!orgStats[org]) orgStats[org] = { sum: 0, count: 0 };
          orgStats[org].sum += parseFloat(dur);
          orgStats[org].count++;
        }
      }

      if (tss.length > 0) {
        nts = tss.map(t => t.task?.title || t.notes).join(' | ');
      }
      if (tlog && tlog.notes) {
        nts = nts ? `${nts} | ${tlog.notes}` : tlog.notes;
      }

      rows.push([
        dStrLocal,
        user.fullName,
        holidayText,
        org,
        clsWork,
        mode,
        sTime,
        eTime,
        dur,
        exp || '',
        nts,
        brk,
        hw
      ]);

      d.setDate(d.getDate() + 1);
    }

    const avgBreak = workingDays > 0 ? (breakSum / workingDays).toFixed(2) : '0';
    const overallAvgDur = durCount > 0 ? (totalDur / durCount).toFixed(2) : '0';

    // Prepare grid 35 rows initially
    const grid = Array.from({ length: Math.max(35, rows.length + 3) }, () => Array(17).fill(''));

    grid[0][0] = 'Input';
    grid[0][4] = 'Attendance Details';

    grid[1][0] = 'Start Date'; grid[1][2] = fromStr;
    grid[1][4] = 'Date'; grid[1][5] = 'Name'; grid[1][6] = 'Holiday'; grid[1][7] = 'Organization'; grid[1][8] = 'Class/Work'; grid[1][9] = 'Mode'; grid[1][10] = 'Start Time'; grid[1][11] = 'End Time'; grid[1][12] = 'Duration'; grid[1][13] = 'Other Expenses'; grid[1][14] = 'Note'; grid[1][15] = 'Break'; grid[1][16] = 'Holiday Worked';

    grid[2][0] = 'End Date'; grid[2][2] = toStr;
    grid[3][0] = 'Employee Name'; grid[3][2] = user.fullName;

    grid[5][0] = 'Summary';
    grid[6][0] = 'No. of Days to be Worked'; grid[6][2] = noOfDaysToBeWorked;
    grid[7][0] = 'No. of Leaves'; grid[7][2] = noOfLeaves;
    grid[8][0] = 'Holiday worked'; grid[8][2] = holidayWorked;
    grid[9][0] = 'Working Days'; grid[9][2] = workingDays;
    grid[10][0] = 'Late Reporting'; grid[10][2] = lateReporting;
    grid[11][0] = 'Early Leaving'; grid[11][2] = earlyLeaving;
    grid[12][0] = 'Break'; grid[12][2] = breakSum.toFixed(2);
    grid[13][0] = 'Average Break Time'; grid[13][2] = avgBreak;
    grid[14][0] = 'Over Break Time'; grid[14][2] = '0';

    grid[16][0] = 'Accumulated';
    grid[17][0] = 'Start Date'; grid[17][2] = fromStr;
    grid[18][0] = 'Accumulated Leave'; grid[18][2] = '';
    grid[19][0] = 'Holiday Worked'; grid[19][2] = holidayWorked;

    grid[21][0] = 'Overall Avg Duration'; grid[21][2] = overallAvgDur;

    grid[23][0] = 'Total Expenses'; grid[23][2] = totalExp.toFixed(2);

    grid[25][0] = 'Organization'; grid[25][2] = 'Avg. Duration';

    let rIdx = 26;
    for (const [o, stats] of Object.entries(orgStats)) {
      grid[rIdx][0] = o;
      grid[rIdx][2] = (stats.sum / stats.count).toFixed(2);
      rIdx++;
    }

    // Fill attendance rows
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < 13; j++) {
        if (!grid[i + 2]) grid[i + 2] = Array(17).fill('');
        grid[i + 2][4 + j] = rows[i][j];
      }
    }

    const csvContent = grid.map(row => row.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');

    const safeUsername = (user.fullName || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeUsername}-performance-${from}-${to}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Export users as CSV
// @route   GET /api/users/export
// @access  Private/Admin
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find({}).populate('team', 'name').sort({ createdAt: -1 });

    const header = 'Name,Email,Role,Team,Grade,Status,Joined Date';
    const rows = users.map(u => {
      return [
        `"${(u.fullName || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        u.role || '',
        u.team ? `"${(u.team.name || '').replace(/"/g, '""')}"` : '',
        `"${(u.grade || '').replace(/"/g, '""')}"`,
        u.status || '',
        u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : ''
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
