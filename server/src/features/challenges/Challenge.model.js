// src/models/Challenge.js
const mongoose = require('mongoose');
const { getPointsForDifficulty } = require('../../../utils/xp');

// A plain `{ name: String, type: String }` object literal is misread by Mongoose:
// the `type` key is its own type-shorthand syntax, so the whole object collapses
// to a bare String schema instead of a subdocument. An explicit Schema avoids that.
const paramSchema = new mongoose.Schema({ name: String, type: String }, { _id: false });

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  // Question type discriminator. 'dsa' is the original code-with-test-cases shape;
  // 'mcq' and 'written' are domain questions. Defaults to 'dsa' so existing
  // challenges read back unchanged and need no migration.
  type: {
    type: String,
    enum: ['dsa', 'mcq', 'written'],
    default: 'dsa',
  },
  // MCQ-only: the answer options and the 0-based index of the correct one, plus an
  // optional explanation revealed after a graded attempt. Never sent to participants
  // before they answer.
  options: [{ type: String }],
  correctOption: { type: Number },
  explanation: { type: String, default: '' },
  // Written-only: the model answer uploaded with the question, revealed on submit.
  modelAnswer: { type: String, default: '' },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  points: { type: Number, default: function () { return getPointsForDifficulty(this.difficulty); } },
  category: { type: String, default: 'Logic' },
  link: { type: String, default: '' }, 
  tags: [{ type: String }], 
  codeSnippets: [{ 
    lang: { type: String },
    langSlug: { type: String },
    code: { type: String },
    _id: false, 
  }],
  solutions: [{ 
    lang: { type: String },
    langSlug: { type: String },
    code: { type: String },
    _id: false, 
  }],
  functionName: { type: String, default: '' },
  params: [paramSchema],
  returnType: { type: String, default: '' },
  // When true, test-case comparison ignores array/element order (e.g. Group Anagrams,
  // where groups and their contents may be returned in any order).
  orderIndependent: { type: Boolean, default: false },
  hints: [{ type: String }],
  testCases: [{
    label: { type: String },
    args: { type: mongoose.Schema.Types.Mixed },
    expected: { type: String },
    _id: false,
  }],
  questionSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet' },
  createdAt: { type: Date, default: Date.now }
});


challengeSchema.index({ createdAt: -1 });
challengeSchema.index({ difficulty: 1, category: 1 });
challengeSchema.index({ tags: 1 });
challengeSchema.index({ questionSetId: 1 });
challengeSchema.index({ type: 1, tags: 1 });
challengeSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Challenge', challengeSchema);
