const express = require('express');
const router = express.Router();
const { 
  getTeams, 
  createTeam, 
  updateTeam, 
  deleteTeam,
  getTeamMembers
} = require('../controllers/teamController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Anyone logged in can view teams
router.get('/', getTeams);
router.get('/:id/members', getTeamMembers);

// Only admins can create, update, delete teams
router.post('/', authorize('Admin'), createTeam);
router.put('/:id', authorize('Admin'), updateTeam);
router.delete('/:id', authorize('Admin'), deleteTeam);

module.exports = router;
