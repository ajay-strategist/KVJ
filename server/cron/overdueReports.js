const cron = require('node-cron');
const Leave = require('../models/Leave');
const User = require('../models/User');
const Channel = require('../models/Channel');
const Message = require('../models/Message');

/**
 * Runs daily at midnight.
 * Marks Pending medical report leaves as Overdue when deadline has passed,
 * then DMs the employee and posts in the General channel.
 */
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running overdue medical reports check...');
  try {
    const io = global._io || null;

    const overdueLeaves = await Leave.find({
      reportStatus:   'Pending',
      reportDeadline: { $lt: new Date() },
      natureOfLeave:  'Medical',
      isHalfDay:      { $ne: true }
    }).populate('user', 'fullName email');

    if (!overdueLeaves.length) return;

    const adminUser = await User.findOne({ role: 'Admin' });
    const generalChannel = await Channel.findOne({ type: 'General' });

    for (const leave of overdueLeaves) {
      // 1. Mark as Overdue
      leave.reportStatus = 'Overdue';
      await leave.save();

      const fromStr = new Date(leave.fromDate).toISOString().split('T')[0];
      const toStr   = new Date(leave.toDate).toISOString().split('T')[0];

      // 2. Send DM to employee
      if (adminUser) {
        try {
          const participants = [adminUser._id, leave.user._id]
            .map(id => id.toString())
            .sort();

          let dmChannel = await Channel.findOne({
            type: 'DM',
            members: { $all: participants, $size: 2 }
          });

          if (!dmChannel) {
            dmChannel = await Channel.create({
              name: 'DM',
              type: 'DM',
              members: participants,
              createdBy: adminUser._id
            });
          }

          const dmText = `⚠️ Your medical certificate for leave from ${fromStr} to ${toStr} is now overdue. Please submit it as soon as possible.`;
          const dmMessage = await Message.create({
            channel: dmChannel._id,
            sender:  adminUser._id,
            text:    dmText
          });
          const populatedDm = await Message.findById(dmMessage._id)
            .populate('sender', 'fullName email');

          if (io) {
            const channelIdStr = dmChannel._id.toString();
            for (const memberId of dmChannel.members) {
              const sockets = await io.in(`user_${memberId}`).fetchSockets();
              sockets.forEach(s => s.join(channelIdStr));
            }
            io.to(channelIdStr).emit('newMessage', populatedDm);
          }
        } catch (dmErr) {
          console.error('[overdueReports] DM failed:', dmErr.message);
        }
      }

      // 3. Post in General channel
      if (generalChannel && adminUser) {
        try {
          const generalText = `⚠️ Medical certificate overdue: ${leave.user.fullName}'s certificate for leave ${fromStr} to ${toStr} has not been submitted.`;
          const genMessage = await Message.create({
            channel: generalChannel._id,
            sender:  adminUser._id,
            text:    generalText
          });
          const populatedGen = await Message.findById(genMessage._id)
            .populate('sender', 'fullName email');

          if (io) {
            io.to(generalChannel._id.toString()).emit('newMessage', populatedGen);
          }
        } catch (genErr) {
          console.error('[overdueReports] General channel post failed:', genErr.message);
        }
      }
    }

    console.log(`[CRON] Marked ${overdueLeaves.length} medical report(s) as overdue.`);
  } catch (error) {
    console.error('[CRON] Overdue reports error:', error);
  }
});
