const express = require('express');
const router = express.Router();
const { 
  clockIn, clockOut, breakIn, breakOut, 
  getMyAttendance, getAllAttendance, updateAttendance, getTeamStatus, heartbeat
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/clock-in', clockIn);
router.put('/clock-out', clockOut);
router.put('/break-in', breakIn);
router.put('/break-out', breakOut);
router.post('/heartbeat', heartbeat);
router.get('/me', getMyAttendance);
router.get('/team-status', authorize('Admin', 'Manager'), getTeamStatus);
router.get('/', authorize('Admin', 'Manager'), getAllAttendance);
router.put('/:id', authorize('Admin'), updateAttendance);

module.exports = router;
