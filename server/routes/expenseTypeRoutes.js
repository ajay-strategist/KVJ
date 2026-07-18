const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/expenseTypeController');

router.get('/', protect, ctrl.getExpenseTypes);
router.post('/', protect, ctrl.createExpenseType);

module.exports = router;
