const TrainingBatch = require('../models/TrainingBatch');
const College = require('../models/College');
const Course = require('../models/Course');

exports.getBatches = async (req, res) => {
  try {
    const batches = await TrainingBatch.find()
      .populate('college', 'name')
      .populate('course', 'name')
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createBatch = async (req, res) => {
  try {
    const { college, course, batch } = req.body;
    
    const existing = await TrainingBatch.findOne({ college, course, batch });
    if (existing) {
      return res.status(400).json({ message: 'A training batch with this combination already exists.' });
    }

    const newBatch = await TrainingBatch.create({
      college,
      course,
      batch,
      createdBy: req.user._id,
    });

    const populatedBatch = await TrainingBatch.findById(newBatch._id)
      .populate('college', 'name')
      .populate('course', 'name');

    const io = req.app.get('io');
    if (io) io.emit('batchCreated', populatedBatch);

    res.status(201).json(populatedBatch);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager' && !req.user.isTrainer) {
      return res.status(403).json({ message: 'Not authorized to update batches' });
    }
    const { college, course, batch } = req.body;
    
    const existing = await TrainingBatch.findOne({ college, course, batch, _id: { $ne: req.params.id } });
    if (existing) {
      return res.status(400).json({ message: 'A training batch with this combination already exists.' });
    }

    const updatedBatch = await TrainingBatch.findByIdAndUpdate(
      req.params.id,
      { college, course, batch },
      { new: true }
    ).populate('college', 'name').populate('course', 'name');

    if (!updatedBatch) return res.status(404).json({ message: 'Batch not found' });

    const io = req.app.get('io');
    if (io) io.emit('batchUpdated', updatedBatch);

    res.json(updatedBatch);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await TrainingBatch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const io = req.app.get('io');
    if (io) io.emit('batchDeleted', req.params.id);

    res.json({ message: 'Batch deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getColleges = async (req, res) => {
  try {
    const colleges = await College.find().sort({ name: 1 });
    res.json(colleges);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createCollege = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    const existing = await College.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'College name already exists' });
    
    const college = await College.create({ name: name.trim() });
    res.status(201).json(college);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'College name already exists' });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    const existing = await Course.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) return res.status(400).json({ message: 'Course name already exists' });
    
    const course = await Course.create({ name: name.trim() });
    res.status(201).json(course);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Course name already exists' });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
