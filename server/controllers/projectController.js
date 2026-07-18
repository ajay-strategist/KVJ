const Project = require('../models/Project');
const Task = require('../models/Task');

// @desc    Get all projects with progress
// @route   GET /api/projects
// @access  Private (all authenticated users)
exports.getProjects = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'Manager') {
      // Managers see only projects they are assigned to
      filter = { managers: req.user._id };
    } else if (req.user.role === 'Employee') {
      // Employees see projects that contain tasks assigned to them or their team pool
      const myTaskProjects = await Task.find({
        $or: [
          { assignee: req.user._id },
          { assignee: null, team: req.user.team }
        ],
        project: { $ne: null }
      }).distinct('project');

      filter = {
        $or: [
          { _id: { $in: myTaskProjects } },
          { members: req.user._id }
        ]
      };
    }
    // Admin: filter stays {} — sees all projects

    const projects = await Project.find(filter).populate('managers', 'fullName email').populate('members', 'fullName email');

    // Calculate progress for each project (FR-09.5)
    const projectsWithProgress = await Promise.all(projects.map(async (proj) => {
      const totalTasks = await Task.countDocuments({ project: proj._id });
      const completedTasks = await Task.countDocuments({ project: proj._id, status: 'Done' });
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return { ...proj.toObject(), totalTasks, completedTasks, progress };
    }));

    res.json(projectsWithProgress);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private/Admin
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);
    const populated = await Project.findById(project._id).populate('managers', 'fullName email').populate('members', 'fullName email');
    res.status(201).json({ ...populated.toObject(), totalTasks: 0, completedTasks: 0, progress: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Admin full edit; Manager can update status of own projects)
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (req.user.role === 'Manager') {
      // Manager may only change status of projects they are assigned to
      const isAssigned = project.managers.map(m => m.toString()).includes(req.user._id.toString());
      if (!isAssigned) return res.status(403).json({ message: 'You are not assigned to this project' });
      // Restrict editable fields for Manager — status only
      req.body = { status: req.body.status };
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('managers', 'fullName email')
      .populate('members', 'fullName email');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a project (and unlink all its tasks)
// @route   DELETE /api/projects/:id
// @access  Private/Admin
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Unlink tasks so they become standalone (not deleted, just detached)
    await Task.updateMany({ project: req.params.id }, { $unset: { project: '' } });

    res.json({ message: 'Project removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Export projects as CSV
// @route   GET /api/projects/export
// @access  Private/Admin
exports.exportProjects = async (req, res) => {
  try {
    let filter = {};
    const { scope } = req.query;

    if (scope === 'weekly') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      filter.createdAt = { $gte: d };
    } else if (scope === 'monthly') {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      filter.createdAt = { $gte: d };
    }

    const projects = await Project.find(filter).populate('managers', 'fullName');

    const header = 'Project Name,Client,Assigned Managers,Status,Progress %,Start Date,End Date,Total Tasks,Completed Tasks';
    const rows = await Promise.all(projects.map(async (p) => {
      const totalTasks = await Task.countDocuments({ project: p._id });
      const completedTasks = await Task.countDocuments({ project: p._id, status: 'Done' });
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.client || '',
        p.managers.map(m => m.fullName).join('; '),
        p.status,
        progress,
        p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
        p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
        totalTasks,
        completedTasks
      ].join(',');
    }));

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=projects_export.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProjectMembers = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('members', 'fullName email role');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project.members);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProjectTasks = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { project: req.params.id };
    if (status) filter.status = status;
    // Include archived tasks when fetching Done tasks
    if (status === 'Done') {
      filter.archived = true;
    } else if (status) {
      filter.archived = false;
    }
    // No status filter = return all tasks for the project
    const tasks = await Task.find(filter)
      .populate('assignee', 'fullName')
      .populate('team', 'name')
      .sort({ completedDate: -1, dueDate: 1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
