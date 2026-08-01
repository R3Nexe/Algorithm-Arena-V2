const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
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

const makeQuestion = (title) =>
  Challenge.create({ type: 'mcq', title, description: 'a domain question', difficulty: 'Easy', options: ['a', 'b'], correctOption: 0, tags: ['databases'] });

test('due-for-review returns only NeedsReview questions whose cooldown has expired', async () => {
  const user = await registerUser({ username: 'due_one', email: 'due.one@example.com' });
  const past = await makeQuestion('Due now');
  const future = await makeQuestion('Still locked');
  const mastered = await makeQuestion('Already mastered');

  await DomainProgress.create({ userId: user.id, challengeId: past._id, type: 'mcq', status: 'NeedsReview', attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) });
  await DomainProgress.create({ userId: user.id, challengeId: future._id, type: 'mcq', status: 'NeedsReview', attempts: 1, nextAttemptAt: new Date(Date.now() + 86400000) });
  await DomainProgress.create({ userId: user.id, challengeId: mastered._id, type: 'mcq', status: 'Mastered', attempts: 1, nextAttemptAt: null });

  const res = await request(app)
    .get('/api/challenges/domain/due')
    .set('Authorization', `Bearer ${user.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.count, 1);
  const items = res.body.data.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Due now');
});

test('due-for-review is scoped to the caller', async () => {
  const owner = await registerUser({ username: 'due_owner', email: 'due.owner@example.com' });
  const other = await registerUser({ username: 'due_other', email: 'due.other@example.com' });
  const q = await makeQuestion('Owner due');
  await DomainProgress.create({ userId: owner.id, challengeId: q._id, type: 'mcq', status: 'NeedsReview', attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) });

  const res = await request(app)
    .get('/api/challenges/domain/due')
    .set('Authorization', `Bearer ${other.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.count, 0);
});
