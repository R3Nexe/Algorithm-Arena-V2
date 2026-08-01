const test = require('node:test');
const assert = require('node:assert/strict');

const { computeAward, cooldownDays, nextAttemptAt } = require('../utils/domainScoring');

// Expected values are literals taken from the spec / ADR-0001 decay tables,
// NOT recomputed with the production formula (avoids a tautological test).
// Full points by difficulty: Easy 100, Medium 200, Hard 350.

test('computeAward — Easy (100) ladder, floors below 5 to 0', () => {
  const expected = { 1: 100, 2: 50, 3: 25, 4: 13, 5: 6, 6: 0, 7: 0 };
  for (const [attempt, award] of Object.entries(expected)) {
    assert.equal(computeAward(100, Number(attempt)), award, `attempt ${attempt}`);
  }
});

test('computeAward — Medium (200) ladder', () => {
  const expected = { 1: 200, 2: 100, 3: 50, 4: 25, 5: 13, 6: 6, 7: 0 };
  for (const [attempt, award] of Object.entries(expected)) {
    assert.equal(computeAward(200, Number(attempt)), award, `attempt ${attempt}`);
  }
});

test('computeAward — Hard (350) ladder, 5 is the last earning rung', () => {
  const expected = { 1: 350, 2: 175, 3: 88, 4: 44, 5: 22, 6: 11, 7: 5, 8: 0 };
  for (const [attempt, award] of Object.entries(expected)) {
    assert.equal(computeAward(350, Number(attempt)), award, `attempt ${attempt}`);
  }
});

test('cooldownDays — doubles per wrong attempt then freezes once no award remains', () => {
  // Easy: earns through attempt 5, so cooldown escalates 2,4,8,16 then freezes at 16.
  const easy = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 16, 6: 16 };
  for (const [wrong, days] of Object.entries(easy)) {
    assert.equal(cooldownDays(100, Number(wrong)), days, `easy wrong ${wrong}`);
  }
  // Hard earns through attempt 7, so it escalates further: 2,4,8,16,32,64 then freezes.
  assert.equal(cooldownDays(350, 6), 64, 'hard wrong 6');
  assert.equal(cooldownDays(350, 7), 64, 'hard wrong 7');
});

test('nextAttemptAt — adds the cooldown to the given moment', () => {
  const from = new Date('2026-08-01T00:00:00.000Z');
  const unlock = nextAttemptAt(100, 1, from); // 2 days
  assert.equal(unlock.toISOString(), '2026-08-03T00:00:00.000Z');
});
