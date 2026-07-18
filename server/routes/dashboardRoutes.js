const express = require('express');
const router = express.Router();
const { getAdminStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/admin', authorize('Admin'), getAdminStats);

module.exports = router;
