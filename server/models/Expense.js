const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null   // optional — not all users belong to a team
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },

  // ── Claim category (Training / Office) ───────────────────────────────────────
  expenseCategory: {
    type: String,
    enum: ['Training', 'Office', ''],
    default: ''
  },

  // ── Legacy fields (kept for backward compatibility) ──────────────────────
  title: { type: String, trim: true, default: '' },
  category: {
    type: String,
    enum: ['Travel', 'Meals', 'Supplies', 'Software', 'Other', ''],
    default: ''
  },
  currency: { type: String, default: 'INR' },
  receiptUrl: { type: String, default: null },

  // ── New structured fields ─────────────────────────────────────────────────
  date: { type: Date, default: null },
  location: { type: String, trim: true, default: '' },
  batch: { type: String, trim: true, default: '' },
  course: { type: String, trim: true, default: '' },
  expenseType: {
    type: String,
    trim: true,
    default: ''
  },
  // Self Travel conditional fields
  vehicleType: {
    type: String,
    enum: ['Car', 'Bike', ''],
    default: ''
  },
  distanceKm: { type: Number, default: null },

  amount: { type: Number, required: true, min: 0.01 },
  numberOfPersons: { type: Number, default: 1, min: 1 },
  note: { type: String, trim: true, default: '' },

  // ── Bill / Receipt attachment ─────────────────────────────────────────────
  billImageUrl: { type: String, default: null },
  driveFileId: { type: String, default: null },
  driveViewLink: { type: String, default: null },

  // ── Approval workflow (unchanged) ─────────────────────────────────────────
  dateIncurred: { type: Date, default: null },   // kept for legacy records
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
    default: 'Pending'
  },
  managerNotes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
