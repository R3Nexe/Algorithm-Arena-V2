const mongoose = require('mongoose');

const questionSetSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Set title is required'],
    trim: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  targetLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Both'],
    default: 'Both'
  },
  questions: [{
    title: String,
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
    points: Number,
    category: String,
    description: String,
    hints: [String],
    tags: [String],
    codeSnippets: [{
      lang: String,
      langSlug: String,
      code: String
    }],
    functionName: { type: String, default: '' },
    testCases: [{
      label: { type: String },
      args: { type: mongoose.Schema.Types.Mixed },
      expected: { type: String },
      _id: false
    }]
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['Draft', 'Published'],
    default: 'Published'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QuestionSet', questionSetSchema);
