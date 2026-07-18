const User = require('../models/User');
const calendarService = require('../services/calendarService');

// @desc    Get Google OAuth URL
// @route   GET /api/calendar/auth-url
// @access  Private
exports.getAuthUrl = (req, res) => {
  try {
    const url = calendarService.getAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Error generating auth URL', error: error.message });
  }
};

// @desc    Handle OAuth callback and save tokens
// @route   POST /api/calendar/connect
// @access  Private
exports.connectCalendar = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const tokens = await calendarService.getTokens(code);

    const user = await User.findById(req.user._id);
    user.googleCalendar = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.googleCalendar?.refreshToken, // Keep existing if not provided
      expiryDate: tokens.expiry_date,
      connected: true
    };

    await user.save();
    
    res.json({ message: 'Google Calendar connected successfully', connected: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to connect Google Calendar', error: error.message });
  }
};

// @desc    Disconnect Google Calendar
// @route   POST /api/calendar/disconnect
// @access  Private
exports.disconnectCalendar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.googleCalendar = {
      accessToken: null,
      refreshToken: null,
      expiryDate: null,
      connected: false
    };
    await user.save();
    res.json({ message: 'Google Calendar disconnected' });
  } catch (error) {
    res.status(500).json({ message: 'Error disconnecting calendar', error: error.message });
  }
};

// @desc    Check connection status
// @route   GET /api/calendar/status
// @access  Private
exports.getConnectionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ connected: !!user.googleCalendar?.connected });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
