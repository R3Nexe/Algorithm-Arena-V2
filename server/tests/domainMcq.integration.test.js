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

const makeMcq = (over = {}) =>
  Challenge.create({
    type: 'mcq',
    title: 'Index type',
    description: 'Which index physically orders rows?',
    difficulty: 'Easy', // 100 full points
    options: ['Hash', 'Clustered', 'Bitmap', 'Non-clustered'],
    correctOption: 1,
    explanation: 'A clustered index defines the physical row order.',
    tags: ['databases'],
    ...over,
  });

const gradeMcq = (token, challengeId, selectedOption) =>
  request(app)
    .post('/api/submissions/mcq')
    .set('Authorization', `Bearer ${token}`)
    .send({ challengeId, selectedOption });

test('MCQ correct on first attempt grants full points and masters the question', async () => {
  const user = await registerUser({ username: 'mcq_one', email: 'mcq.one@example.com' });
  const q = await makeMcq();

  const res = await gradeMcq(user.token, q._id.toString(), 1);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.correct, true);
  assert.equal(res.body.data.awardedPoints, 100);
  assert.equal(res.body.data.status, 'Mastered');
  assert.equal(res.body.data.correctOption, 1);

  const dbUser = await User.findById(user.id);
  assert.equal(dbUser.points, 100);
  assert.equal(dbUser.domainMastered, 1);
  assert.equal(dbUser.solvedProblems, 0, 'domain mastery must not touch solvedProblems');
});

test('MCQ wrong answer reveals the answer, grants zero, and sets an escalating cooldown', async () => {
  const user = await registerUser({ username: 'mcq_two', email: 'mcq.two@example.com' });
  const q = await makeMcq();

  const res = await gradeMcq(user.token, q._id.toString(), 0);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.correct, false);
  assert.equal(res.body.data.awardedPoints, 0);
  assert.equal(res.body.data.status, 'NeedsReview');
  assert.equal(res.body.data.correctOption, 1);
  assert.ok(res.body.data.explanation, 'explanation revealed after a graded attempt');
  assert.ok(res.body.data.nextAttemptAt, 'cooldown set');

  const dbUser = await User.findById(user.id);
  assert.equal(dbUser.points, 0);

  // Re-attempt while locked is rejected.
  const locked = await gradeMcq(user.token, q._id.toString(), 1);
  assert.equal(locked.status, 429);
});

test('after cooldown, a correct re-attempt grants the decayed award', async () => {
  const user = await registerUser({ username: 'mcq_three', email: 'mcq.three@example.com' });
  const q = await makeMcq();

  await gradeMcq(user.token, q._id.toString(), 0); // wrong, attempt 1
  // Fast-forward the cooldown at the seam-adjacent state (suite pattern).
  await DomainProgress.updateOne(
    { userId: user.id, challengeId: q._id },
    { $set: { nextAttemptAt: new Date(Date.now() - 1000) } }
  );

  const res = await gradeMcq(user.token, q._id.toString(), 1); // correct, attempt 2
  assert.equal(res.status, 200);
  assert.equal(res.body.data.correct, true);
  assert.equal(res.body.data.awardedPoints, 50, 'Easy attempt 2 = half of 100');
  assert.equal(res.body.data.status, 'Mastered');

  const dbUser = await User.findById(user.id);
  assert.equal(dbUser.points, 50);
  assert.equal(dbUser.domainMastered, 1);
});

test('domain pool browse filters by tag and never leaks answer keys', async () => {
  const user = await registerUser({ username: 'mcq_browse', email: 'mcq.browse@example.com' });
  await makeMcq({ tags: ['databases'] });
  await makeMcq({ title: 'Networking Q', tags: ['networking'] });
  await Challenge.create({
    type: 'written',
    title: 'Explain ACID',
    description: 'Explain the ACID properties.',
    difficulty: 'Medium',
    modelAnswer: 'Atomicity, Consistency, Isolation, Durability...',
    tags: ['databases'],
  });

  const res = await request(app)
    .get('/api/challenges/domain?tags=databases')
    .set('Authorization', `Bearer ${user.token}`);

  assert.equal(res.status, 200);
  const items = res.body.data.items ?? res.body.data;
  assert.equal(items.length, 2, 'only databases-tagged questions');
  for (const item of items) {
    assert.equal('correctOption' in item, false, 'correctOption must be stripped');
    assert.equal('modelAnswer' in item, false, 'modelAnswer must be stripped');
    assert.equal('explanation' in item, false, 'explanation must be stripped');
    assert.ok('masteryStatus' in item, 'per-question mastery state present');
  }
});
