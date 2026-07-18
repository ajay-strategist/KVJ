const express = require('express');
const router = express.Router();
const { getClients, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getClients)                        // All authenticated users can read clients
  .post(authorize('Admin'), createClient); // Admin-only create

router.route('/:id')
  .put(authorize('Admin'), updateClient)
  .delete(authorize('Admin'), deleteClient);

module.exports = router;
