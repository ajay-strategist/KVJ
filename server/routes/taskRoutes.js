const express = require('express');
const router = express.Router();
const {
  getTasks, createTask, updateTask, deleteTask, claimTask, logTime, exportTasks,
  getArchivedTasks,
  postComment, getComments,
  initiateTransfer, acceptTransfer, rejectTransfer, getPendingTransfers,
  getAdminPendingTransfers, approveTransferAdmin, rejectTransferAdmin,
  getManagerPendingTasks, approveManagerTask, rejectManagerTask
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Export (must be before /:id routes)
router.get('/export', authorize('Admin'), exportTasks);

// Archived tasks
router.get('/archived', getArchivedTasks);

// Pending transfers for logged-in user
router.get('/transfers/pending', getPendingTransfers);

// Admin pending transfers
router.get('/transfers/admin/pending', authorize('Admin'), getAdminPendingTransfers);
router.patch('/:id/transfer/admin/approve', authorize('Admin'), approveTransferAdmin);
router.patch('/:id/transfer/admin/reject', authorize('Admin'), rejectTransferAdmin);

// Manager assignment approval (admin)
router.get('/manager-pending', authorize('Admin'), getManagerPendingTasks);
router.patch('/:id/manager-approve', authorize('Admin'), approveManagerTask);
router.patch('/:id/manager-reject', authorize('Admin'), rejectManagerTask);

// Core CRUD
router.route('/')
  .get(getTasks)
  .post(createTask);

router.put('/:id/claim', claimTask);
router.post('/:id/log-time', logTime);

// Comments
router.get('/:id/comments', getComments);
router.post('/:id/comments', postComment);

// Transfer
router.post('/:id/transfer', initiateTransfer);
router.patch('/:id/transfer/accept', acceptTransfer);
router.patch('/:id/transfer/reject', rejectTransfer);

// Update / Delete
router.route('/:id')
  .put(updateTask)
  .delete(authorize('Admin', 'Manager'), deleteTask);

module.exports = router;
