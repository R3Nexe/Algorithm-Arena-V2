// One-time cleanup: remove all domain questions (type mcq/written) and the
// participant-facing state that hangs off them — DomainProgress rows and the
// Submissions attached to those challenges. DSA challenges are untouched.
// Preview by default; pass --apply to write.
const mongoose = require('mongoose');
require('dotenv').config();

const { env } = require('../config/env');
const Challenge = require('../src/features/challenges/Challenge.model');
const DomainProgress = require('../src/features/challenges/DomainProgress.model');
const Submission = require('../src/features/submissions/Submission.model');

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const uriFlag = process.argv.find((arg) => arg.startsWith('--uri='));
  const uri = (uriFlag && uriFlag.slice('--uri='.length)) || process.env.MONGO_URI || env.MONGO_URI;

  if (!shouldApply) {
    console.log('Preview only. Re-run with --apply to delete domain questions.');
  }
  if (!uri) {
    throw new Error('Missing MongoDB URI. Pass --uri=... or set MONGO_URI.');
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.host || 'database'}`);

  const domainFilter = { type: { $in: ['mcq', 'written'] } };
  const ids = await Challenge.find(domainFilter).distinct('_id');

  const summary = {
    domainChallenges: ids.length,
    domainProgress: await DomainProgress.countDocuments({ challengeId: { $in: ids } }),
    submissions: await Submission.countDocuments({ challengeId: { $in: ids } }),
  };

  if (shouldApply && ids.length > 0) {
    const sub = await Submission.deleteMany({ challengeId: { $in: ids } });
    const prog = await DomainProgress.deleteMany({ challengeId: { $in: ids } });
    const ch = await Challenge.deleteMany(domainFilter);
    summary.deleted = {
      submissions: sub.deletedCount,
      domainProgress: prog.deletedCount,
      domainChallenges: ch.deletedCount,
    };
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Clear domain questions failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
