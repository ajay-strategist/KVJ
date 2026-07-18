const mongoose = require('mongoose');

const trainerLogSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:         { type: Date, required: true },
  organisation: { type: String, required: true },
  type:         { type: String, enum: ['Class', 'Work', 'Meeting', 'Supervision', 'Marketing'], required: true },
  mode:         { type: String, enum: ['Online', 'Offline'], required: true },
  startTime:    { type: String, required: true },
  endTime:      { type: String, required: true },
  duration:     { type: Number }, // stored in minutes
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrainerLog', trainerLogSchema);
