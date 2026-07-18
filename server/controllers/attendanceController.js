const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Task = require('../models/Task');
const Leave = require('../models/Leave');
const axios = require('axios'); // For reverse geocoding


exports.heartbeat = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { lastActiveAt: new Date() });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.clockIn = async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check for any existing open session (not just today's) to prevent double clock-in
    let attendance = await Attendance.findOne({
      user: req.user._id,
      clockOutTime: null
    });

    if (attendance) {
      return res.status(400).json({ message: 'You are already clocked in. Please clock out before starting a new session.' });
    }

    const dayOfWeek = today.getDay();
    let label = 'Normal';
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      label = 'Weekend';
    }

    let city = 'Unknown';
    try {
      const geoRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
        headers: { 'User-Agent': 'FlowDesk-App' }
      });
      const addr = geoRes.data.address;
      if (addr) {
        const road = addr.road
          || addr.pedestrian
          || addr.footway
          || addr.path
          || addr.neighbourhood
          || addr.suburb
          || addr.residential
          || addr.quarter
          || '';

        const area = addr.suburb
          || addr.neighbourhood
          || addr.quarter
          || addr.village
          || '';

        const town = addr.city
          || addr.town
          || addr.county
          || addr.state_district
          || '';

        if (road && town && road !== town) {
          city = `${road}, ${town}`;
        } else if (area && town && area !== town) {
          city = `${area}, ${town}`;
        } else if (road) {
          city = road;
        } else if (area) {
          city = `${area}${town ? ', ' + town : ''}`;
        } else if (town) {
          city = town;
        } else {
          city = geoRes.data.display_name?.split(',').slice(0, 2).join(',').trim()
            || 'Unknown';
        }
      }
    } catch (e) {
      console.error('Reverse Geocoding Error:', e.message);
    }

    attendance = await Attendance.create({
      user: req.user._id,
      date: new Date(),
      clockInTime: new Date(),
      clockInLocation: { latitude, longitude, accuracy, city },
      label: label
    });

    req.app.get('io').emit('teamStatusUpdate');
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.breakIn = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find any open session for this user (regardless of date)
    const attendance = await Attendance.findOne({
      user: req.user._id,
      clockOutTime: null
    });

    if (!attendance) return res.status(400).json({ message: 'You must be clocked in to take a break.' });

    if (attendance.breaks.length > 0 && !attendance.breaks[attendance.breaks.length - 1].breakOutTime) {
      return res.status(400).json({ message: 'You are already on a break.' });
    }

    attendance.breaks.push({ breakInTime: new Date() });

    const Task = require('../models/Task');
    const runningTask = await Task.findOne({
      'timer.isRunning': true,
      'timer.startedBy': req.user._id
    });

    if (runningTask) {
      const elapsed = Math.floor(
        (new Date() - new Date(runningTask.timer.startedAt)) / 1000
      );
      runningTask.timer.totalSeconds += elapsed;
      runningTask.timer.isRunning    = false;
      runningTask.timer.startedAt    = null;
      await runningTask.save();

      const io = req.app.get('io');
      if (io && runningTask.team) {
        const teamId = runningTask.team._id || runningTask.team;
        io.to(`team_${teamId}`).emit('timerUpdate', {
          taskId: runningTask._id,
          timer:  runningTask.timer
        });
      }
    }

    await attendance.save();

    req.app.get('io').emit('teamStatusUpdate');
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.breakOut = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find any open session for this user (regardless of date)
    const attendance = await Attendance.findOne({
      user: req.user._id,
      clockOutTime: null
    });

    if (!attendance) return res.status(400).json({ message: 'No active clock-in found.' });

    if (attendance.breaks.length === 0 || attendance.breaks[attendance.breaks.length - 1].breakOutTime) {
      return res.status(400).json({ message: 'You are not currently on a break.' });
    }

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    lastBreak.breakOutTime = new Date();

    const breakDurationMs = new Date(lastBreak.breakOutTime).getTime() - new Date(lastBreak.breakInTime).getTime();
    attendance.totalBreakDurationMinutes += breakDurationMs / (1000 * 60);

    await attendance.save();

    req.app.get('io').emit('teamStatusUpdate');
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find any open session for this user (regardless of date)
    const attendance = await Attendance.findOne({
      user: req.user._id,
      clockOutTime: null
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No active clock-in found for today.' });
    }

    if (attendance.breaks.length > 0 && !attendance.breaks[attendance.breaks.length - 1].breakOutTime) {
      const lastBreak = attendance.breaks[attendance.breaks.length - 1];
      lastBreak.breakOutTime = new Date();
      const breakDurationMs = new Date(lastBreak.breakOutTime).getTime() - new Date(lastBreak.breakInTime).getTime();
      attendance.totalBreakDurationMinutes += breakDurationMs / (1000 * 60);
    }

    const Task = require('../models/Task');
    const runningTask = await Task.findOne({
      'timer.isRunning': true,
      'timer.startedBy': req.user._id
    });

    if (runningTask) {
      const elapsed = Math.floor(
        (new Date() - new Date(runningTask.timer.startedAt)) / 1000
      );
      runningTask.timer.totalSeconds += elapsed;
      runningTask.timer.isRunning    = false;
      runningTask.timer.startedAt    = null;
      await runningTask.save();

      const io = req.app.get('io');
      if (io && runningTask.team) {
        const teamId = runningTask.team._id || runningTask.team;
        io.to(`team_${teamId}`).emit('timerUpdate', {
          taskId: runningTask._id,
          timer:  runningTask.timer
        });
      }
    }

    attendance.clockOutTime = new Date();

    const clockInMs = new Date(attendance.clockInTime).getTime();
    const clockOutMs = new Date(attendance.clockOutTime).getTime();
    const breakMs = attendance.totalBreakDurationMinutes * 60 * 1000;

    attendance.totalHours = ((clockOutMs - clockInMs) - breakMs) / (1000 * 60 * 60);

    await attendance.save();

    req.app.get('io').emit('teamStatusUpdate');
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const { clockInTime, clockOutTime, totalBreakDurationMinutes, note } = req.body;
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) return res.status(404).json({ message: 'Attendance record not found.' });

    // Capture previous values before mutating (US-A21 audit log)
    const previous = {
      clockInTime: attendance.clockInTime,
      clockOutTime: attendance.clockOutTime,
      totalBreakDurationMinutes: attendance.totalBreakDurationMinutes
    };

    if (clockInTime !== undefined) attendance.clockInTime = clockInTime;
    if (clockOutTime !== undefined) attendance.clockOutTime = clockOutTime;
    if (totalBreakDurationMinutes !== undefined) attendance.totalBreakDurationMinutes = totalBreakDurationMinutes;

    if (attendance.clockInTime && attendance.clockOutTime) {
      const clockInMs = new Date(attendance.clockInTime).getTime();
      const clockOutMs = new Date(attendance.clockOutTime).getTime();
      const breakMs = (attendance.totalBreakDurationMinutes || 0) * 60 * 1000;
      attendance.totalHours = ((clockOutMs - clockInMs) - breakMs) / (1000 * 60 * 60);
    }

    // Append audit log entry
    attendance.correctionLog.push({
      correctedBy: req.user._id,
      correctedAt: new Date(),
      note: note || '',
      previous,
      updated: {
        clockInTime: attendance.clockInTime,
        clockOutTime: attendance.clockOutTime,
        totalBreakDurationMinutes: attendance.totalBreakDurationMinutes
      }
    });

    await attendance.save();

    const populated = await Attendance.findById(attendance._id)
      .populate('user', 'fullName email')
      .populate('correctionLog.correctedBy', 'fullName email');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.getMyAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ user: req.user._id }).sort({ date: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllAttendance = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Manager') {
      const teamUsers = await User.find({ team: req.user.team }).select('_id');
      filter.user = { $in: teamUsers.map(u => u._id) };
    }
    const attendance = await Attendance.find(filter).populate('user', 'fullName email').sort({ date: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getTeamStatus = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Manager') {
      filter.team = req.user.team;
    }

    const members = await User.find(filter).select('fullName email role lastActiveAt');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const statuses = await Promise.all(members.map(async (member) => {
      const onLeave = await Leave.findOne({
        user: member._id,
        status: 'Approved',
        fromDate: { $lte: endOfDay },
        toDate: { $gte: today }
      });

      const attendances = await Attendance.find({
        user: member._id,
        date: { $gte: today, $lte: endOfDay }
      }).sort({ clockInTime: 1 });

      const activeAttendance = attendances.find(a => !a.clockOutTime);
      const firstClockIn = attendances.length > 0 ? attendances[0].clockInTime : null;
      
      let totalBreaks = attendances.reduce((acc, curr) => acc + (curr.totalBreakDurationMinutes || 0), 0);

      // If there's an active break, add its current duration
      if (activeAttendance && activeAttendance.breaks.length > 0) {
        const lastBreak = activeAttendance.breaks[activeAttendance.breaks.length - 1];
        if (!lastBreak.breakOutTime) {
          totalBreaks += (new Date() - new Date(lastBreak.breakInTime)) / (1000 * 60);
        }
      }

      const activeTask = await Task.findOne({
        assignee: member._id,
        status: 'In Progress'
      });

      let status = 'Offline';
      if (onLeave) {
        status = 'On Leave';
      } else if (activeAttendance) {
        if (activeAttendance.breaks.length > 0 && !activeAttendance.breaks[activeAttendance.breaks.length - 1].breakOutTime) {
          status = 'On Break';
        } else {
          status = 'Active';
          const fifteenMins = 15 * 60 * 1000;
          if (!activeTask && member.lastActiveAt) {
            const inactiveTime = new Date() - new Date(member.lastActiveAt);
            if (inactiveTime > fifteenMins) {
              status = 'Away';
            }
          }
        }
      }

      const lastClockOut = (attendances.length > 0 && !activeAttendance) ? attendances[attendances.length - 1].clockOutTime : null;

      return {
        _id: member._id,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        lastActiveAt: member.lastActiveAt,
        status: status,
        activeTask: activeTask ? activeTask.title : null,
        clockInTime: firstClockIn,
        clockOutTime: lastClockOut,
        totalBreakMinutes: Math.round(totalBreaks)
      };
    }));

    res.json(statuses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
