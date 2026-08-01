const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  challengeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Challenge', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  repositoryUrl: { type: String }, // Optional: Github Link
  code: { type: String },          // Optional: Direct Code Paste
  language: { type: String, default: 'javascript' },
  // Domain-question answers: the chosen 0-based option (MCQ) or prose (written).
  selectedOption: { type: Number },
  answerText: { type: String },
  // Points this submission actually granted. For MCQ this is the decayed amount and
  // differs from the challenge's full points; recorded so reverts subtract exactly.
  awardedPoints: { type: Number },
  status: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'Rejected'], 
    default: 'Pending' 
  },
  feedback: { type: String }, // Chief feedback
  userFeedback: { type: String }, // User feedback when submitted anyway
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },
  // Aggregate Judge0 stats from the test-case run that gated this submission.
  // Native Judge0 units: seconds (decimal) and kilobytes (integer). Absent on
  // submissions predating this field or made via repo-link only.
  execTimeSec: { type: Number },
  execMemoryKb: { type: Number }
});

submissionSchema.index({ userId: 1, submittedAt: -1 });
submissionSchema.index({ challengeId: 1, submittedAt: -1 });
submissionSchema.index({ status: 1, submittedAt: -1 });
submissionSchema.index({ userId: 1, challengeId: 1, status: 1, submittedAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);

