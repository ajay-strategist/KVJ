const express = require('express');
const router = express.Router();
const { 
  getChannels, 
  createChannel, 
  addMember, 
  removeMember, 
  getOrCreateDM, 
  getDMs, 
  getMessages, 
  getThread, 
  sendMessage, 
  getAllUsers, 
  getMentionCounts 
} = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.use(protect);

router.route('/channels')
  .get(getChannels)
  .post(authorize('Admin', 'Manager'), createChannel);

router.route('/channels/:channelId/members')
  .post(authorize('Admin', 'Manager'), addMember);

router.route('/channels/:channelId/members/:userId')
  .delete(authorize('Admin', 'Manager'), removeMember);

router.route('/dm')
  .get(getDMs)
  .post(getOrCreateDM);

router.route('/users')
  .get(getAllUsers);

router.route('/mentions')
  .get(getMentionCounts);

router.route('/channels/:channelId/messages')
  .get(getMessages)
  .post(upload.single('file'), sendMessage);

router.route('/messages/:messageId/thread')
  .get(getThread);

module.exports = router;
