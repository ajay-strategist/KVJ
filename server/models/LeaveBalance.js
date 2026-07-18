const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year: { type: Number, required: true, default: () => new Date().getFullYear() },
  totalDays: { type: Number, required: true, default: 0 },
  usedDays: { type: Number, default: 0 }
}, { timestamps: true });

leaveBalanceSchema.virtual('remainingDays').get(function() {
  return Math.max(0, this.totalDays - this.usedDays);
});

leaveBalanceSchema.set('toJSON', { virtuals: true });
leaveBalanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
