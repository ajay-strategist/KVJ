const ExpenseType = require('../models/ExpenseType');

exports.getExpenseTypes = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const types = await ExpenseType.find(filter).sort({ name: 1 });
    res.json(types);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.createExpenseType = async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: 'Name and category are required' });
    }
    const existing = await ExpenseType.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      category 
    });
    if (existing) {
      return res.status(409).json({ message: 'This expense type already exists' });
    }
    const type = await ExpenseType.create({ name: name.trim(), category });
    res.status(201).json(type);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
