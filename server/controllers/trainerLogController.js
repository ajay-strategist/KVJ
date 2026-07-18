const TrainerLog = require('../models/TrainerLog');

// Helper: parse "HH:MM" into total minutes
const toMinutes = (timeStr) => {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// @desc    Create a trainer log entry
// @route   POST /api/trainer-log
// @access  isTrainer only
exports.createLog = async (req, res) => {
  try {
    const { date, organisation, type, mode, startTime, endTime } = req.body;

    const startMins = toMinutes(startTime);
    const endMins   = toMinutes(endTime);
    const duration  = endMins > startMins ? endMins - startMins : 0;

    const log = await TrainerLog.create({
      userId: req.user._id,
      date,
      organisation,
      type,
      mode,
      startTime,
      endTime,
      duration
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get logged-in trainer's own entries
// @route   GET /api/trainer-log/my
// @access  isTrainer only
exports.getMyLogs = async (req, res) => {
  try {
    const logs = await TrainerLog.find({ userId: req.user._id }).sort({ date: -1, createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get all trainer logs (admin view)
// @route   GET /api/trainer-log/all
// @access  Admin only
exports.getAllLogs = async (req, res) => {
  try {
    const filter = {};

    if (req.query.userId) filter.userId = req.query.userId;

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(`${req.query.from}T00:00:00`);
      if (req.query.to)   filter.date.$lte = new Date(`${req.query.to}T23:59:59`);
    }

    const logs = await TrainerLog.find(filter)
      .populate('userId', 'fullName')
      .sort({ date: -1, createdAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Export trainer logs as CSV
// @route   GET /api/trainer-log/export
// @access  Admin only
exports.exportTrainerLogs = async (req, res) => {
  try {
    const filter = {};
    const trainerId = req.query.trainer || req.query.trainerId;
    if (trainerId) filter.userId = trainerId;
    
    if (req.query.month) {
      // month is in YYYY-MM format
      const [year, month] = req.query.month.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59); // last day of month
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const logs = await TrainerLog.find(filter)
      .populate('userId', 'fullName')
      .sort({ date: -1, createdAt: -1 });

    const header = 'Date,Trainer,Organisation,Type,Mode,Start Time,End Time,Duration (Mins)';
    const rows = logs.map(log => {
      const dateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
      const trainerName = log.userId ? log.userId.fullName : 'Unknown';
      const org = `"${(log.organisation || '').replace(/"/g, '""')}"`;
      return `${dateStr},"${trainerName}",${org},${log.type},${log.mode},${log.startTime},${log.endTime},${log.duration}`;
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=trainer_logs_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
