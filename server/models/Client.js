const mongoose = require('mongoose');

// US-A25 – Client company records
const clientSchema = new mongoose.Schema({
  name:          { type: String, required: true, unique: true },
  contactPerson: { type: String },
  email:         { type: String },
  phone:         { type: String },
  gstNumber:     { type: String },
  address:       { type: String },
  notes:         { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
