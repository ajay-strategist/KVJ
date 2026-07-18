const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String, required: true },
  natureOfLeave: { type: String, enum: ['Medical', 'Personal'], required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  managerComment: { type: String },
  daysTaken: { type: Number, required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isHalfDay:              { type: Boolean, default: false },
  halfDaySlot:            { type: String, enum: ['Morning', 'Evening'], default: null },
  medicalReportDriveId:   { type: String, default: null },
  medicalReportDriveLink: { type: String, default: null },
  reportStatus: {
    type: String,
    enum: ['Not Required', 'Pending', 'Submitted', 'Overdue'],
    default: 'Not Required'
  },
  reportDeadline: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
