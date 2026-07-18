const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  client: { type: String }, 
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['Active', 'On Hold', 'Completed'], default: 'Active' },
  projectGroup: { type: String },
  managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
