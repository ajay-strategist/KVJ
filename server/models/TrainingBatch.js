const mongoose = require('mongoose');

const trainingBatchSchema = new mongoose.Schema({
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

trainingBatchSchema.index({ college: 1, course: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model('TrainingBatch', trainingBatchSchema);
