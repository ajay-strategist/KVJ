const mongoose = require('mongoose');

const taskTransferSchema = new mongoose.Schema({
  task:       { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  fromUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:     { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
  adminStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
}, { timestamps: true });

module.exports = mongoose.model('TaskTransfer', taskTransferSchema);
