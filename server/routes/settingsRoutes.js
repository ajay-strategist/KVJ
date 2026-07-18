const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSettings)                          // All authenticated users (frontend reads task statuses/modules)
  .put(authorize('Admin'), updateSettings);  // Admin-only write

module.exports = router;
