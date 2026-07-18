const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { isTrainer } = require('../middleware/isTrainerMiddleware');
const { createLog, getMyLogs, getAllLogs, exportTrainerLogs } = require('../controllers/trainerLogController');

// GET /api/trainer-log/export (admin only)
router.get('/export', protect, authorize('Admin'), exportTrainerLogs);

// POST /api/trainer-log
router.post('/', protect, isTrainer, createLog);

// GET /api/trainer-log/my
router.get('/my', protect, isTrainer, getMyLogs);

// GET /api/trainer-log/all  (admin only)
router.get('/all', protect, authorize('Admin'), getAllLogs);

module.exports = router;
