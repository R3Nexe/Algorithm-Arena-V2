const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let User;
let Challenge;

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
  const admin = await registerUser({ username: 'auth_admin', email: 'auth.admin@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'auth.admin@example.com', password: 'strong-password' });
  return login.body.data.token;
};

const post = (token, url, body) =>
  request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

const validMcq = (over = {}) => ({
  type: 'mcq',
  title: 'Which index orders rows',
  description: 'Pick the physically-ordering index type.',
  difficulty: 'Easy',
  options: ['Hash', 'Clustered', 'Bitmap', 'Non-clustered'],
  correctOption: 1,
  explanation: 'Clustered.',
  tags: ['databases'],
  ...over,
});

test('admin can author an MCQ question with options and a correct option', async () => {
  const token = await registerAdmin();
  const res = await post(token, '/api/challenges', validMcq());
  assert.equal(res.status, 201);

  const saved = await Challenge.findById(res.body.data._id);
  assert.equal(saved.type, 'mcq');
  assert.equal(saved.options.length, 4);
  assert.equal(saved.correctOption, 1);
});

test('subject is persisted and returned in the domain pool', async () => {
  const token = await registerAdmin();
  const res = await post(token, '/api/challenges', validMcq({ subject: 'System Design', tags: ['cache'] }));
  assert.equal(res.status, 201);

  const saved = await Challenge.findById(res.body.data._id);
  assert.equal(saved.subject, 'System Design');

  const pool = await request(app)
    .get('/api/challenges/domain')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(pool.status, 200);
  const item = pool.body.data.items.find((i) => i._id === res.body.data._id);
  assert.equal(item.subject, 'System Design');
});

test('MCQ with fewer than two options is rejected', async () => {
  const token = await registerAdmin();
  const res = await post(token, '/api/challenges', validMcq({ options: ['only one'] }));
  assert.equal(res.status, 400);
});

test('written question without a model answer is rejected', async () => {
  const token = await registerAdmin();
  const res = await post(token, '/api/challenges', {
    type: 'written',
    title: 'Explain ACID properties',
    description: 'Explain the ACID properties of a transaction.',
    difficulty: 'Medium',
    tags: ['databases'],
  });
  assert.equal(res.status, 400);
});

test('bulk upload inserts valid entries and reports per-entry failures', async () => {
  const token = await registerAdmin();
  const res = await post(token, '/api/challenges/domain/bulk', {
    questions: [
      validMcq(),
      validMcq({ correctOption: undefined }), // invalid: no correct option
    ],
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.createdCount, 1);
  assert.equal(res.body.data.failures.length, 1);
  assert.equal(res.body.data.failures[0].index, 1);
  assert.equal(await Challenge.countDocuments({ type: 'mcq' }), 1);
});

test('non-admin cannot bulk upload domain questions', async () => {
  const user = await registerUser({ username: 'auth_user', email: 'auth.user@example.com' });
  const res = await post(user.token, '/api/challenges/domain/bulk', { questions: [validMcq()] });
  assert.equal(res.status, 403);
});
