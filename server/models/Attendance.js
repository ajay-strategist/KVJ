const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  label: { type: String, enum: ['Normal', 'Weekend', 'Public Holiday', 'Auto-closed', 'Half Day (Morning Leave)', 'Half Day (Evening Leave)'], default: 'Normal' },
  clockInTime: { type: Date },
  clockOutTime: { type: Date },
  clockInLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    city: { type: String }
  },
  breaks: [{
    breakInTime: { type: Date },
    breakOutTime: { type: Date }
  }],
  totalBreakDurationMinutes: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
  // US-A21 – Audit log for every admin correction
  correctionLog: [{
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    correctedAt:  { type: Date, default: Date.now },
    note:         { type: String },
    previous: {
      clockInTime:  { type: Date },
      clockOutTime: { type: Date },
      totalBreakDurationMinutes: { type: Number }
    },
    updated: {
      clockInTime:  { type: Date },
      clockOutTime: { type: Date },
      totalBreakDurationMinutes: { type: Number }
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
