const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let User;
let Clan;
let Submission;
let RefreshToken;

const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_secret_for_algorithm_arena_12345';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();

  ({ app } = require('../server'));
  User = require('../src/features/users/User.model.js');
  Clan = require('../src/features/clans/Clan.model.js');
  Submission = require('../src/features/submissions/Submission.model.js');
  RefreshToken = require('../src/features/auth/RefreshToken.model.js');

  await mongoose.connect(process.env.MONGO_URI);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  await clearDatabase();
  try {
    const { clearChiefClanCache } = require('../src/features/clans/clanScope.service.js');
    clearChiefClanCache();
  } catch (err) {
    // Ignore
  }
});

const registerUser = async ({ username, email, password = 'strong-password' }) => {
  const res = await request(app).post('/api/auth/register').send({
    username,
    email,
    password,
  });
  assert.equal(res.status, 201);
  return {
    id: res.body.data._id,
    token: res.body.data.token,
  };
};

test('/ping returns a lightweight health response', async () => {
  const pingRes = await request(app).get('/ping');

  assert.equal(pingRes.status, 200);
  assert.deepEqual(pingRes.body, { ok: true });
});

test('root status endpoint remains available', async () => {
  const rootRes = await request(app).get('/');

  assert.equal(rootRes.status, 200);
  assert.equal(rootRes.body.success, true);
  assert.equal(rootRes.body.message, 'Algorithm Arena API is running');
});

test('register, login, and /auth/me lifecycle works', async () => {
  const registerRes = await request(app).post('/api/auth/register').send({
    username: 'pilot_one',
    email: 'pilot.one@example.com',
    password: 'strong-password',
  });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.success, true);
  assert.ok(registerRes.body.data.token);

  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'pilot.one@example.com',
    password: 'strong-password',
  });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.success, true);
  assert.ok(loginRes.body.data.token);

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.data.token}`);

  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.success, true);
  assert.equal(meRes.body.data.email, 'pilot.one@example.com');
});

test('refresh rotation and logout revocation flow works', async () => {
  const agent = request.agent(app);

  const registerRes = await agent.post('/api/auth/register').send({
    username: 'rotate_user',
    email: 'rotate@example.com',
    password: 'strong-password',
  });

  assert.equal(registerRes.status, 201);
  assert.ok(registerRes.body.data.token);

  const tokenCountBeforeRefresh = await RefreshToken.countDocuments();
  assert.equal(tokenCountBeforeRefresh, 1);

  const refreshRes = await agent.post('/api/auth/refresh').send({});
  assert.equal(refreshRes.status, 200);
  assert.equal(refreshRes.body.success, true);
  assert.ok(refreshRes.body.data.token);

  const meRes = await agent
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${refreshRes.body.data.token}`);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.data.email, 'rotate@example.com');

  const refreshTokens = await RefreshToken.find().sort({ createdAt: 1 });
  assert.equal(refreshTokens.length, 2);
  assert.ok(refreshTokens[0].revokedAt);
  assert.equal(refreshTokens[0].replacedByTokenHash, refreshTokens[1].tokenHash);

  const logoutRes = await agent.post('/api/auth/logout').send({});
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.success, true);

  const postLogoutRefresh = await agent.post('/api/auth/refresh').send({});
  assert.equal(postLogoutRefresh.status, 401);
});

test('challenge + submission flow enforces owner permissions', async () => {
  const adminRegister = await request(app).post('/api/auth/register').send({
    username: 'admin_user',
    email: 'admin@example.com',
    password: 'strong-password',
  });
  assert.equal(adminRegister.status, 201);

  await User.findByIdAndUpdate(adminRegister.body.data._id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const userRegister = await request(app).post('/api/auth/register').send({
    username: 'student_user',
    email: 'student@example.com',
    password: 'strong-password',
  });
  const studentToken = userRegister.body.data.token;

  const otherRegister = await request(app).post('/api/auth/register').send({
    username: 'intruder_user',
    email: 'intruder@example.com',
    password: 'strong-password',
  });
  const intruderToken = otherRegister.body.data.token;

  const challengeRes = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Two Sum Challenge',
      description: 'Return indices of two numbers that add up to target.',
      difficulty: 'Easy',
      points: 100,
      category: 'Arrays',
    });

  assert.equal(challengeRes.status, 201);
  const challengeId = challengeRes.body.data._id;

  const submissionRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      challengeId,
      code: 'function solve(){ return [0,1]; }',
      language: 'javascript',
    });

  assert.equal(submissionRes.status, 201);
  const submissionId = submissionRes.body.data._id;

  const ownSubmission = await request(app)
    .get(`/api/submissions/${submissionId}`)
    .set('Authorization', `Bearer ${studentToken}`);

  assert.equal(ownSubmission.status, 200);
  assert.equal(ownSubmission.body.success, true);

  const blockedSubmission = await request(app)
    .get(`/api/submissions/${submissionId}`)
    .set('Authorization', `Bearer ${intruderToken}`);

  assert.equal(blockedSubmission.status, 403);
  assert.equal(blockedSubmission.body.success, false);

  const mySubmissions = await request(app)
    .get('/api/submissions/my-submissions')
    .set('Authorization', `Bearer ${studentToken}`);

  assert.equal(mySubmissions.status, 200);
  assert.equal(mySubmissions.body.success, true);
  assert.equal(mySubmissions.body.data.length, 1);

  const leaderboard = await request(app)
    .get('/api/submissions/leaderboard?window=all&page=1&limit=10')
    .set('Authorization', `Bearer ${studentToken}`);

  assert.equal(leaderboard.status, 200);
  assert.equal(leaderboard.body.success, true);
  assert.ok(Array.isArray(leaderboard.body.data));

  const storedSubmission = await Submission.findById(submissionId);
  assert.equal(storedSubmission.status, 'Pending');
});

test('clan chief submission review is clan-scoped, moderator has global override', async () => {
  const admin = await registerUser({
    username: 'admin_scope',
    email: 'admin.scope@example.com',
  });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin.scope@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const challengeRes = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Scope Challenge',
      description: 'Validate clan-scoped submission review permissions.',
      difficulty: 'Easy',
      points: 50,
      category: 'Auth',
    });
  assert.equal(challengeRes.status, 201);
  const challengeId = challengeRes.body.data._id;

  const clanARes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Alpha', tag: 'ALP', description: 'Alpha' });
  const clanBRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Beta', tag: 'BET', description: 'Beta' });
  assert.equal(clanARes.status, 201);
  assert.equal(clanBRes.status, 201);

  const chiefA = await registerUser({
    username: 'chief_alpha',
    email: 'chief.alpha@example.com',
  });
  const memberA = await registerUser({
    username: 'member_alpha',
    email: 'member.alpha@example.com',
  });
  const memberB = await registerUser({
    username: 'member_beta',
    email: 'member.beta@example.com',
  });
  const moderator = await registerUser({
    username: 'mod_global',
    email: 'mod.global@example.com',
  });
  await User.findByIdAndUpdate(moderator.id, { role: 'moderator' });

  const clanAId = clanARes.body.data._id;
  const clanBId = clanBRes.body.data._id;

  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: chiefA.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: memberA.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanBId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: memberB.id })).status,
    200
  );

  const assignChiefRes = await request(app)
    .put(`/api/clans/${clanAId}/chief`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: chiefA.id });
  assert.equal(assignChiefRes.status, 200);

  const memberBSubmissionRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${memberB.token}`)
    .send({
      challengeId,
      code: 'function solve(){ return 42; }',
      language: 'javascript',
    });
  assert.equal(memberBSubmissionRes.status, 201);

  const memberASubmissionRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${memberA.token}`)
    .send({
      challengeId,
      code: 'function solve(){ return 7; }',
      language: 'javascript',
    });
  assert.equal(memberASubmissionRes.status, 201);

  const chiefBlockedList = await request(app)
    .get(`/api/submissions?userId=${memberB.id}`)
    .set('Authorization', `Bearer ${chiefA.token}`);
  assert.equal(chiefBlockedList.status, 403);

  const chiefBlockedReview = await request(app)
    .put(`/api/submissions/${memberBSubmissionRes.body.data._id}`)
    .set('Authorization', `Bearer ${chiefA.token}`)
    .send({ status: 'Accepted', feedback: 'Looks good' });
  assert.equal(chiefBlockedReview.status, 403);

  const chiefOwnClanReview = await request(app)
    .put(`/api/submissions/${memberASubmissionRes.body.data._id}`)
    .set('Authorization', `Bearer ${chiefA.token}`)
    .send({ status: 'Accepted', feedback: 'Approved for your clan' });
  assert.equal(chiefOwnClanReview.status, 200);

  const moderatorGlobalReview = await request(app)
    .put(`/api/submissions/${memberBSubmissionRes.body.data._id}`)
    .set('Authorization', `Bearer ${moderator.token}`)
    .send({ status: 'Accepted', feedback: 'Moderator global review' });
  assert.equal(moderatorGlobalReview.status, 200);
});

test('clan chief user moderation is clan-scoped and join requests are blocked for assigned users', async () => {
  const admin = await registerUser({
    username: 'admin_userscope',
    email: 'admin.userscope@example.com',
  });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin.userscope@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const clanARes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Gamma', tag: 'GAM', description: 'Gamma' });
  const clanBRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Delta', tag: 'DEL', description: 'Delta' });
  assert.equal(clanARes.status, 201);
  assert.equal(clanBRes.status, 201);

  const chiefA = await registerUser({
    username: 'chief_gamma',
    email: 'chief.gamma@example.com',
  });
  const memberA = await registerUser({
    username: 'member_gamma',
    email: 'member.gamma@example.com',
  });
  const memberB = await registerUser({
    username: 'member_delta',
    email: 'member.delta@example.com',
  });

  const clanAId = clanARes.body.data._id;
  const clanBId = clanBRes.body.data._id;

  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: chiefA.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: memberA.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanBId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: memberB.id })).status,
    200
  );

  const assignChiefRes = await request(app)
    .put(`/api/clans/${clanAId}/chief`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: chiefA.id });
  assert.equal(assignChiefRes.status, 200);

  const chiefBlockedWarn = await request(app)
    .post(`/api/users/${memberB.id}/warn`)
    .set('Authorization', `Bearer ${chiefA.token}`)
    .send({ message: 'Cross-clan warning attempt' });
  assert.equal(chiefBlockedWarn.status, 403);

  const chiefAllowedWarn = await request(app)
    .post(`/api/users/${memberA.id}/warn`)
    .set('Authorization', `Bearer ${chiefA.token}`)
    .send({ message: 'In-clan warning' });
  assert.equal(chiefAllowedWarn.status, 200);

  const assignedUserJoinElsewhere = await request(app)
    .post(`/api/clans/${clanBId}/join`)
    .set('Authorization', `Bearer ${memberA.token}`)
    .send({});
  assert.equal(assignedUserJoinElsewhere.status, 400);
  assert.match(assignedUserJoinElsewhere.body.message, /already assigned to a clan/i);
});

test('role-only clan-chief without clan mapping cannot access clan-chief scoped actions', async () => {
  const ghostChief = await registerUser({
    username: 'ghost_chief',
    email: 'ghost.chief@example.com',
  });
  const targetUser = await registerUser({
    username: 'ghost_target',
    email: 'ghost.target@example.com',
  });

  await User.findByIdAndUpdate(ghostChief.id, { role: 'clan-chief' });
  const noClanMapping = await Clan.findOne({ chief: ghostChief.id });
  assert.equal(noClanMapping, null);

  const submissionsAttempt = await request(app)
    .get('/api/submissions')
    .set('Authorization', `Bearer ${ghostChief.token}`);
  assert.equal(submissionsAttempt.status, 403);

  const warnAttempt = await request(app)
    .post(`/api/users/${targetUser.id}/warn`)
    .set('Authorization', `Bearer ${ghostChief.token}`)
    .send({ message: 'No clan mapping should fail' });
  assert.equal(warnAttempt.status, 403);
});

test('clans archive first, restore cleanly, and only admin can permanently delete archived clans', async () => {
  const admin = await registerUser({
    username: 'clan_admin_lifecycle',
    email: 'clan.admin.lifecycle@example.com',
  });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'clan.admin.lifecycle@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const clanRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Lifecycle Clan', tag: 'LIFE', description: 'Lifecycle test clan' });
  assert.equal(clanRes.status, 201);
  const clanId = clanRes.body.data._id;

  const chief = await registerUser({
    username: 'clan_chief_lifecycle',
    email: 'clan.chief.lifecycle@example.com',
  });
  const member = await registerUser({
    username: 'clan_member_lifecycle',
    email: 'clan.member.lifecycle@example.com',
  });

  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: chief.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .post(`/api/clans/${clanId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: member.id })).status,
    200
  );
  assert.equal(
    (await request(app)
      .put(`/api/clans/${clanId}/chief`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: chief.id })).status,
    200
  );

  const memberLogin = await request(app).post('/api/auth/login').send({
    email: 'clan.member.lifecycle@example.com',
    password: 'strong-password',
  });
  const memberToken = memberLogin.body.data.token;

  const chiefLogin = await request(app).post('/api/auth/login').send({
    email: 'clan.chief.lifecycle@example.com',
    password: 'strong-password',
  });
  const chiefToken = chiefLogin.body.data.token;

  const deleteWhileActive = await request(app)
    .delete(`/api/clans/${clanId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(deleteWhileActive.status, 400);

  const archiveRes = await request(app)
    .patch(`/api/clans/${clanId}/archive`)
    .set('Authorization', `Bearer ${chiefToken}`)
    .send({});
  assert.equal(archiveRes.status, 200);
  assert.equal(archiveRes.body.data.status, 'archived');

  const activeClansAfterArchive = await request(app)
    .get('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(activeClansAfterArchive.status, 200);
  assert.equal((activeClansAfterArchive.body.data || []).some((clan) => clan._id === clanId), false);

  const allLeaderboardAfterArchive = await request(app)
    .get('/api/clans/leaderboard?status=all')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(allLeaderboardAfterArchive.status, 200);
  assert.equal((allLeaderboardAfterArchive.body.data || []).some((clan) => clan._id === clanId && clan.status === 'archived'), true);

  const restoreRes = await request(app)
    .patch(`/api/clans/${clanId}/restore`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.data.status, 'active');

  const archiveAgainRes = await request(app)
    .patch(`/api/clans/${clanId}/archive`)
    .set('Authorization', `Bearer ${chiefToken}`)
    .send({});
  assert.equal(archiveAgainRes.status, 200);

  const deleteRes = await request(app)
    .delete(`/api/clans/${clanId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(deleteRes.status, 200);

  const deletedClan = await Clan.findById(clanId);
  assert.equal(deletedClan, null);


  const updatedChief = await User.findById(chief.id);
  const updatedMember = await User.findById(member.id);
  assert.equal(updatedChief.clan, null);
  assert.equal(updatedChief.role, 'user');
  assert.equal(updatedMember.clan, null);
});

test('submission with userFeedback validation and storage', async () => {
  // 1. Register admin
  const adminRegister = await request(app).post('/api/auth/register').send({
    username: 'feedback_admin',
    email: 'feedback_admin@example.com',
    password: 'strong-password',
  });
  assert.equal(adminRegister.status, 201);

  // Promote to admin
  await User.findOneAndUpdate(
    { email: 'feedback_admin@example.com' },
    { role: 'admin' }
  );

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'feedback_admin@example.com',
    password: 'strong-password',
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.data.token;

  // 2. Register student
  const studentRegister = await request(app).post('/api/auth/register').send({
    username: 'feedback_student',
    email: 'feedback.student@example.com',
    password: 'strong-password',
  });
  assert.equal(studentRegister.status, 201);
  const studentToken = studentRegister.body.data.token;

  // 3. Create challenge
  const challengeRes = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Feedback Challenge',
      description: 'Test feedback',
      difficulty: 'Medium',
      points: 120,
      category: 'Strings',
    });
  assert.equal(challengeRes.status, 201);
  const localChallengeId = challengeRes.body.data._id;

  // 4. Submit with feedback
  const submissionWithFeedbackRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      challengeId: localChallengeId,
      code: 'function solve(){ return "ok"; }',
      language: 'javascript',
      userFeedback: 'I had some issues with environment timeouts.',
    });

  assert.equal(submissionWithFeedbackRes.status, 201);
  assert.equal(submissionWithFeedbackRes.body.data.userFeedback, 'I had some issues with environment timeouts.');
});

test('submission execTimeSec/execMemoryKb round-trip and language=c is accepted', async () => {
  const admin = await registerUser({ username: 'exec_admin', email: 'exec_admin@example.com' });
  await User.findOneAndUpdate({ email: 'exec_admin@example.com' }, { role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'exec_admin@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const student = await registerUser({ username: 'exec_student', email: 'exec_student@example.com' });

  const challengeRes = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Exec Stats Challenge',
      description: 'Test exec stats',
      difficulty: 'Easy',
      points: 100,
      category: 'Logic',
    });
  assert.equal(challengeRes.status, 201);
  const challengeId = challengeRes.body.data._id;

  const challenge2Res = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Exec Stats Challenge 2',
      description: 'Test exec stats 2',
      difficulty: 'Easy',
      points: 100,
      category: 'Logic',
    });
  assert.equal(challenge2Res.status, 201);
  const challenge2Id = challenge2Res.body.data._id;

  const challenge3Res = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Exec Stats Challenge 3',
      description: 'Test exec stats 3',
      difficulty: 'Easy',
      points: 100,
      category: 'Logic',
    });
  assert.equal(challenge3Res.status, 201);
  const challenge3Id = challenge3Res.body.data._id;

  // language 'c' + exec stats round-trip
  const submitRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({
      challengeId,
      code: 'int main(){return 0;}',
      language: 'c',
      execTimeSec: 0.024,
      execMemoryKb: 15564,
    });
  assert.equal(submitRes.status, 201);
  assert.equal(submitRes.body.data.language, 'c');
  assert.equal(submitRes.body.data.execTimeSec, 0.024);
  assert.equal(submitRes.body.data.execMemoryKb, 15564);

  const fetchRes = await request(app)
    .get(`/api/submissions/${submitRes.body.data._id}`)
    .set('Authorization', `Bearer ${student.token}`);
  assert.equal(fetchRes.status, 200);
  assert.equal(fetchRes.body.data.execTimeSec, 0.024);
  assert.equal(fetchRes.body.data.execMemoryKb, 15564);

  // omitting exec stats still works (repo-link-style submission)
  const noStatsRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ challengeId: challenge2Id, code: 'int main(){return 1;}', language: 'c' });
  assert.equal(noStatsRes.status, 201);
  assert.equal(noStatsRes.body.data.execTimeSec, undefined);
  assert.equal(noStatsRes.body.data.execMemoryKb, undefined);

  // negative value rejected
  const badRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ challengeId: challenge3Id, code: 'int main(){return 1;}', language: 'c', execTimeSec: -1 });
  assert.equal(badRes.status, 400);
});

test('leaderboard window=all pagination, tie-breaking, and topThree calculation works correctly', async () => {
  // Clear any existing users to prevent noise
  await User.deleteMany({});

  // Register 5 users
  const userA = await registerUser({ username: 'user_a', email: 'user_a@example.com' });
  const userB = await registerUser({ username: 'user_b', email: 'user_b@example.com' });
  const userC = await registerUser({ username: 'user_c', email: 'user_c@example.com' });
  const userD = await registerUser({ username: 'user_d', email: 'user_d@example.com' });
  const userE = await registerUser({ username: 'user_e', email: 'user_e@example.com' });

  // Manually update points/solvedCount in DB to construct a structured leaderboard
  await User.findByIdAndUpdate(userA.id, { points: 500, solvedProblems: 10 });
  await User.findByIdAndUpdate(userB.id, { points: 400, solvedProblems: 8 });
  await User.findByIdAndUpdate(userC.id, { points: 400, solvedProblems: 8 }); // Tie with user_b
  await User.findByIdAndUpdate(userD.id, { points: 300, solvedProblems: 5 });
  await User.findByIdAndUpdate(userE.id, { points: 200, solvedProblems: 2 });

  // Page 1, Limit 2
  const page1 = await request(app)
    .get('/api/submissions/leaderboard?window=all&page=1&limit=2')
    .set('Authorization', `Bearer ${userA.token}`);

  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 2);
  assert.equal(page1.body.data[0].username, 'user_a');
  assert.equal(page1.body.data[0].rank, 1);
  assert.equal(page1.body.data[1].username, 'user_b');
  assert.equal(page1.body.data[1].rank, 2);
  
  assert.equal(page1.body.meta.total, 5);
  assert.equal(page1.body.meta.page, 1);
  assert.equal(page1.body.meta.limit, 2);
  assert.equal(page1.body.meta.totalPages, 3);
  assert.equal(page1.body.meta.topThree.length, 3);
  assert.equal(page1.body.meta.topThree[0].username, 'user_a');
  assert.equal(page1.body.meta.topThree[0].rank, 1);
  assert.equal(page1.body.meta.topThree[1].username, 'user_b');
  assert.equal(page1.body.meta.topThree[1].rank, 2);
  assert.equal(page1.body.meta.topThree[2].username, 'user_c');
  assert.equal(page1.body.meta.topThree[2].rank, 2);

  // Page 2, Limit 2
  const page2 = await request(app)
    .get('/api/submissions/leaderboard?window=all&page=2&limit=2')
    .set('Authorization', `Bearer ${userA.token}`);

  assert.equal(page2.status, 200);
  assert.equal(page2.body.data.length, 2);
  assert.equal(page2.body.data[0].username, 'user_c');
  assert.equal(page2.body.data[0].rank, 2); // User C has same points/solved as User B, so gets rank 2
  assert.equal(page2.body.data[1].username, 'user_d');
  assert.equal(page2.body.data[1].rank, 3); // User D has rank 3 since dense ranking doesn't skip ranks

  // Page 3, Limit 2
  const page3 = await request(app)
    .get('/api/submissions/leaderboard?window=all&page=3&limit=2')
    .set('Authorization', `Bearer ${userA.token}`);

  assert.equal(page3.status, 200);
  assert.equal(page3.body.data.length, 1);
  assert.equal(page3.body.data[0].username, 'user_e');
  assert.equal(page3.body.data[0].rank, 4); // User E has rank 4 since dense ranking doesn't skip ranks
});

test('getMySubmissions default limit defaults to 100', async () => {
  const user = await registerUser({ username: 'submit_limit_user', email: 'submit_limit@example.com' });
  const Challenge = require('../src/features/challenges/Challenge.model.js');
  const challenge = await Challenge.create({
    title: 'Limit Test Challenge',
    description: 'Test limit',
    difficulty: 'Medium',
    points: 100,
    category: 'Strings',
  });

  // Create 105 submissions
  const submissionsData = Array.from({ length: 105 }, (_, i) => ({
    userId: user.id,
    challengeId: challenge._id,
    code: `// submission ${i}`,
    language: 'javascript',
    status: 'Accepted',
    submittedAt: new Date(Date.now() - i * 1000),
  }));
  await Submission.insertMany(submissionsData);

  const res = await request(app)
    .get('/api/submissions/my')
    .set('Authorization', `Bearer ${user.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 100); // Verify default hard server-side limit of 100 is applied
});

test('getChallenges uses text index search correctly', async () => {
  const Challenge = require('../src/features/challenges/Challenge.model.js');
  await Challenge.createIndexes(); // Force-compile indexes

  await Challenge.create([
    { title: 'Searchable Binary Tree Challenge', description: 'Find the path', category: 'Trees' },
    { title: 'Another Unrelated Task', description: 'Binary search tree helper', category: 'Logic' },
    { title: 'Something Else', description: 'Nothing related to trees', category: 'Logic' },
  ]);

  const user = await registerUser({ username: 'search_user', email: 'search@example.com' });

  const res = await request(app)
    .get('/api/challenges?search=Binary')
    .set('Authorization', `Bearer ${user.token}`);

  assert.equal(res.status, 200);
  // Both first and second challenges match "Binary" text search
  assert.equal(res.body.data.length, 2);
  const titles = res.body.data.map(c => c.title);
  assert.ok(titles.includes('Searchable Binary Tree Challenge'));
  assert.ok(titles.includes('Another Unrelated Task'));
});

test('clan chief lookup is cached and behaves correctly on mutations', async () => {
  const admin = await registerUser({ username: 'admin_test_chief', email: 'admin_chief@example.com' });
  // Manually update role of admin to 'admin' so we can create/manage chief
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const chiefUser = await registerUser({ username: 'chief_user_cache', email: 'chief_cache@example.com' });
  const memberUser = await registerUser({ username: 'member_user_cache', email: 'member_cache@example.com' });

  // 1. Create a clan
  const clanRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ name: 'Cache Clan', tag: 'CACL' });
  assert.equal(clanRes.status, 201);
  const clanId = clanRes.body.data._id;

  // 2. Add chiefUser as a member first (so they can be promoted to chief)
  const addChiefMemberRes = await request(app)
    .post(`/api/clans/${clanId}/members`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ userId: chiefUser.id });
  assert.equal(addChiefMemberRes.status, 200);

  // 3. Assign chief
  const assignChiefRes = await request(app)
    .put(`/api/clans/${clanId}/chief`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ userId: chiefUser.id });
  assert.equal(assignChiefRes.status, 200);

  // 4. Add member to clan
  const addMemberRes = await request(app)
    .post(`/api/clans/${clanId}/members`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ userId: memberUser.id });
  assert.equal(addMemberRes.status, 200);

  // 5. Act as chief to populate cache
  const { getActorMemberIdsInScope } = require('../src/features/clans/clanScope.service.js');
  // Get updated chief user object with role 'clan-chief'
  const chiefActor = await User.findById(chiefUser.id).lean();
  
  const members1 = await getActorMemberIdsInScope(chiefActor);
  assert.ok(members1.memberIds.includes(memberUser.id));

  // 6. Remove member from clan (which triggers mongoose middleware hook to evict cache)
  const removeMemberRes = await request(app)
    .delete(`/api/clans/${clanId}/members/${memberUser.id}`)
    .set('Authorization', `Bearer ${admin.token}`);
  assert.equal(removeMemberRes.status, 200);

  // 7. Act as chief again - the cached clan must have been evicted, so it queries the db and gets updated members list
  const members2 = await getActorMemberIdsInScope(chiefActor);
  assert.ok(!members2.memberIds.includes(memberUser.id));
});

test('getChallenges and getSubmissions limit parameter clamping', async () => {
  const user = await registerUser({ username: 'clamp_user', email: 'clamp@example.com' });
  const Challenge = require('../src/features/challenges/Challenge.model.js');
  
  // Seed 105 challenges
  const challengesData = Array.from({ length: 105 }, (_, i) => ({
    title: `Clamp Challenge ${i}`,
    description: `Desc ${i}`,
    difficulty: 'Easy',
    points: 100,
    category: 'Logic',
  }));
  await Challenge.insertMany(challengesData);

  // Request challenges with limit=50
  const challengeRes = await request(app)
    .get('/api/challenges?limit=50')
    .set('Authorization', `Bearer ${user.token}`);

  assert.equal(challengeRes.status, 200);
  assert.equal(challengeRes.body.data.length, 50); // Respects limit=50
  assert.equal(challengeRes.body.meta.limit, 50);

  // Let's also test submissions limit clamping
  const challenge = await Challenge.findOne();
  const submissionsData = Array.from({ length: 105 }, (_, i) => ({
    userId: user.id,
    challengeId: challenge._id,
    code: `// code ${i}`,
    language: 'javascript',
    status: 'Accepted',
    submittedAt: new Date(Date.now() - i * 1000),
  }));
  await Submission.insertMany(submissionsData);

  // Request submissions with limit=50 using admin credentials
  const admin = await registerUser({ username: 'clamp_admin', email: 'clamp_admin@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'clamp_admin@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const submissionRes = await request(app)
    .get('/api/submissions?limit=50')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(submissionRes.status, 200);
  assert.equal(submissionRes.body.data.length, 50); // Respects limit=50
  assert.equal(submissionRes.body.meta.limit, 50);
});

test('getAdminDashboardSummary calculates live completions and avgCompletion', async () => {
  const Challenge = require('../src/features/challenges/Challenge.model.js');

  const admin = await registerUser({ username: 'admin_dashboard_test', email: 'admin_dashboard@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin_dashboard@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  // Create two clans
  const clanARes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Alpha', tag: 'ALPH' });
  assert.equal(clanARes.status, 201);
  const clanAId = clanARes.body.data._id;

  const clanBRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Beta', tag: 'BETA' });
  assert.equal(clanBRes.status, 201);
  const clanBId = clanBRes.body.data._id;

  // Register two members
  const memberA = await registerUser({ username: 'member_a_dash', email: 'membera_dash@example.com' });
  const memberB = await registerUser({ username: 'member_b_dash', email: 'memberb_dash@example.com' });

  // Add members to respective clans
  await request(app)
    .post(`/api/clans/${clanAId}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: memberA.id });

  await request(app)
    .post(`/api/clans/${clanBId}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: memberB.id });

  // Create a challenge
  const challenge = await Challenge.create({
    title: 'Dashboard Challenge One',
    description: 'Solve me',
    difficulty: 'Easy',
    points: 50,
    category: 'Logic',
  });

  // Create an accepted submission for memberA (1 solve)
  await Submission.create({
    userId: memberA.id,
    challengeId: challenge._id,
    code: '// solved',
    language: 'javascript',
    status: 'Accepted',
    submittedAt: new Date(),
  });

  // Clan Alpha has 1 member, 1 solve (weeklySolved = 1). TARGET_PROBLEMS = 5.
  // Clan Alpha completion = Math.round((1 / 5) * 100) = 20%.
  // Clan Beta has 1 member, 0 solves. Clan Beta completion = 0%.
  // Average completion = Math.round((20 + 0) / 2) = 10%.

  const res = await request(app)
    .get('/api/dashboard/admin-summary')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  
  const { avgCompletion, activeClans } = res.body.data;
  assert.equal(activeClans, 2);
  assert.equal(avgCompletion, 10);
});

test('getMySetAnalytics returns per-set completion, excludes the chief, and picks the closest active set', async () => {
  const Challenge = require('../src/features/challenges/Challenge.model.js');
  const QuestionSet = require('../src/features/challenges/QuestionSet.model.js');

  const admin = await registerUser({ username: 'admin_setan', email: 'admin_setan@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin_setan@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const clanRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Set Analytics Clan', tag: 'SAC' });
  assert.equal(clanRes.status, 201);
  const clanId = clanRes.body.data._id;

  const chief = await registerUser({ username: 'sac_chief', email: 'sac_chief@example.com' });
  const memberA = await registerUser({ username: 'sac_member_a', email: 'sac_member_a@example.com' });
  const memberB = await registerUser({ username: 'sac_member_b', email: 'sac_member_b@example.com' });

  for (const u of [chief, memberA, memberB]) {
    assert.equal(
      (await request(app)
        .post(`/api/clans/${clanId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: u.id })).status,
      200
    );
  }
  assert.equal(
    (await request(app)
      .put(`/api/clans/${clanId}/chief`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: chief.id })).status,
    200
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const setNear = await QuestionSet.create({
    title: 'Week 2 Set', weekNumber: 2, deadline: new Date(Date.now() + 2 * dayMs), status: 'Published',
  });
  const setFar = await QuestionSet.create({
    title: 'Week 1 Set', weekNumber: 1, deadline: new Date(Date.now() + 10 * dayMs), status: 'Published',
  });

  // setNear: 2 challenges; setFar: 1 challenge.
  const nearC1 = await Challenge.create({ title: 'N1', description: 'x', category: 'Logic', questionSetId: setNear._id });
  const nearC2 = await Challenge.create({ title: 'N2', description: 'x', category: 'Logic', questionSetId: setNear._id });
  await Challenge.create({ title: 'F1', description: 'x', category: 'Logic', questionSetId: setFar._id });

  // memberA solves both near challenges (2/2), memberB solves one (1/2),
  // chief solves one (must be excluded from analytics).
  const submit = (userId, challengeId, status) => Submission.create({
    userId, challengeId, code: '// solution', language: 'javascript', status, submittedAt: new Date(),
  });
  await submit(memberA.id, nearC1._id, 'Accepted');
  await submit(memberA.id, nearC2._id, 'Accepted');
  await submit(memberB.id, nearC1._id, 'Accepted');
  // memberB on nearC2: rejected then a newer pending resubmission → precedence yields 'pending'.
  await submit(memberB.id, nearC2._id, 'Rejected');
  await submit(memberB.id, nearC2._id, 'Pending');
  await submit(chief.id, nearC1._id, 'Accepted');

  const res = await request(app)
    .get('/api/clans/mine/set-analytics')
    .set('Authorization', `Bearer ${chief.token}`);

  assert.equal(res.status, 200);
  const { sets, closestActiveSetId, perSet } = res.body.data;

  // Sets are newest-first by weekNumber; closest active = nearest deadline.
  assert.equal(closestActiveSetId, setNear._id.toString());
  const nearOut = sets.find(s => s._id === setNear._id.toString());
  assert.equal(nearOut.challengeCount, 2);
  assert.equal(nearOut.isActive, true);

  const near = perSet[setNear._id.toString()];
  // 2 non-chief members, totalSolved = 2 + 1 = 3, possible = 2*2 = 4 => 75%.
  assert.equal(near.clanCompletionPct, 75);
  assert.equal(near.members[memberA.id].solved, 2);
  assert.equal(near.members[memberA.id].total, 2);
  assert.equal(near.members[memberB.id].solved, 1);
  assert.equal(near.members[memberB.id].total, 2);
  // Chief excluded from the member map and the aggregate.
  assert.equal(near.members[chief.id], undefined);

  // Per-question statuses (for the hover tooltip).
  assert.equal(near.challenges.length, 2);
  assert.ok(near.challenges.some(c => c.title === 'N1'));
  assert.equal(near.members[memberA.id].statuses[nearC1._id.toString()], 'accepted');
  assert.equal(near.members[memberB.id].statuses[nearC1._id.toString()], 'accepted');
  // Rejected + newer Pending on the same challenge resolves to 'pending'.
  assert.equal(near.members[memberB.id].statuses[nearC2._id.toString()], 'pending');
  // memberA never touched nearC2? They accepted it — so it's accepted; unsolved would be absent.
  assert.equal(near.members[memberA.id].statuses[nearC2._id.toString()], 'accepted');

  // setFar has no solves.
  assert.equal(perSet[setFar._id.toString()].clanCompletionPct, 0);
});

test('getClanLeaderboard window=all aggregates points and solved problems correctly using aggregation pipeline', async () => {
  const admin = await registerUser({ username: 'admin_leaderboard_test', email: 'admin_leaderboard@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin_leaderboard@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  // Create two clans
  const clanARes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Gamma', tag: 'GAM' });
  const clanAId = clanARes.body.data._id;

  const clanBRes = await request(app)
    .post('/api/clans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Clan Delta', tag: 'DELT' });
  const clanBId = clanBRes.body.data._id;

  // Create users with points and solvedProblems
  const user1 = await registerUser({ username: 'leader_u1', email: 'leader_u1@example.com' });
  const user2 = await registerUser({ username: 'leader_u2', email: 'leader_u2@example.com' });

  // Update points/solvedProblems directly in DB
  await User.findByIdAndUpdate(user1.id, { points: 150, solvedProblems: 10 });
  await User.findByIdAndUpdate(user2.id, { points: 300, solvedProblems: 20 });

  // Add user1 to Clan Gamma, user2 to Clan Delta
  await request(app)
    .post(`/api/clans/${clanAId}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: user1.id });

  await request(app)
    .post(`/api/clans/${clanBId}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId: user2.id });

  const res = await request(app)
    .get('/api/clans/leaderboard?window=all')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));

  // Clan Delta (user2: 300 pts) should be ranked 1st
  // Clan Gamma (user1: 150 pts) should be ranked 2nd
  const leaderData = res.body.data;
  const deltaRank = leaderData.find(c => c.name === 'Clan Delta');
  const gammaRank = leaderData.find(c => c.name === 'Clan Gamma');

  assert.ok(deltaRank);
  assert.ok(gammaRank);

  assert.equal(deltaRank.totalPoints, 300);
  assert.equal(deltaRank.solvedCount, 20);
  assert.equal(deltaRank.memberCount, 1);
  assert.equal(deltaRank.rank, 1);

  assert.equal(gammaRank.totalPoints, 150);
  assert.equal(gammaRank.solvedCount, 10);
  assert.equal(gammaRank.memberCount, 1);
  assert.equal(gammaRank.rank, 2);
});

test('daily login XP logic awards XP on the first /me call after onboarding is completed today', async () => {
  const XpLog = require('../src/features/users/XpLog.model.js');
  const { signAccessToken } = require('../utils/tokens');

  // Create a brand new Google user with usernameSet = false
  const user = await User.create({
    email: 'daily_xp_test@example.com',
    authProvider: 'google',
    usernameSet: false,
    points: 0,
  });

  const token = signAccessToken(user._id);

  // 1. First call to /api/auth/me when usernameSet = false
  // It should NOT award daily XP, but user's lastLoginDate should be updated to now.
  const res1 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res1.status, 200);
  assert.equal(res1.body.data.points, 0);
  assert.equal(res1.body.data.dailyXpAwarded, false);

  const userAfterFirstMe = await User.findById(user._id);
  assert.ok(userAfterFirstMe.lastLoginDate);

  const logsCount1 = await XpLog.countDocuments({ userId: user._id, reason: 'Daily Login' });
  assert.equal(logsCount1, 0);

  // 2. Simulate user completing onboarding (updating usernameSet to true)
  userAfterFirstMe.username = 'daily_xp_tester';
  userAfterFirstMe.usernameSet = true;
  await userAfterFirstMe.save();

  // 3. Second call to /api/auth/me on the same day (lastLoginDate is already updated to today)
  // Under old logic, this fails to award XP. Under new logic, it should correctly award XP!
  const res2 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res2.status, 200);
  assert.equal(res2.body.data.points, 50);
  assert.equal(res2.body.data.dailyXpAwarded, true);

  const logsCount2 = await XpLog.countDocuments({ userId: user._id, reason: 'Daily Login' });
  assert.equal(logsCount2, 1);
});

test('updateQuestionSet locks non-solution fields once the deadline has passed, but still allows solution fixes', async () => {
  const Challenge = require('../src/features/challenges/Challenge.model.js');

  const admin = await registerUser({ username: 'admin_deadline_lock', email: 'admin.deadline@example.com' });
  await User.findByIdAndUpdate(admin.id, { role: 'admin' });

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin.deadline@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const createRes = await request(app)
    .post('/api/sets')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Past Deadline Set',
      weekNumber: 1,
      deadline: yesterday,
      targetLevel: 'Both',
      questions: [{
        title: 'Two Sum',
        difficulty: 'Easy',
        description: 'Find two numbers that add up to target.',
        functionName: 'twoSum',
        solutions: [{ lang: 'JavaScript', langSlug: 'javascript', code: 'function twoSum() {}' }],
        testCases: [],
      }],
    });
  assert.equal(createRes.status, 201);
  const setId = createRes.body.data._id;

  // A direct API call (bypassing the admin UI's disabled inputs) tries to
  // change locked fields *and* fix the solution in the same request.
  const updateRes = await request(app)
    .put(`/api/sets/${setId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Renamed After Deadline',
      weekNumber: 99,
      deadline: new Date().toISOString().split('T')[0],
      targetLevel: 'Beginner',
      status: 'Draft',
      questions: [{
        title: 'Renamed Question',
        difficulty: 'Hard',
        description: 'Changed description',
        functionName: 'twoSum',
        solutions: [{ lang: 'JavaScript', langSlug: 'javascript', code: 'function twoSum() { return [0, 1]; }' }],
        testCases: [],
      }],
    });

  assert.equal(updateRes.status, 200);
  // Locked fields are unchanged...
  assert.equal(updateRes.body.data.title, 'Past Deadline Set');
  assert.equal(updateRes.body.data.weekNumber, 1);
  assert.equal(updateRes.body.data.targetLevel, 'Both');
  assert.equal(updateRes.body.data.status, 'Published');
  assert.equal(updateRes.body.data.questions[0].title, 'Two Sum');
  assert.equal(updateRes.body.data.questions[0].difficulty, 'Easy');
  assert.equal(updateRes.body.data.questions[0].description, 'Find two numbers that add up to target.');
  // ...but the solution fix went through.
  assert.equal(updateRes.body.data.questions[0].solutions[0].code, 'function twoSum() { return [0, 1]; }');

  // The mirrored Challenge doc used by Missions/Dashboard picks up the fixed
  // solution too, without adopting the spoofed title/difficulty/description.
  const challenge = await Challenge.findOne({ questionSetId: setId });
  assert.equal(challenge.title, 'Two Sum');
  assert.equal(challenge.difficulty, 'Easy');
  assert.equal(challenge.solutions[0].code, 'function twoSum() { return [0, 1]; }');
});




