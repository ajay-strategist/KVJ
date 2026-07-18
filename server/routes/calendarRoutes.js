const express = require('express');
const router = express.Router();
const { getAuthUrl, connectCalendar, disconnectCalendar, getConnectionStatus } = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/auth-url', getAuthUrl);
router.post('/connect', connectCalendar);
router.post('/disconnect', disconnectCalendar);
router.get('/status', getConnectionStatus);

module.exports = router;
