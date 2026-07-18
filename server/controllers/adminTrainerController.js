const User = require('../models/User');

// @desc    Toggle isTrainer on a user
// @route   PATCH /api/admin/users/:id/trainer
// @access  Admin only
exports.setTrainerStatus = async (req, res) => {
  try {
    const { isTrainer } = req.body;
    if (typeof isTrainer !== 'boolean') {
      return res.status(400).json({ message: 'isTrainer must be a boolean.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isTrainer },
      { new: true, select: '-password' }
    );

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Emit real-time update so the user's sidebar refreshes without re-login
    const io = req.app.get('io');
    if (io) {
      io.emit('userUpdated', {
        userId: user._id,
        team: user.team,
        role: user.role,
        isTrainer: user.isTrainer
      });
    }

    res.json({ message: `Trainer status ${isTrainer ? 'enabled' : 'disabled'}.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
