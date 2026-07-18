const mongoose = require('mongoose');

const timesheetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  date: { type: Date, required: true },
  hoursSpent: { type: Number, required: true },
  notes: { type: String },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  cost: { type: Number, default: 0 } 
}, { timestamps: true });

module.exports = mongoose.model('Timesheet', timesheetSchema);
