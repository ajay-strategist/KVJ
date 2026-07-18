const express = require('express');
const router = express.Router();
const { startTimer, pauseTimer, endTimer, getTimer } = require('../controllers/timerController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/:id/timer', getTimer);
router.put('/:id/timer/start', startTimer);
router.put('/:id/timer/pause', pauseTimer);
router.put('/:id/timer/end', endTimer);

module.exports = router;
