const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  daysPerYear: { type: Number, required: true, default: 0 },
  isCustom: { type: Boolean, default: false },
  color: { type: String, default: '#3B82F6' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
