const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAdminWorklog } = require('../controllers/adminWorklogController');

// GET /api/admin/worklog?userId=&from=&to=
router.get('/', protect, authorize('Admin'), getAdminWorklog);

module.exports = router;
