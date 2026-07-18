const express = require('express');
const router  = express.Router();
const {
  getExpenses,
  createExpense,
  uploadBillImage,
  uploadBill,
  updateExpenseStatus,
  approveEmployeeExpenses,
  payEmployeeExpenses,
  deleteExpense,
  exportExpenses,
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadBill: uploadBillMiddleware } = require('../config/cloudinary');

router.use(protect);

// Admin-only CSV export — must be before /:id routes
router.get('/export', authorize('Admin'), exportExpenses);

// Upload bill image before creating expense — returns URL only
router.post('/upload-bill', uploadBillMiddleware.single('bill'), uploadBillImage);

router.route('/')
  .get(getExpenses)
  .post(uploadBillMiddleware.single('bill'), createExpense);

router.post('/bulk-approve', authorize('Admin'), approveEmployeeExpenses);
router.post('/bulk-pay', authorize('Admin'), payEmployeeExpenses);

// Attach bill to existing expense (owner or Admin)
router.post('/:id/bill', uploadBillMiddleware.single('bill'), uploadBill);

router.put('/:id/status', authorize('Admin'), updateExpenseStatus);
router.delete('/:id', deleteExpense);

module.exports = router;
