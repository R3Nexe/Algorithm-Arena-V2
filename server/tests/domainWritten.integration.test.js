const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let User;
let Challenge;
let DomainProgress;
let Submission;

const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_secret_for_algorithm_arena_12345';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  ({ app } = require('../server'));
  User = require('../src/features/users/User.model.js');
  Challenge = require('../src/features/challenges/Challenge.model.js');
  DomainProgress = require('../src/features/challenges/DomainProgress.model.js');
  Submission = require('../src/features/submissions/Submission.model.js');
  await mongoose.connect(process.env.MONGO_URI);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.beforeEach(async () => {
  await clearDatabase();
});

const registerUser = async ({ username, email }) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'strong-password' });
  assert.equal(res.status, 201);
  return { id: res.body.data._id, token: res.body.data.token };
};

const registerAdmin = async () => {
  const admin = await registerUser({ username: 'w_admin', email: 'w.admin@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'w.admin@example.com', password: 'strong-password' });
  return login.body.data.token;
};

const makeWritten = () =>
  Challenge.create({
    type: 'written',
    title: 'Explain ACID',
    description: 'Explain the ACID properties of a transaction.',
    difficulty: 'Medium', // 200 full points
    modelAnswer: 'Atomicity, Consistency, Isolation, Durability.',
    tags: ['databases'],
  });

const submitWritten = (token, challengeId, answerText) =>
  request(app)
    .post('/api/submissions/written')
    .set('Authorization', `Bearer ${token}`)
    .send({ challengeId, answerText });

const selfAssess = (token, challengeId, gotIt) =>
  request(app)
    .post('/api/challenges/domain/self-assess')
    .set('Authorization', `Bearer ${token}`)
    .send({ challengeId, gotIt });

test('submitting a written answer creates a Pending submission and reveals the model answer', async () => {
  const user = await registerUser({ username: 'w_one', email: 'w.one@example.com' });
  const q = await makeWritten();

  const res = await submitWritten(user.token, q._id.toString(), 'ACID stands for...');
  assert.equal(res.status, 201);
  assert.ok(res.body.data.modelAnswer.includes('Atomicity'));

  const sub = await Submission.findOne({ userId: user.id, challengeId: q._id });
  assert.equal(sub.status, 'Pending');
  assert.equal(sub.answerText, 'ACID stands for...');
});

test('self-assess "Got it" masters the question and moves domainMastered, awarding no points', async () => {
  const user = await registerUser({ username: 'w_two', email: 'w.two@example.com' });
  const q = await makeWritten();
  await submitWritten(user.token, q._id.toString(), 'my answer');

  const res = await selfAssess(user.token, q._id.toString(), true);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'Mastered');

  const dbUser = await User.findById(user.id);
  assert.equal(dbUser.domainMastered, 1);
  assert.equal(dbUser.points, 0, 'self-assessment never awards points');
});

test('self-assess "Review later" sets a cooldown and does not master', async () => {
  const user = await registerUser({ username: 'w_three', email: 'w.three@example.com' });
  const q = await makeWritten();
  await submitWritten(user.token, q._id.toString(), 'my answer');

  const res = await selfAssess(user.token, q._id.toString(), false);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'NeedsReview');
  assert.ok(res.body.data.nextAttemptAt, 'cooldown set');

  const dbUser = await User.findById(user.id);
  assert.equal(dbUser.domainMastered, 0);
});

test('reviewer approval awards full points but leaves solvedProblems, codingLevel, and domainMastered untouched', async () => {
  const adminToken = await registerAdmin();
  const user = await registerUser({ username: 'w_four', email: 'w.four@example.com' });
  const q = await makeWritten();
  const submitRes = await submitWritten(user.token, q._id.toString(), 'a strong answer');
  const submissionId = submitRes.body.data.submissionId;

  const before = await User.findById(user.id);

  const review = await request(app)
    .put(`/api/submissions/${submissionId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Accepted' });
  assert.equal(review.status, 200);

  const after = await User.findById(user.id);
  assert.equal(after.points, before.points + 200, 'full Medium points awarded');
  assert.equal(after.solvedProblems, before.solvedProblems, 'solvedProblems untouched');
  assert.equal(after.codingLevel, before.codingLevel, 'codingLevel untouched');
  assert.equal(after.domainMastered, before.domainMastered, 'review does not touch mastery');
});
