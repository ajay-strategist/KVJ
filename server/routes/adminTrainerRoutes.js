const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { setTrainerStatus } = require('../controllers/adminTrainerController');

// PATCH /api/admin/users/:id/trainer
router.patch('/:id/trainer', protect, authorize('Admin'), setTrainerStatus);

module.exports = router;
