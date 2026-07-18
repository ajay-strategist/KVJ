const Client = require('../models/Client');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private (all authenticated)
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.find({}).sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a client
// @route   POST /api/clients
// @access  Private/Admin
exports.createClient = async (req, res) => {
  try {
    const { name, contactPerson, email, phone, gstNumber, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Client name is required' });

    const exists = await Client.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (exists) return res.status(400).json({ message: 'A client with this name already exists' });

    const client = await Client.create({ name, contactPerson, email, phone, gstNumber, address, notes });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update a client
// @route   PUT /api/clients/:id
// @access  Private/Admin
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private/Admin
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
