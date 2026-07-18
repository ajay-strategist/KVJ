const Channel = require('../models/Channel');
const Message = require('../models/Message');
const User = require('../models/User');

// Helper: check if user can access a channel
const canAccessChannel = (channel, user) => {
  if (user.role === 'Admin') return true;
  if (channel.type === 'General') return true;
  if (channel.type === 'Team') {
    return channel.team && user.team &&
      channel.team.toString() === user.team.toString();
  }
  if (channel.type === 'Custom' || channel.type === 'DM') {
    return channel.members.map(m => m.toString()).includes(user._id.toString());
  }
  return false;
};

// @desc    Get channels visible to the current user
// @route   GET /api/chat/channels
// @access  Private
exports.getChannels = async (req, res) => {
  try {
    let generalChannel = await Channel.findOne({ type: 'General' });
    if (!generalChannel) {
      generalChannel = await Channel.create({
        name: 'General',
        description: 'Company-wide announcements and general chat',
        type: 'General',
        members: []
      });
    }

    let filter;
    if (req.user.role === 'Admin') {
      filter = { type: { $ne: 'DM' } };
    } else {
      filter = {
        type: { $ne: 'DM' },
        $or: [
          { type: 'General' },
          { type: 'Team', team: req.user.team },
          { type: 'Custom', members: req.user._id }
        ]
      };
    }

    const channels = await Channel.find(filter)
      .populate('members', 'fullName email')
      .populate('createdBy', 'fullName')
      .sort({ type: 1, name: 1 });

    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a custom channel
// @route   POST /api/chat/channels
// @access  Private (Admin / Manager)
exports.createChannel = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const memberSet = new Set((members || []).map(String));
    memberSet.add(req.user._id.toString());

    const channel = await Channel.create({
      name, description, type: 'Custom',
      members: [...memberSet],
      createdBy: req.user._id
    });

    const populated = await Channel.findById(channel._id)
      .populate('members', 'fullName email')
      .populate('createdBy', 'fullName');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add member to custom channel
// @route   POST /api/chat/channels/:channelId/members
// @access  Private (Admin / Manager)
exports.addMember = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.type !== 'Custom') {
      return res.status(404).json({ message: 'Custom channel not found' });
    }
    if (req.user.role === 'Manager' && channel.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Managers can only modify channels they created' });
    }

    const { userId } = req.body;
    if (!channel.members.map(String).includes(userId)) {
      channel.members.push(userId);
      await channel.save();
    }

    const updated = await Channel.findById(channel._id)
      .populate('members', 'fullName email')
      .populate('createdBy', 'fullName');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Remove member from custom channel
// @route   DELETE /api/chat/channels/:channelId/members/:userId
// @access  Private (Admin / Manager)
exports.removeMember = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel || channel.type !== 'Custom') {
      return res.status(404).json({ message: 'Custom channel not found' });
    }
    if (req.user.role === 'Manager' && channel.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Managers can only modify channels they created' });
    }

    channel.members = channel.members.filter(m => m.toString() !== req.params.userId);
    await channel.save();

    const updated = await Channel.findById(channel._id)
      .populate('members', 'fullName email')
      .populate('createdBy', 'fullName');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get or create a DM channel between two users
// @route   POST /api/chat/dm
// @access  Private
exports.getOrCreateDM = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const myId = req.user._id.toString();
    if (myId === recipientId) {
      return res.status(400).json({ message: 'Cannot DM yourself' });
    }

    let dm = await Channel.findOne({
      type: 'DM',
      members: { $all: [myId, recipientId], $size: 2 }
    }).populate('members', 'fullName email');

    if (!dm) {
      const recipient = await User.findById(recipientId).select('fullName');
      if (!recipient) return res.status(404).json({ message: 'User not found' });
      dm = await Channel.create({ name: 'DM', type: 'DM', members: [myId, recipientId], createdBy: myId });
      dm = await Channel.findById(dm._id).populate('members', 'fullName email');
    }

    res.json(dm);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all DM channels for the current user
// @route   GET /api/chat/dm
// @access  Private
exports.getDMs = async (req, res) => {
  try {
    const dms = await Channel.find({ type: 'DM', members: req.user._id })
      .populate('members', 'fullName email');
    res.json(dms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get messages for a channel (members only)
// @route   GET /api/chat/channels/:channelId/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    if (!canAccessChannel(channel, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this channel' });
    }

    const messages = await Message.find({ channel: req.params.channelId, threadId: null })
      .populate('sender', 'fullName email')
      .populate('mentions', 'fullName email')
      .sort({ createdAt: 1 });

    const msgIds = messages.map(m => m._id);
    const replyCounts = await Message.aggregate([
      { $match: { threadId: { $in: msgIds } } },
      { $group: { _id: '$threadId', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    replyCounts.forEach(r => { countMap[r._id.toString()] = r.count; });

    const result = messages.map(m => {
      const obj = m.toObject();
      obj.replyCount = countMap[m._id.toString()] || 0;
      return obj;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get thread replies for a message
// @route   GET /api/chat/messages/:messageId/thread
// @access  Private
exports.getThread = async (req, res) => {
  try {
    const replies = await Message.find({ threadId: req.params.messageId })
      .populate('sender', 'fullName email')
      .populate('mentions', 'fullName email')
      .sort({ createdAt: 1 });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Send a message (members only)
// @route   POST /api/chat/channels/:channelId/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    if (!canAccessChannel(channel, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this channel' });
    }

    const { text, threadId, mentions } = req.body;
    let fileUrl = null, fileType = null, fileName = null;
    if (req.file) {
      fileUrl = req.file.path;
      fileType = req.file.mimetype;
      fileName = req.file.originalname;
    }

    let mentionIds = [];
    if (mentions) {
      mentionIds = JSON.parse(mentions);
    } else if (text) {
      const mentionMatches = text.match(/@(\S+)/g);
      if (mentionMatches) {
        const usernames = mentionMatches.map(m => m.slice(1));
        const mentionedUsers = await User.find({
          $or: usernames.map(name => ({
            fullName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }
          }))
        }).select('_id');
        mentionIds = mentionedUsers.map(u => u._id);
      }
    }

    const message = await Message.create({
      channel: req.params.channelId,
      sender: req.user._id,
      text, fileUrl, fileType, fileName,
      threadId: threadId || null,
      mentions: mentionIds
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName email')
      .populate('mentions', 'fullName email');

    const io = req.app.get('io');
    if (io) {
      const channelId = req.params.channelId.toString();
      
      // Ensure all channel members' active sockets are in the channel room
      if (channel.type === 'DM' || channel.type === 'Custom') {
        for (const memberId of channel.members) {
          const sockets = await io.in(`user_${memberId}`).fetchSockets();
          sockets.forEach(s => s.join(channelId));
        }
      } else if (channel.type === 'Team' && channel.team) {
        // For team channels, ensure team members are in the room
        const sockets = await io.in(`team_${channel.team}`).fetchSockets();
        sockets.forEach(s => s.join(channelId));
      }

      if (threadId) {
        io.to(channelId).emit('threadReply', { ...populatedMessage.toObject(), parentId: threadId });
      } else {
        io.to(channelId).emit('newMessage', populatedMessage);
      }
      if (mentionIds.length > 0) {
        mentionIds.forEach(uid => {
          io.to(`user_${uid}`).emit('mention', { channelId, message: populatedMessage });
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all active users (for mentions / DM picker)
// @route   GET /api/chat/users
// @access  Private
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'Active' })
      .select('fullName email role team')
      .populate('team', 'name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get unread mention counts per channel for current user
// @route   GET /api/chat/mentions
// @access  Private
exports.getMentionCounts = async (req, res) => {
  try {
    const counts = await Message.aggregate([
      { $match: { mentions: req.user._id } },
      { $group: { _id: '$channel', count: { $sum: 1 } } }
    ]);
    const result = {};
    counts.forEach(c => { result[c._id.toString()] = c.count; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
