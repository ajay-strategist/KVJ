const mongoose = require('mongoose');

const publicHolidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('PublicHoliday', publicHolidaySchema);
