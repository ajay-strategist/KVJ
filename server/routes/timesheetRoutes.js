const express = require('express');
const router = express.Router();
const { 
  createTimesheet, 
  getMyTimesheets, 
  getTeamTimesheets, 
  updateTimesheet,
  deleteTimesheet,
  exportTimesheets
} = require('../controllers/timesheetController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/export', authorize('Admin'), exportTimesheets);

router.post('/', createTimesheet);
router.get('/me', getMyTimesheets);
router.get('/', authorize('Admin', 'Manager'), getTeamTimesheets);

router.route('/:id')
  .put(updateTimesheet)
  .delete(deleteTimesheet);

// NOTE: No approval route — all work logs are auto-approved on creation.

module.exports = router;
