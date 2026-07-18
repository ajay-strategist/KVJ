const mongoose = require('mongoose');

// US-A24 – Custom task status/priority labels
// US-A26 – Module toggles
// Singleton pattern: only one Settings document per org
const settingsSchema = new mongoose.Schema({
  // US-A24 – Configurable task workflow labels
  taskStatuses: {
    type: [String],
    default: ['To Do', 'In Progress', 'In Review', 'Done']
  },
  taskPriorities: {
    type: [String],
    default: ['Critical', 'High', 'Medium', 'Low']
  },
  // US-A26 – Enable/disable platform modules
  enabledModules: {
    attendance:  { type: Boolean, default: true },
    leaves:      { type: Boolean, default: true },
    timesheets:  { type: Boolean, default: true },
    projects:    { type: Boolean, default: true },
    chat:        { type: Boolean, default: true },
    teams:       { type: Boolean, default: true }
  },
  // Organisation info
  orgName:    { type: String, default: 'FlowDesk' },
  orgLogo:    { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
