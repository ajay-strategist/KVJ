const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const TaskTransfer = require('../models/TaskTransfer');
const Timesheet = require('../models/Timesheet');
const Project = require('../models/Project');
const User = require('../models/User');
const { ensureCanStartTask } = require('../utils/taskStartAccess');

// Helper: recalculate and broadcast project progress via Socket.io
const broadcastProjectProgress = async (projectId, io) => {
  if (!projectId || !io) return;
  try {
    const totalTasks = await Task.countDocuments({ project: projectId });
    const completedTasks = await Task.countDocuments({ project: projectId, status: 'Done' });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    io.to(`project_${projectId}`).emit('projectProgressUpdated', {
      projectId: projectId.toString(),
      totalTasks,
      completedTasks,
      progress
    });
  } catch (_) { }
};

// @desc    Get tasks with full filtering
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'Employee') {
      // Employee sees: tasks assigned to them OR unassigned pool tasks for their team
      filter = {
        $or: [
          { assignee: req.user._id },
          { assignee: null, team: req.user.team }
        ]
      };
    } else if (req.user.role === 'Manager') {
      // Manager sees all tasks for their team
      filter = { team: req.user.team };
    }
    // Admin: filter stays {} — sees all tasks

    // FR-08.9 Additional query filters (layered on top of role filter)
    if (req.query.project) filter.project = req.query.project;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignee) filter.assignee = req.query.assignee;
    // Team filter only allowed for Admin via query param
    if (req.query.team && req.user.role === 'Admin') filter.team = req.query.team;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.dueDate = {};
      if (req.query.dateFrom) filter.dueDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.dueDate.$lte = new Date(req.query.dateTo);
    }

    // FR-08.11 Auto-flag overdue tasks
    await Task.updateMany(
      { dueDate: { $lt: new Date() }, status: { $ne: 'Done' }, isOverdue: false },
      { $set: { isOverdue: true } }
    );

    // Always exclude archived tasks from the main list
    if (req.query.status === 'Done') {
      filter.archived = true;
    } else {
      filter.archived = false;
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName')
      .sort({ priority: 1, dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private (Admin/Manager create for team; Employee creates self-assigned tasks)
exports.createTask = async (req, res) => {
  try {
    if (req.user.role === 'Employee') {
      // Employee can only self-assign
      req.body.assignee = req.user._id;
      req.body.team = req.user.team;
  
      // If employee selected a project, verify they are a member of it
      if (req.body.project) {
        const project = await Project.findById(req.body.project);
        if (!project) {
          return res.status(404).json({ message: 'Project not found' });
        }
        const isMember = project.members.map(m => m.toString())
          .includes(req.user._id.toString());
        if (!isMember) {
          return res.status(403).json({
            message: 'You are not a member of this project'
          });
        }
      }
    } else {
      // Manager defaults to their own team if not specified
      if (!req.body.team && req.user.role === 'Manager') {
        req.body.team = req.user.team;
      }
      // Manager assigning to someone else requires admin approval.
      // Self-assignment (manager picks themselves) is allowed directly.
      const isSelfAssign = req.body.assignee &&
        req.body.assignee.toString() === req.user._id.toString();
      if (req.user.role === 'Manager' && req.body.assignee && !isSelfAssign) {
        req.body.pendingAssignee = req.body.assignee;
        req.body.assignee = null;
        req.body.managerApprovalPending = true;
      }
    }

    if (req.body.status === 'In Progress') {
      const taskStartAccess = await ensureCanStartTask(req.user);
      if (!taskStartAccess.ok) {
        return res.status(taskStartAccess.status).json({ message: taskStartAccess.message });
      }
    }

    req.body.createdBy = req.user._id;
    const task = await Task.create(req.body);

    const populated = await Task.findById(task._id)
      .populate('assignee', 'fullName')
      .populate('pendingAssignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    // Emit socket events for real-time notifications
    const io = req.app.get('io');
    if (io) {
      if (task.managerApprovalPending && task.pendingAssignee) {
        // Notify all admins of pending manager assignment
        io.emit('taskManagerPendingApproval', {
          taskId: task._id,
          taskTitle: task.title,
          managerName: req.user.fullName,
          pendingAssigneeId: task.pendingAssignee,
        });
      } else if (task.assignee) {
        // Directly assigned — notify the assignee
        io.to(`user_${task.assignee}`).emit('taskAssigned', {
          taskId: task._id,
          taskTitle: task.title,
          projectName: populated.project?.name || 'No Project',
          assignedBy: req.user.fullName,
        });
      } else if (task.team) {
        // Pool task — notify all team members
        io.to(`team_${task.team}`).emit('taskPooled', {
          taskId: task._id,
          taskTitle: task.title,
          projectName: populated.project?.name || 'No Project',
        });
      }
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // FR-08.19 — Status update restriction
    if (req.body.status !== undefined) {
      const isAssignee = task.assignee && task.assignee.toString() === req.user._id.toString();
      const isAdminOrManager = req.user.role === 'Admin' || req.user.role === 'Manager';
      // Unassigned pool tasks (assignee=null) can be updated by anyone
      if (!isAssignee && !isAdminOrManager && task.assignee !== null) {
        return res.status(403).json({ message: 'Only the assigned employee can update this task status.' });
      }
    }

    if (req.body.status === 'In Progress') {
      const taskStartAccess = await ensureCanStartTask(req.user);
      if (!taskStartAccess.ok) {
        return res.status(taskStartAccess.status).json({ message: taskStartAccess.message });
      }
    }

    // FR-08.8 Only one active task at a time — enforced for Employees only
    if (req.body.status === 'In Progress' && req.user.role === 'Employee') {
      await Task.updateMany(
        { assignee: req.user._id, status: 'In Progress', _id: { $ne: task._id } },
        { $set: { status: 'To Do' } }
      );
    }

    // FR-08.21 Auto-archive when status is set to 'Done'
    if (req.body.status === 'Done' && task.status !== 'Done') {
      req.body.archived = true;
      req.body.completedDate = new Date();
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    // Broadcast task update to team room so Kanban boards refresh live
    const io = req.app.get('io');
    if (io && updatedTask.team) {
      io.to(`team_${updatedTask.team._id || updatedTask.team}`).emit('taskUpdated', updatedTask);
    }
    // Recalculate and broadcast project progress if task has a project
    if (updatedTask.project) {
      await broadcastProjectProgress(updatedTask.project._id || updatedTask.project, io);
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private/Admin/Manager
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Manager can only delete tasks from their own team
    if (req.user.role === 'Manager' && task.team?.toString() !== req.user.team?.toString()) {
      return res.status(403).json({ message: 'Managers can only delete tasks from their own team' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Claim an unassigned pool task
// @route   PUT /api/tasks/:id/claim
// @access  Private
exports.claimTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.assignee) {
      return res.status(400).json({ message: 'This task is already assigned to someone.' });
    }

    // Employee can only claim tasks from their own team
    if (req.user.role === 'Employee' && task.team?.toString() !== req.user.team?.toString()) {
      return res.status(403).json({ message: 'You can only claim tasks from your own team' });
    }

    task.assignee = req.user._id;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name');

    // Broadcast claim to team room
    const io = req.app.get('io');
    if (io && populated.team) {
      io.to(`team_${populated.team._id || populated.team}`).emit('taskUpdated', populated);
    }

    // US-M03 – Notify the team manager that a pool task was claimed
    if (io && populated.team) {
      const Team = require('../models/Team');
      const team = await Team.findById(populated.team._id || populated.team).select('manager');
      if (team?.manager) {
        io.to(`user_${team.manager}`).emit('poolTaskClaimed', {
          taskId: task._id,
          taskTitle: task.title,
          claimedBy: req.user.fullName || req.user._id
        });
      }
    }

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Log time on a task
// @route   POST /api/tasks/:id/log-time
// @access  Private
exports.logTime = async (req, res) => {
  try {
    const { hours, notes } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Employees can only log time on tasks assigned to them
    if (req.user.role === 'Employee' && task.assignee?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only log time on tasks assigned to you' });
    }

    task.timeLogs.push({
      user: req.user._id,
      hours,
      notes,
      date: new Date()
    });
    await task.save();

    // FR-08.12 Feed into timesheet automatically
    await Timesheet.create({
      user: req.user._id,
      task: task._id,
      project: task.project,
      date: new Date(),
      hoursSpent: hours,
      notes: notes || '',
      status: 'Pending'
    });

    res.json({ message: 'Time logged successfully', timeLogs: task.timeLogs });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Export tasks as CSV
// @route   GET /api/tasks/export
// @access  Private/Admin
exports.exportTasks = async (req, res) => {
  try {
    let filter = {};
    const { scope } = req.query; // all, monthly, weekly

    if (scope === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filter.createdAt = { $gte: weekAgo };
    } else if (scope === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filter.createdAt = { $gte: monthAgo };
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .sort({ createdAt: -1 });

    // FR-08.14 CSV columns
    const header = 'Task ID,Title,Assignee,Team,Project,Category,Priority,Status,Due Date,Overdue,Created Date';
    const rows = tasks.map(t => {
      return [
        t._id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.assignee ? t.assignee.fullName : 'Unassigned',
        t.team ? t.team.name : '',
        t.project ? t.project.name : '',
        t.category || '',
        t.priority,
        t.status,
        t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
        t.isOverdue ? 'Yes' : 'No',
        new Date(t.createdAt).toISOString().split('T')[0]
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── FR-08.21 Archived Tasks ─────────────────────────────────────────────────

exports.getArchivedTasks = async (req, res) => {
  try {
    let filter = { archived: true };
    if (req.user.role === 'Employee' || req.user.role === 'Manager') {
      // Employees and Managers only see their own completed (archived) tasks
      filter.assignee = req.user._id;
    }
    // Admin: no additional filter — sees all archived tasks
    const tasks = await Task.find(filter)
      .populate('assignee', 'fullName')
      .populate('project', 'name')
      .populate('team', 'name')
      .sort({ completedDate: -1 });
    res.json(tasks);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── FR-08.17/18 Comments ────────────────────────────────────────────────────

exports.postComment = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.archived) return res.status(400).json({ message: 'Cannot comment on an archived task.' });

    const comment = await TaskComment.create({
      task: task._id,
      user: req.user._id,
      text: req.body.text
    });
    const populated = await TaskComment.findById(comment._id).populate('user', 'fullName');

    // Feature 6 — notify assignee via Socket.io (skip if commenter IS the assignee)
    const io = req.app.get('io');
    if (io && task.assignee) {
      const assigneeId  = task.assignee.toString();
      const commenterId = req.user._id.toString();
      if (assigneeId !== commenterId) {
        io.to(`user_${assigneeId}`).emit('task:comment', {
          taskId:         task._id,
          taskTitle:      task.title,
          commenterName:  req.user.fullName,
          commentPreview: (req.body.text || '').slice(0, 60)
        });
      }
    }

    res.status(201).json(populated);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getComments = async (req, res) => {
  try {
    const comments = await TaskComment.find({ task: req.params.id })
      .populate('user', 'fullName')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── FR-08.20 Transfer ───────────────────────────────────────────────────────

exports.initiateTransfer = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.archived) return res.status(400).json({ message: 'Cannot transfer an archived task.' });

    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ message: 'Recipient user ID is required.' });

    const recipient = await User.findById(toUserId);
    if (!recipient) return res.status(404).json({ message: 'Recipient user not found.' });

    await TaskTransfer.create({ task: task._id, fromUser: req.user._id, toUser: toUserId, adminStatus: 'Pending', status: 'Pending' });
    task.transferPending = true;
    task.transferStatus = 'Pending';
    await task.save();

    // Notify team and Admin via socket
    const io = req.app.get('io');
    if (io) {
      if (task.team) {
        const populatedTask = await Task.findById(task._id)
          .populate('assignee', 'fullName')
          .populate('project', 'name description')
          .populate('team', 'name')
          .populate('createdBy', 'fullName');
        io.to(`team_${task.team}`).emit('taskUpdated', populatedTask);
      }
      io.emit('taskTransferAdminReceived', {
        taskId: task._id,
        taskTitle: task.title,
        fromUser: req.user.fullName,
      });
    }

    res.json({ message: 'Transfer request sent for admin approval.', task });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.acceptTransfer = async (req, res) => {
  try {
    const transfer = await TaskTransfer.findOne({ task: req.params.id, status: 'Pending' });
    if (!transfer) return res.status(404).json({ message: 'No pending transfer found.' });
    if (transfer.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the recipient can accept this transfer.' });
    }
    transfer.status = 'Accepted';
    await transfer.save();

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignee: req.user._id, transferPending: false, transferStatus: 'None' },
      { new: true }
    )
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    const io = req.app.get('io');
    if (io) {
      // Broadcast updated task to the whole team
      if (task.team) io.to(`team_${task.team._id || task.team}`).emit('taskUpdated', task);
      // Notify the original sender that their transfer was accepted
      io.to(`user_${transfer.fromUser}`).emit('taskTransferAccepted', {
        taskId: task._id,
        taskTitle: task.title,
        acceptedBy: req.user.fullName,
      });
    }
    res.json({ message: 'Transfer accepted.', task });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.rejectTransfer = async (req, res) => {
  try {
    const transfer = await TaskTransfer.findOne({ task: req.params.id, status: 'Pending' });
    if (!transfer) return res.status(404).json({ message: 'No pending transfer found.' });
    if (transfer.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the recipient can reject this transfer.' });
    }
    transfer.status = 'Rejected';
    await transfer.save();

    const task = await Task.findByIdAndUpdate(req.params.id, { transferPending: false, transferStatus: 'None' }, { new: true })
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    const io = req.app.get('io');
    if (io) {
      // Broadcast updated task to the whole team so pending badge clears
      if (task?.team) io.to(`team_${task.team._id || task.team}`).emit('taskUpdated', task);
      // Notify the original sender that their transfer was rejected
      io.to(`user_${transfer.fromUser}`).emit('taskTransferRejected', {
        taskId: task._id,
        taskTitle: task.title,
        rejectedBy: req.user.fullName,
      });
    }
    res.json({ message: 'Transfer rejected.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getPendingTransfers = async (req, res) => {
  try {
    const transfers = await TaskTransfer.find({ toUser: req.user._id, status: 'Pending', adminStatus: 'Approved' })
      .populate('task', 'title status priority dueDate')
      .populate('fromUser', 'fullName')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAdminPendingTransfers = async (req, res) => {
  try {
    const transfers = await TaskTransfer.find({ adminStatus: 'Pending', status: 'Pending' })
      .populate('task', 'title status priority dueDate')
      .populate('fromUser', 'fullName')
      .populate('toUser', 'fullName')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.approveTransferAdmin = async (req, res) => {
  try {
    const transfer = await TaskTransfer.findOne({ task: req.params.id, adminStatus: 'Pending' }).populate('task');
    if (!transfer) return res.status(404).json({ message: 'No pending transfer found for admin.' });
    transfer.adminStatus = 'Approved';
    await transfer.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${transfer.toUser}`).emit('taskTransferReceived', {
        taskId: transfer.task._id,
        taskTitle: transfer.task.title,
        fromUser: req.user.fullName,
      });
    }

    res.json({ message: 'Transfer approved by admin.', transfer });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.rejectTransferAdmin = async (req, res) => {
  try {
    const transfer = await TaskTransfer.findOne({ task: req.params.id, adminStatus: 'Pending' });
    if (!transfer) return res.status(404).json({ message: 'No pending transfer found for admin.' });
    transfer.adminStatus = 'Rejected';
    transfer.status = 'Rejected';
    await transfer.save();

    const task = await Task.findByIdAndUpdate(req.params.id, { transferPending: false, transferStatus: 'None' }, { new: true })
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    const io = req.app.get('io');
    if (io) {
      if (task?.team) io.to(`team_${task.team._id || task.team}`).emit('taskUpdated', task);
      io.to(`user_${transfer.fromUser}`).emit('taskTransferRejected', {
        taskId: task._id,
        taskTitle: task.title,
        rejectedBy: 'Admin',
      });
    }

    res.json({ message: 'Transfer rejected by admin.', transfer });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── Manager Assignment Approval Workflow ────────────────────────────────────

// @desc    Get tasks with pending manager assignment (awaiting admin approval)
// @route   GET /api/tasks/manager-pending
// @access  Admin only
exports.getManagerPendingTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ managerApprovalPending: true })
      .populate('pendingAssignee', 'fullName')
      .populate('project', 'name')
      .populate('team', 'name')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Admin approves a manager's task assignment
// @route   PATCH /api/tasks/:id/manager-approve
// @access  Admin only
exports.approveManagerTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!task.managerApprovalPending) return res.status(400).json({ message: 'No pending approval for this task.' });

    const assigneeId = task.pendingAssignee;
    task.assignee = assigneeId;
    task.pendingAssignee = null;
    task.managerApprovalPending = false;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'fullName')
      .populate('project', 'name description')
      .populate('team', 'name')
      .populate('createdBy', 'fullName');

    const io = req.app.get('io');
    if (io) {
      // Notify the assigned employee
      io.to(`user_${assigneeId}`).emit('taskAssigned', {
        taskId: task._id,
        taskTitle: task.title,
        projectName: populated.project?.name || 'No Project',
        assignedBy: 'Admin (approved)',
      });
      // Broadcast updated task to team
      if (task.team) io.to(`team_${task.team}`).emit('taskUpdated', populated);
      // Notify the manager who created the task
      if (task.createdBy) {
        io.to(`user_${task.createdBy}`).emit('taskManagerApproved', {
          taskId: task._id,
          taskTitle: task.title,
          assigneeName: populated.assignee?.fullName,
        });
      }
    }

    res.json({ message: 'Task assignment approved.', task: populated });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Admin rejects a manager's task assignment
// @route   PATCH /api/tasks/:id/manager-reject
// @access  Admin only
exports.rejectManagerTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!task.managerApprovalPending) return res.status(400).json({ message: 'No pending approval for this task.' });

    const managerId = task.createdBy;
    task.pendingAssignee = null;
    task.managerApprovalPending = false;
    await task.save();

    const io = req.app.get('io');
    if (io && managerId) {
      io.to(`user_${managerId}`).emit('taskManagerRejected', {
        taskId: task._id,
        taskTitle: task.title,
      });
    }

    res.json({ message: 'Task assignment rejected.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
