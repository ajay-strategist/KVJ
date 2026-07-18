const Team = require('../models/Team');
const User = require('../models/User');
const Channel = require('../models/Channel');

// @desc    Get all teams
// @route   GET /api/teams
// @access  Private (Admin, Manager, Employee)
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find({}).populate('manager', 'fullName email');
    
    const teamsWithMembers = await Promise.all(teams.map(async (team) => {
      const members = await User.find({ team: team._id }).select('fullName email role');
      return { ...team.toObject(), members };
    }));

    res.json(teamsWithMembers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a new team
// @route   POST /api/teams
// @access  Private/Admin
exports.createTeam = async (req, res) => {
  try {
    const { name, description, manager, memberIds } = req.body;

    const teamExists = await Team.findOne({ name });
    if (teamExists) {
      return res.status(400).json({ message: 'Team already exists' });
    }

    const team = await Team.create({
      name,
      description,
      manager: manager || null
    });

    if (memberIds && Array.isArray(memberIds)) {
      await User.updateMany({ _id: { $in: memberIds } }, { $set: { team: team._id } });
    }

    // FR-13.2 – Automatically create Team channel with all members (manager + members)
    const channelMembers = new Set((memberIds || []).map(String));
    if (manager) channelMembers.add(String(manager));

    await Channel.create({
      name: `${name} Team`,
      description: `Official channel for the ${name} team`,
      type: 'Team',
      team: team._id,
      members: [...channelMembers],
      createdBy: req.user ? req.user._id : null
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update team
// @route   PUT /api/teams/:id
// @access  Private/Admin
exports.updateTeam = async (req, res) => {
  try {
    const { name, description, manager, memberIds } = req.body;
    
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    if (manager !== undefined) team.manager = manager || null;

    const updatedTeam = await team.save();

    if (memberIds && Array.isArray(memberIds)) {
      // Update user team assignments
      await User.updateMany({ team: team._id, _id: { $nin: memberIds } }, { $unset: { team: '' } });
      await User.updateMany({ _id: { $in: memberIds } }, { $set: { team: team._id } });

      // Sync the team channel members (manager + members) – FR-13.2
      const channelMembers = new Set(memberIds.map(String));
      const effectiveManager = manager !== undefined ? manager : team.manager;
      if (effectiveManager) channelMembers.add(String(effectiveManager));

      await Channel.findOneAndUpdate(
        { type: 'Team', team: team._id },
        { $set: { members: [...channelMembers] } }
      );
    }

    res.json(updatedTeam);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete team
// @route   DELETE /api/teams/:id
// @access  Private/Admin
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    await Team.findByIdAndDelete(req.params.id);

    // Remove the associated team channel
    await Channel.deleteMany({ type: 'Team', team: req.params.id });

    // Unassign users who belonged to this team
    await User.updateMany({ team: req.params.id }, { $unset: { team: '' } });
    
    res.json({ message: 'Team removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get team members
// @route   GET /api/teams/:id/members
// @access  Private
exports.getTeamMembers = async (req, res) => {
  try {
    const members = await User.find({ 
      team: req.params.id, 
      status: 'Active' 
    }).select('fullName email role');
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
