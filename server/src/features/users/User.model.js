const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  authProvider: {
    type: String,
    enum: ['google', 'local'],
    default: 'google',
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be at most 30 characters'],
  },
  usernameSet: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: '',
    trim: true,
    maxlength: 60,
    validate: {
      validator: (v) => !v || /^[\p{L}\w\s'\-\.\(\),]+$/u.test(v),
      message: 'Name contains invalid characters',
    },
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'clan-chief', 'superAdmin'],
    default: 'user',
  },
  customTitle: {
    type: String,
    default: '',
    maxlength: 30,
  },
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    default: null,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  regNo: {
    type: String,
    validate: {
      validator: (v) => !v || /^[a-zA-Z0-9]{6,20}$/.test(v),
      message: 'Invalid registration number format',
    },
  },
  codingLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner',
  },
  codingLevelOverridden: {
    type: Boolean,
    default: false,
  },
  preferredLanguage: {
    type: String,
    enum: ['javascript', 'python', 'java', 'cpp', 'c'],
    default: 'javascript',
  },
  editorThemeDark: {
    type: String,
    enum: ['default', 'algo-arena-dark', 'vs-dark', 'hc-black', 'dracula', 'one-dark', 'monokai', 'nord', 'github-dark'],
    default: 'default',
  },
  editorThemeLight: {
    type: String,
    enum: ['default', 'algo-arena-light', 'vs', 'solarized-light'],
    default: 'default',
  },
  preferredTheme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark',
  },
  points: {
    type: Number,
    default: 0,
  },
  streak: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Warned', 'Banned'],
    default: 'Active',
  },
  warningMessage: {
    type: String,
    default: null,
  },
  solvedProblems: {
    type: Number,
    default: 0,
  },
  // Count of mastered domain questions, tracked separately from solvedProblems so
  // domain progress never shifts DSA badges or codingLevel.
  domainMastered: {
    type: Number,
    default: 0,
  },
  lastLoginDate: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  bio: { type: String, default: '' },
  branch: { type: String, default: '' },
  year: { type: String, default: '', enum: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', ''] },
  section: { type: String, default: '' },
  lastConfirmedAt: {
    type: Date,
    default: null,
  },
  location: { type: String, default: '' },
  github: { type: String, default: '' },
  twitter: { type: String, default: '' },
  awardedBadgeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }],
  linkedin: { type: String, default: '' },
  website: { type: String, default: '' },
  featuredBadge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', default: null },
});

// Partial unique indexes: only documents where the field is a string are
// indexed, so multiple users without a username/regNo (or with null) never
// collide. A plain `sparse` unique index would still index explicit `null`s
// and throw E11000 dup key errors.
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);
userSchema.index(
  { regNo: 1 },
  { unique: true, partialFilterExpression: { regNo: { $type: 'string' } } }
);

userSchema.index({ clan: 1 });
userSchema.index({ points: -1, solvedProblems: -1 });

module.exports = mongoose.model('User', userSchema);
