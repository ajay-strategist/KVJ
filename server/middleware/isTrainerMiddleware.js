// Middleware: only allow users with isTrainer === true
exports.isTrainer = (req, res, next) => {
  if (!req.user || !req.user.isTrainer) {
    return res.status(403).json({ message: 'Access denied. Trainer role required.' });
  }
  next();
};
