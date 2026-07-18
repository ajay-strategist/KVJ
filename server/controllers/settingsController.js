const Settings = require('../models/Settings');

// Helper: get or create the singleton settings document
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({});
  if (!settings) settings = await Settings.create({});
  return settings;
};

// @desc    Get platform settings
// @route   GET /api/settings
// @access  Private (all authenticated — frontend needs task statuses/modules)
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update platform settings (partial patch)
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    // US-A24 – custom task status and priority labels
    if (Array.isArray(req.body.taskStatuses) && req.body.taskStatuses.length > 0) {
      settings.taskStatuses = req.body.taskStatuses;
    }
    if (Array.isArray(req.body.taskPriorities) && req.body.taskPriorities.length > 0) {
      settings.taskPriorities = req.body.taskPriorities;
    }

    // US-A26 – module toggles (merge, don't overwrite whole object)
    if (req.body.enabledModules && typeof req.body.enabledModules === 'object') {
      Object.assign(settings.enabledModules, req.body.enabledModules);
      settings.markModified('enabledModules');
    }

    if (req.body.orgName)  settings.orgName  = req.body.orgName;
    if (req.body.orgLogo)  settings.orgLogo  = req.body.orgLogo;

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
