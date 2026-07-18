const express = require('express');
const router = express.Router();
const {
  getBatches, createBatch, updateBatch, deleteBatch, getColleges, createCollege, getCourses, createCourse
} = require('../controllers/trainingBatchController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/colleges')
  .get(getColleges)
  .post(createCollege);

router.route('/courses')
  .get(getCourses)
  .post(createCourse);

router.route('/')
  .get(getBatches)
  .post(createBatch);

router.route('/:id')
  .put(updateBatch)
  .delete(authorize('Admin'), deleteBatch);

module.exports = router;
