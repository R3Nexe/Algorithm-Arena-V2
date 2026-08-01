// Scoring math for auto-graded MCQ domain questions. See docs/adr/0001-domain-question-scoring.md.
// Pure and dependency-free so the fiddly decay/cooldown boundaries are unit-testable in isolation.

// Awards below this are not worth granting; they collapse to 0.
const AWARD_FLOOR = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Points for a correct answer on a given 1-indexed attempt: full points halved per
// prior attempt, rounded, then floored to 0 once it would fall below AWARD_FLOOR.
const computeAward = (fullPoints, attempt) => {
  const rounded = Math.round(fullPoints / Math.pow(2, attempt - 1));
  return rounded < AWARD_FLOOR ? 0 : rounded;
};

// Largest attempt number that still yields a non-zero award.
const maxEarningAttempt = (fullPoints) => {
  let n = 1;
  while (computeAward(fullPoints, n + 1) > 0) n += 1;
  return n;
};

// Cooldown (in days) imposed after the k-th consecutive wrong/missed attempt (k >= 1).
// Doubles per miss (2, 4, 8, ...) but freezes once no award remains to be earned.
const cooldownDays = (fullPoints, wrongCount) => {
  const cap = Math.max(1, maxEarningAttempt(fullPoints) - 1);
  return Math.pow(2, Math.min(wrongCount, cap));
};

// The moment a question unlocks: `from` plus the escalating cooldown for wrongCount misses.
const nextAttemptAt = (fullPoints, wrongCount, from = new Date()) =>
  new Date(from.getTime() + cooldownDays(fullPoints, wrongCount) * MS_PER_DAY);

module.exports = { computeAward, cooldownDays, nextAttemptAt, maxEarningAttempt, AWARD_FLOOR };
