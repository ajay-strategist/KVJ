const express = require('express');
const router = express.Router();
const {
  getUsers,
  approveUser,
  rejectUser,
  updateUserStatus,
  updateUser,
  exportUsers,
  exportPerformanceCsv,
  deleteUser
} = require('../controllers/userController');
const { getMemberProfile } = require('../controllers/profileController');
const { protect, authorize } = require('../middleware/authMiddleware');
const performanceReportController = require('../controllers/performanceReportController');

router.use(protect);

// Read — Admin sees all; Manager sees own team (filtered in controller)
router.get('/', authorize('Admin', 'Manager'), getUsers);
router.get('/export', authorize('Admin'), exportUsers);

// Write — Admin only
router.put('/:id', authorize('Admin'), updateUser);
router.delete('/:id', authorize('Admin'), deleteUser);
router.put('/:id/approve', authorize('Admin'), approveUser);
router.put('/:id/reject', authorize('Admin'), rejectUser);
router.put('/:id/status', authorize('Admin'), updateUserStatus);

// US-M21 – Member profile dashboard (Admin + Manager)
router.get('/:id/profile', authorize('Admin', 'Manager'), getMemberProfile);

// Performance report — detailed JSON and CSV export
router.get('/:id/performance-report', authorize('Admin'), async (req, res) => {
  req.query.userId = req.params.id;
  return performanceReportController.getDetailedReport(req, res);
});

router.get('/:id/performance-csv', authorize('Admin'), async (req, res) => {
  req.query.userId = req.params.id;
  return performanceReportController.exportDetailedReportXlsx(req, res);
});


module.exports = router;
