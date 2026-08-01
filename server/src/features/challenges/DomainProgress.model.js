const mongoose = require('mongoose');

// A participant's flashcard state for one domain question. Holds what a Submission
// cannot: the attempt count, mastery bucket, cooldown timestamp, and (for written)
// the self-assessment. One record per participant per question.
const domainProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
  },
  type: {
    type: String,
    enum: ['mcq', 'written'],
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['NeedsReview', 'Mastered'],
    required: true,
  },
  // When the question unlocks for re-attempt; null once Mastered.
  nextAttemptAt: {
    type: Date,
    default: null,
  },
  // Written-only: the participant's own Got it / Review later judgement.
  selfAssessment: {
    type: String,
    enum: ['gotIt', 'reviewLater'],
    default: null,
  },
  // Points already granted for this question (avoids double-awarding).
  awardedPoints: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

domainProgressSchema.index({ userId: 1, challengeId: 1 }, { unique: true });
domainProgressSchema.index({ userId: 1, status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('DomainProgress', domainProgressSchema);
