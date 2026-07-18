const express = require('express');
const router = express.Router();
const { getProjects, createProject, updateProject, deleteProject, exportProjects, getProjectMembers, getProjectTasks } = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/export', authorize('Admin'), exportProjects);

router.route('/')
  .get(getProjects)                      // All authenticated users can view projects
  .post(authorize('Admin'), createProject);

router.route('/:id')
  .put(authorize('Admin', 'Manager'), updateProject)
  .delete(authorize('Admin'), deleteProject);

router.get('/:id/members', getProjectMembers);
router.get('/:id/tasks', getProjectTasks);

module.exports = router;
