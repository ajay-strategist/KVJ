const mongoose = require('mongoose');
const expenseTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    enum: ['Training', 'Office'], 
    required: true 
  }
}, { timestamps: true });
expenseTypeSchema.index({ name: 1, category: 1 }, { unique: true });
module.exports = mongoose.model('ExpenseType', expenseTypeSchema);
