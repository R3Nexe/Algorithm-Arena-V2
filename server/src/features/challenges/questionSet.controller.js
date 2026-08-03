const QuestionSet = require('./QuestionSet.model');
const Challenge = require('./Challenge.model');
const User = require('../users/User.model');
const { sendSuccess } = require('../../../utils/response');
const { logAudit } = require('../../../utils/audit');
const { sendEmail } = require('../../../utils/emailService');
const { cleanupSubmissionsAndUserStats } = require('./challenge.service');
const { getPointsForDifficulty } = require('../../../utils/xp');

const getQuestionSets = async (req, res, next) => {
  try {
    const sets = await QuestionSet.find().sort({ weekNumber: -1, createdAt: -1 });
    return sendSuccess(res, { data: sets });
  } catch (err) {
    return next(err);
  }
};

const getQuestionSetById = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      res.status(404);
      throw new Error('Question Set not found');
    }
    return sendSuccess(res, { data: set });
  } catch (err) {
    return next(err);
  }
};

const capitalizeTitle = (title) => {
  if (!title) return "";
  return title
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const createQuestionSet = async (req, res, next) => {
  try {
    // Capitalize the Question Set title
    if (req.body.title) {
      req.body.title = capitalizeTitle(req.body.title);
    }

    // Capitalize each individual question title; use submitted points or fall back to difficulty default
    if (req.body.questions && req.body.questions.length > 0) {
      req.body.questions = req.body.questions.map(q => {
        if (q.title) {
          q.title = capitalizeTitle(q.title);
        }
        q.points = q.points || getPointsForDifficulty(q.difficulty || 'Easy');
        return q;
      });
    }

    const set = await QuestionSet.create({ ...req.body, createdBy: req.user.id });

    await logAudit({
      action: 'questionset.create',
      actorId: req.user.id,
      targetType: 'questionset',
      targetId: set._id,
      metadata: { title: set.title, weekNumber: set.weekNumber }
    });

    // Create individual challenges for each question so they appear in Missions/Dashboard
    if (req.body.questions && req.body.questions.length > 0) {
      const challengesToInsert = req.body.questions.map(q => ({
        title: q.title,
        description: q.description,
        difficulty: q.difficulty || 'Easy',
        points: q.points || getPointsForDifficulty(q.difficulty || 'Easy'),
        category: q.category || 'Logic',
        tags: q.tags || [],
        codeSnippets: q.codeSnippets || [],
        solutions: q.solutions || [],
        functionName: q.functionName || '',
        params: q.params || [],
        returnType: q.returnType || '',
        orderIndependent: !!q.orderIndependent,
        testCases: q.testCases || [],
        questionSetId: set._id
      }));
      await Challenge.insertMany(challengesToInsert);
    }

    // Email notification
    const users = await User.find({ role: 'user' }).select('email');
    if (users.length > 0) {
      const emailList = users.map(u => u.email).join(',');
      const htmlContent = `
        <h1>New Question Set Available!</h1>
        <p>A new question set <strong>${set.title}</strong> (Week ${set.weekNumber}) has been published.</p>
        <p>Target Level: ${set.targetLevel}</p>
        <p>Deadline: ${new Date(set.deadline).toLocaleDateString()}</p>
        <a href="https://algorithm-arena.com/missions">Go to Arena</a>
      `;
      sendEmail(emailList, `New Challenge Set: ${set.title}`, htmlContent);
    }

    return sendSuccess(res, {
      statusCode: 201,
      data: set,
      message: 'Question Set created successfully'
    });
  } catch (err) {
    return next(err);
  }
};

const buildChallengePayload = (q, setId) => ({
  title: q.title,
  description: q.description || q.title || 'No description provided',
  difficulty: q.difficulty || 'Easy',
  points: q.points || getPointsForDifficulty(q.difficulty || 'Easy'),
  category: q.category || 'Logic',
  tags: q.tags || [],
  codeSnippets: q.codeSnippets || [],
  solutions: q.solutions || [],
  functionName: q.functionName || '',
  params: q.params || [],
  returnType: q.returnType || '',
  orderIndependent: !!q.orderIndependent,
  testCases: q.testCases || [],
  questionSetId: setId,
});

// Mirrors the admin UI's read-only state: once a set's deadline has passed,
// only its questions' reference solutions may still be edited (e.g. to fix a
// broken one). Everything else must be locked server-side too, since the UI
// gating alone doesn't stop a direct API call.
const isPastDeadline = (deadline) => {
  if (!deadline) return false;
  const deadlineStr = new Date(deadline).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  return deadlineStr < todayStr;
};

const updateQuestionSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      res.status(404);
      throw new Error('Question Set not found');
    }

    const pastDeadline = isPastDeadline(set.deadline);
    const questionsProvided = Array.isArray(req.body.questions);

    if (pastDeadline) {
      if (questionsProvided) {
        req.body.questions.forEach((q, i) => {
          if (set.questions[i] && q.solutions !== undefined) {
            set.questions[i].solutions = q.solutions;
          }
        });
      }
    } else {
      if (req.body.title) {
        req.body.title = capitalizeTitle(req.body.title);
      }
      if (questionsProvided) {
        req.body.questions = req.body.questions.map((q) => ({
          ...q,
          ...(q.title ? { title: capitalizeTitle(q.title) } : {}),
          points: q.points || getPointsForDifficulty(q.difficulty || 'Easy'),
        }));
      }

      const fields = ['title', 'weekNumber', 'deadline', 'targetLevel', 'questions', 'status'];
      fields.forEach((f) => {
        if (req.body[f] !== undefined) set[f] = req.body[f];
      });
    }
    await set.save();

    // Reconcile the standalone Challenge docs that mirror these questions so
    // Missions/Dashboard stay in sync. Match by title to preserve _ids (and
    // therefore existing submission references) for unchanged questions.
    // Sourced from `set.questions` (the just-saved, deadline-aware state)
    // rather than the raw request body, so a locked past-deadline update can
    // only ever propagate the solutions change, never a spoofed field.
    if (questionsProvided) {
      const existing = await Challenge.find({ questionSetId: set._id });
      const byTitle = new Map(existing.map((c) => [c.title.toLowerCase(), c]));
      const keepTitles = new Set();

      for (const q of set.questions) {
        if (!q.title) continue;
        keepTitles.add(q.title.toLowerCase());
        const payload = buildChallengePayload(q, set._id);
        const match = byTitle.get(q.title.toLowerCase());
        if (match) {
          Object.assign(match, payload);
          await match.save();
        } else {
          await Challenge.create(payload);
        }
      }

      const toRemove = existing.filter((c) => !keepTitles.has(c.title.toLowerCase()));
      if (toRemove.length > 0) {
        const challengeIdsToRemove = toRemove.map((c) => c._id);
        await cleanupSubmissionsAndUserStats(challengeIdsToRemove);
        await Challenge.deleteMany({ _id: { $in: challengeIdsToRemove } });
      }
    }

    await logAudit({
      action: 'questionset.update',
      actorId: req.user.id,
      targetType: 'questionset',
      targetId: set._id,
      metadata: { title: set.title, weekNumber: set.weekNumber },
    });

    return sendSuccess(res, { data: set, message: 'Question Set updated successfully' });
  } catch (err) {
    return next(err);
  }
};

const deleteQuestionSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      res.status(404);
      throw new Error('Question Set not found');
    }

    const challenges = await Challenge.find({ questionSetId: set._id });
    if (challenges.length > 0) {
      await cleanupSubmissionsAndUserStats(challenges.map(c => c._id));
      await Challenge.deleteMany({ questionSetId: set._id });
    }
    await set.deleteOne();

    await logAudit({
      action: 'questionset.delete',
      actorId: req.user.id,
      targetType: 'questionset',
      targetId: set._id,
      metadata: { title: set.title, weekNumber: set.weekNumber },
    });

    return sendSuccess(res, { message: 'Question Set deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getQuestionSets,
  getQuestionSetById,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet
};
