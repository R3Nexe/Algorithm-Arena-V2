const mongoose = require('mongoose');

const xpLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    enum: ['Daily Login', 'Challenge Accepted', 'Submission Reverted', 'Domain Mastered', 'Domain Reverted'],
    required: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

xpLogSchema.index({ userId: 1, reason: 1 });

module.exports = mongoose.model('XpLog', xpLogSchema);
