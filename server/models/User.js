const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Employee'], default: 'Employee' },
  status: { type: String, enum: ['Pending', 'Active', 'Deactivated'], default: 'Pending' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  grade: { type: String, enum: ['Intern', 'Junior', 'Senior', 'Lead'], default: null },
  salaryRate: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now },
  googleCalendar: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
    connected: { type: Boolean, default: false }
  },
  isTrainer: { type: Boolean, default: false }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
