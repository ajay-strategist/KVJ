const Leave = require('../models/Leave');
const PublicHoliday = require('../models/PublicHoliday');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const calendarService = require('../services/calendarService');

// ─── LEAVE REQUESTS ──────────────────────────────────────────────────────────

exports.createLeaveRequest = async (req, res) => {
  try {
    const { fromDate, toDate, reason, leaveType, natureOfLeave, isHalfDay, halfDaySlot } = req.body;
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (isHalfDay && !['Morning', 'Evening'].includes(halfDaySlot)) {
      return res.status(400).json({ message: 'Half day slot must be Morning or Evening' });
    }

    if (isHalfDay && from.toISOString().split('T')[0] !== to.toISOString().split('T')[0]) {
      return res.status(400).json({ message: 'Half day leave must be on a single day' });
    }

    // Count working days (exclude Sundays)
    let daysTaken;
    if (isHalfDay) {
      daysTaken = 0.5;
    } else {
      daysTaken = 0;
      let cur = new Date(from);
      while (cur <= to) {
        if (cur.getDay() !== 0) daysTaken++;
        cur.setDate(cur.getDate() + 1);
      }
    }

    if (!isHalfDay && daysTaken === 0) {
      return res.status(400).json({ message: 'Selected dates fall only on Sundays (public holidays). Please select working days.' });
    }

    if (!natureOfLeave || !['Medical', 'Personal'].includes(natureOfLeave)) {
      return res.status(400).json({ message: 'Nature of Leave is required (Medical or Personal).' });
    }

    const leave = await Leave.create({
      user: req.user._id,
      leaveType: leaveType || null,
      fromDate: from,
      toDate: to,
      reason,
      natureOfLeave,
      daysTaken,
      isHalfDay: isHalfDay || false,
      halfDaySlot: isHalfDay ? halfDaySlot : null
    });

    const populated = await Leave.findById(leave._id)
      .populate('user', 'fullName email');

    req.app.get('io').emit('leaveUpdate');
    res.status(201).json(populated);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ user: req.user._id })
      .populate('approvedBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAllLeaves = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Manager') {
      const teamUsers = await User.find({ team: req.user.team }).select('_id');
      filter.user = { $in: teamUsers.map(u => u._id) };
    }
    if (req.query.status) filter.status = req.query.status;

    const leaves = await Leave.find(filter)
      .populate('user', 'fullName email')
      .populate('approvedBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, managerComment } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    leave.status = status;
    leave.managerComment = managerComment || '';
    leave.approvedBy = req.user._id;
    await leave.save();

    const updated = await Leave.findById(leave._id)
      .populate('user', 'fullName email googleCalendar')
      .populate('approvedBy', 'fullName');
      
    if (status === 'Approved' && updated.user?.googleCalendar?.connected) {
      // Async fire-and-forget sync to Google Calendar
      calendarService.syncLeaveToCalendar(updated.user, updated);
    }
    
    if (status === 'Approved') {
      // BLOCK A — Half day leave — mark as absent, no clock-in/clock-out session
      if (updated.isHalfDay === true) {
        const Attendance = require('../models/Attendance');
        const leaveDate = new Date(updated.fromDate);
        leaveDate.setUTCHours(0, 0, 0, 0);

        let att = await Attendance.findOne({
          user: updated.user._id || updated.user,
          date: {
            $gte: leaveDate,
            $lt: new Date(leaveDate.getTime() + 86400000)
          }
        });

        if (!att) {
          att = new Attendance({
            user: updated.user._id || updated.user,
            date: leaveDate,
            label: updated.halfDaySlot === 'Morning'
              ? 'Half Day (Morning Leave)'
              : 'Half Day (Evening Leave)',
            clockInTime: null,
            clockOutTime: null,
            totalHours: 0,
            totalBreakDurationMinutes: 0
          });
          await att.save();
        } else {
          // Record exists (user clocked in) — only update the label,
          // do NOT overwrite clockInTime, clockOutTime, or totalHours
          att.label = updated.halfDaySlot === 'Morning'
            ? 'Half Day (Morning Leave)'
            : 'Half Day (Evening Leave)';
          await att.save();
        }
      }

      // BLOCK B — Medical Report Deadline
      if (updated.natureOfLeave === 'Medical' && updated.isHalfDay !== true) {
        const deadline = new Date(updated.toDate);
        deadline.setDate(deadline.getDate() + 7);
        updated.reportStatus   = 'Pending';
        updated.reportDeadline = deadline;
        await updated.save();
      }
    }

    // Auto Announce in Chat DM
    if (status === 'Approved' || status === 'Rejected') {
      try {
        const Channel = require('../models/Channel');
        const Message = require('../models/Message');
        const adminId = req.user._id.toString();
        const employeeId = leave.user.toString();

        if (adminId !== employeeId) {
          let dm = await Channel.findOne({
            type: 'DM',
            members: { $all: [adminId, employeeId], $size: 2 }
          });
          if (!dm) {
            dm = await Channel.create({ name: 'DM', type: 'DM', members: [adminId, employeeId], createdBy: adminId });
          }
          
          const startDate = new Date(leave.fromDate).toISOString().split('T')[0];
          const endDate = new Date(leave.toDate).toISOString().split('T')[0];
          const comment = leave.managerComment ? leave.managerComment.trim() : '';
          const displayComment = comment ? comment : 'No comment provided';
          
          const text = status === 'Approved' 
            ? `✅ Your leave request for ${startDate} to ${endDate} has been approved. Admin note: ${displayComment}`
            : `❌ Your leave request for ${startDate} to ${endDate} has been rejected. Admin note: ${displayComment}`;

          const message = await Message.create({
            channel: dm._id,
            sender: adminId,
            text
          });

          const populatedMessage = await Message.findById(message._id).populate('sender', 'fullName email');
          const io = req.app.get('io');
          if (io) {
            const channelIdStr = dm._id.toString();
            for (const memberId of dm.members) {
              const sockets = await io.in(`user_${memberId}`).fetchSockets();
              sockets.forEach(s => s.join(channelIdStr));
            }
            io.to(channelIdStr).emit('newMessage', populatedMessage);
          }
        }
      } catch (chatErr) {
        console.error('Failed to send leave chat notification:', chatErr);
      }
    }
    
    req.app.get('io').emit('leaveUpdate');
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.deleteLeaveRequest = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.user.toString() !== req.user._id.toString() && req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await leave.deleteOne();
    
    req.app.get('io').emit('leaveUpdate');
    res.json({ message: 'Leave request deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── CALENDAR ────────────────────────────────────────────────────────────────

exports.getLeaveCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month);
    const start = isNaN(m) ? new Date(y, 0, 1) : new Date(y, m, 1);
    const end   = isNaN(m) ? new Date(y, 11, 31, 23, 59, 59, 999) : new Date(y, m + 1, 0, 23, 59, 59, 999);

    // Admin → all leaves; Manager or Employee → only their own leaves
    let userFilter = {};
    if (req.user.role !== 'Admin') {
      userFilter = { user: req.user._id };
    }

    const [leaves, holidays] = await Promise.all([
      Leave.find({ ...userFilter, fromDate: { $lte: end }, toDate: { $gte: start } })
        .populate('user', 'fullName'),
      PublicHoliday.find({ date: { $gte: start, $lte: end } })
    ]);

    res.json({ leaves, holidays });
  } catch (e) { res.status(500).json({ message: e.message }); }
};


// ─── PUBLIC HOLIDAYS ─────────────────────────────────────────────────────────

exports.getPublicHolidays = async (req, res) => {
  try {
    const holidays = await PublicHoliday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.createPublicHoliday = async (req, res) => {
  try {
    const holiday = await PublicHoliday.create(req.body);
    
    // Auto Announce in General Chat
    const Channel = require('../models/Channel');
    const Message = require('../models/Message');
    const generalChannel = await Channel.findOne({ type: 'General' });
    if (generalChannel) {
      const dateStr = req.body.date || new Date(holiday.date).toISOString().split('T')[0];
      const text = `📅 ${dateStr} has been marked as a holiday: ${holiday.name}. Have a great day!`;
      const message = await Message.create({
        channel: generalChannel._id,
        sender: req.user._id,
        text
      });
      const populatedMessage = await Message.findById(message._id).populate('sender', 'fullName email');
      const io = req.app.get('io');
      if (io) {
        io.to(generalChannel._id.toString()).emit('newMessage', populatedMessage);
      }
    }

    res.status(201).json(holiday);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.deletePublicHoliday = async (req, res) => {
  try {
    await PublicHoliday.findByIdAndDelete(req.params.id);
    res.json({ message: 'Holiday deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── EXPORT ──────────────────────────────────────────────────────────────────

exports.exportLeaves = async (req, res) => {
  try {
    const { scope } = req.query;
    let filter = {};
    if (scope === 'weekly')  { const d = new Date(); d.setDate(d.getDate()-7);  filter.createdAt = { $gte: d }; }
    if (scope === 'monthly') { const d = new Date(); d.setMonth(d.getMonth()-1); filter.createdAt = { $gte: d }; }

    const leaves = await Leave.find(filter)
      .populate('user', 'fullName')
      .populate('approvedBy', 'fullName');

    const header = 'Employee,From Date,To Date,Days,Reason,Status,Manager Comment';
    const rows = leaves.map(l => [
      l.user?.fullName || '',
      l.fromDate ? new Date(l.fromDate).toISOString().split('T')[0] : '',
      l.toDate   ? new Date(l.toDate).toISOString().split('T')[0]   : '',
      l.daysTaken,
      `"${(l.reason || '').replace(/"/g,'""')}"`,
      l.status,
      `"${(l.managerComment || '').replace(/"/g,'""')}"`
    ].join(','));

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leaves_export.csv');
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// Keep export attendance here too (used in the Leaves Export tab)
exports.exportAttendance = async (req, res) => {
  try {
    const { scope } = req.query;
    let filter = {};
    if (scope === 'weekly')  { const d = new Date(); d.setDate(d.getDate()-7);  filter.date = { $gte: d }; }
    if (scope === 'monthly') { const d = new Date(); d.setMonth(d.getMonth()-1); filter.date = { $gte: d }; }

    const records = await Attendance.find(filter).populate('user','fullName').sort({ date: -1 });
    const holidays = await PublicHoliday.find();
    const holidayDates = holidays.map(h => new Date(h.date).toISOString().split('T')[0]);

    const header = 'Employee,Date,Day Label,Clock In,Clock Out,Break (min),Total Hours,Location';
    const rows = records.map(r => {
      const dateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
      const dow = r.date ? new Date(r.date).getDay() : -1;
      let label = 'Normal';
      if (holidayDates.includes(dateStr)) label = 'Public Holiday';
      else if (dow === 0 || dow === 6) label = 'Weekend';
      else if (r.isAutoClosed) label = 'Auto-closed';
      return [
        r.user?.fullName || '',
        dateStr, label,
        r.clockInTime  ? new Date(r.clockInTime).toLocaleTimeString()  : '',
        r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : '',
        Math.round(r.totalBreakDurationMinutes || 0),
        (r.totalHours || 0).toFixed(2),
        r.clockInLocation ? `${r.clockInLocation.latitude},${r.clockInLocation.longitude}` : ''
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
    res.send(csv);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── MEDICAL REPORT UPLOAD ────────────────────────────────────────────────────

exports.uploadMedicalReport = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('user', 'fullName email');
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    if (leave.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (leave.natureOfLeave !== 'Medical' || leave.isHalfDay) {
      return res.status(400).json({
        message: 'Medical certificate not required for this leave'
      });
    }

    if (leave.status !== 'Approved') {
      return res.status(400).json({
        message: 'Leave must be approved before submitting a certificate'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Google Drive only (no Cloudinary)
    const driveService = require('../services/driveService');
    let driveFileId   = null;
    let driveViewLink = null;
    try {
      const driveResult = await driveService.uploadMedicalReport({
        buffer:       req.file.buffer,
        mimeType:     req.file.mimetype,
        employeeName: leave.user.fullName || leave.user.email,
        date:         leave.fromDate,
      });
      driveFileId   = driveResult.driveFileId;
      driveViewLink = driveResult.driveViewLink;
    } catch (driveErr) {
      console.error('[uploadMedicalReport] Drive failed:', driveErr.message);
      return res.status(500).json({
        message: 'Failed to upload certificate to Drive. Please try again.'
      });
    }

    leave.medicalReportDriveId   = driveFileId;
    leave.medicalReportDriveLink = driveViewLink;
    leave.reportStatus           = 'Submitted';
    await leave.save();

    // Notify in General channel
    try {
      const Channel = require('../models/Channel');
      const Message = require('../models/Message');
      const generalChannel = await Channel.findOne({ type: 'General' });
      if (generalChannel) {
        const fromStr = new Date(leave.fromDate).toISOString().split('T')[0];
        const toStr   = new Date(leave.toDate).toISOString().split('T')[0];
        const text = `📋 ${leave.user.fullName} has submitted a medical certificate for their leave from ${fromStr} to ${toStr}.`;
        const message = await Message.create({
          channel: generalChannel._id,
          sender:  req.user._id,
          text
        });
        const populated = await Message.findById(message._id)
          .populate('sender', 'fullName email');
        const io = req.app.get('io');
        if (io) {
          io.to(generalChannel._id.toString()).emit('newMessage', populated);
        }
      }
    } catch (chatErr) {
      console.error('[uploadMedicalReport] Chat notification failed:', chatErr.message);
    }

    res.json({
      message:              'Medical certificate uploaded successfully',
      reportStatus:         leave.reportStatus,
      medicalReportDriveLink: leave.medicalReportDriveLink
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
