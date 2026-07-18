const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  fileUrl: { type: String },
  fileType: { type: String },
  fileName: { type: String },
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
