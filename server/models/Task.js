const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null means team pool
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  dueDate: { type: Date },
  priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, default: 'To Do' },
  isOverdue: { type: Boolean, default: false },
  flaggedForReview: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // FR-08.10 Recurring task support
  recurring: { 
    type: String, 
    enum: ['none', 'daily', 'weekly', 'monthly'], 
    default: 'none' 
  },
  // FR-08.12 Time logging on tasks
  timeLogs: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hours: { type: Number, required: true },
    notes: { type: String },
    date: { type: Date, default: Date.now }
  }],
  // Real-time task timer (Feature 5)
  timer: {
    isRunning:    { type: Boolean, default: false },
    startedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt:    { type: Date, default: null },
    totalSeconds: { type: Number, default: 0 }  // accumulated paused seconds
  },
  // FR-08.21 Archiving
  archived:       { type: Boolean, default: false },
  completedDate:  { type: Date, default: null },
  // FR-08.20 Transfer
  transferPending: { type: Boolean, default: false },
  transferStatus: { type: String, enum: ['None', 'Pending'], default: 'None' },
  // Manager → Admin approval workflow
  managerApprovalPending: { type: Boolean, default: false },
  pendingAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
