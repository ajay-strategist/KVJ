const express = require('express');
const router = express.Router();
const {
  // Leave Requests
  createLeaveRequest, getMyLeaves, getAllLeaves, updateLeaveStatus, deleteLeaveRequest,
  // Calendar & Holidays
  getLeaveCalendar, getPublicHolidays, createPublicHoliday, deletePublicHoliday,
  // Exports
  exportLeaves, exportAttendance,
  // Medical Report
  uploadMedicalReport
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

const multer = require('multer');
const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.use(protect);

// Public Holidays
router.get('/holidays', getPublicHolidays);
router.post('/holidays', authorize('Admin'), createPublicHoliday);
router.delete('/holidays/:id', authorize('Admin'), deletePublicHoliday);

// Calendar
router.get('/calendar', getLeaveCalendar);

// Exports
router.get('/export/leaves', authorize('Admin'), exportLeaves);
router.get('/export/attendance', authorize('Admin'), exportAttendance);

// Leave Requests
router.post('/', createLeaveRequest);
router.get('/me', getMyLeaves);
router.get('/', authorize('Admin', 'Manager'), getAllLeaves);
router.put('/:id/status', authorize('Admin', 'Manager'), updateLeaveStatus);
router.delete('/:id', deleteLeaveRequest);

router.post('/:id/report',
  protect,
  reportUpload.single('report'),
  uploadMedicalReport
);

module.exports = router;
