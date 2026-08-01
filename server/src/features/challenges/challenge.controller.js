const Challenge = require('./Challenge.model');
const QuestionSet = require('./QuestionSet.model');
const { sendSuccess } = require('../../../utils/response');
const { logAudit } = require('../../../utils/audit');
const csv = require('csv-parser');
const { Readable } = require('stream');
const mammoth = require('mammoth');
const { fetchLeetCodeDetails } = require('../../../services/leetcode.service');
const { cleanupSubmissionsAndUserStats } = require('./challenge.service');
const { getPointsForDifficulty } = require('../../../utils/xp');

const getChallenges = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      difficulty,
      category,
      setId,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = req.query;

    const safeLimit = Math.min(Number(limit) || 10, 100);

    const filter = {};
    const andConditions = [];

    if (setId) filter.questionSetId = setId;
    if (difficulty) filter.difficulty = difficulty;
    if (category) {
      andConditions.push({
        $or: [
          { category: { $regex: category, $options: 'i' } },
          { tags: { $in: [new RegExp(category, 'i')] } }
        ]
      });
    }
    if (search) {
      andConditions.push({ $text: { $search: search } });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const skip = (Number(page) - 1) * safeLimit;

    let total;
    let challenges;

    if (sortBy === 'recommended') {
      const countPromise = Challenge.countDocuments(filter);
      const aggPromise = Challenge.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'questionsets',
            localField: 'questionSetId',
            foreignField: '_id',
            as: 'questionSetId'
          }
        },
        {
          $unwind: {
            path: '$questionSetId',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            difficultyOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$difficulty', 'Easy'] }, then: 1 },
                  { case: { $eq: ['$difficulty', 'Medium'] }, then: 2 },
                  { case: { $eq: ['$difficulty', 'Hard'] }, then: 3 }
                ],
                default: 4
              }
            },
            deadlineSort: { $ifNull: ['$questionSetId.deadline', new Date('9999-12-31')] }
          }
        },
        { $sort: { deadlineSort: 1, difficultyOrder: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit }
      ]);

      const [totalCount, aggResults] = await Promise.all([countPromise, aggPromise]);
      total = totalCount;
      challenges = aggResults;
    } else if (sortBy === 'difficulty') {
      const countPromise = Challenge.countDocuments(filter);
      const aggPromise = Challenge.aggregate([
        { $match: filter },
        {
          $addFields: {
            difficultyOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$difficulty', 'Hard'] }, then: 3 },
                  { case: { $eq: ['$difficulty', 'Medium'] }, then: 2 },
                  { case: { $eq: ['$difficulty', 'Easy'] }, then: 1 }
                ],
                default: 0
              }
            }
          }
        },
        { $sort: { difficultyOrder: sortOrder, createdAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit },
        {
          $lookup: {
            from: 'questionsets',
            localField: 'questionSetId',
            foreignField: '_id',
            as: 'questionSetId'
          }
        },
        {
          $unwind: {
            path: '$questionSetId',
            preserveNullAndEmptyArrays: true
          }
        }
      ]);

      const [totalCount, aggResults] = await Promise.all([countPromise, aggPromise]);
      total = totalCount;
      challenges = aggResults;
    } else {
      const sort = { [sortBy]: sortOrder };
      const [totalCount, findResults] = await Promise.all([
        Challenge.countDocuments(filter),
        Challenge.find(filter).populate('questionSetId').sort(sort).skip(skip).limit(safeLimit),
      ]);
      total = totalCount;
      challenges = findResults;
    }

    // Auto-create Challenge documents for question sets that don't have them yet
    if (setId && total === 0 && !search && !difficulty && !category) {
      const questionSet = await QuestionSet.findById(setId);
      if (questionSet && questionSet.questions && questionSet.questions.length > 0) {
        const challengesToInsert = questionSet.questions.map(q => ({
          title: q.title,
          description: q.description || '',
          difficulty: q.difficulty || 'Easy',
          points: getPointsForDifficulty(q.difficulty || 'Easy'),
          category: q.category || 'Logic',
          tags: q.tags || [],
          codeSnippets: q.codeSnippets || [],
          solutions: q.solutions || [],
          functionName: q.functionName || '',
          params: q.params || [],
          returnType: q.returnType || '',
          orderIndependent: !!q.orderIndependent,
          testCases: q.testCases || [],
          questionSetId: questionSet._id,
        }));
        challenges = await Challenge.insertMany(challengesToInsert);
        total = challenges.length;
      }
    }

    return sendSuccess(res, {
      data: challenges,
      meta: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getChallengeById = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      res.status(404);
      throw new Error('Challenge not found');
    }

    return sendSuccess(res, { data: challenge });
  } catch (err) {
    return next(err);
  }
};

const createChallenge = async (req, res, next) => {
  try {
    req.body.points = req.body.points || getPointsForDifficulty(req.body.difficulty);
    const challenge = await Challenge.create(req.body);

    await logAudit({
      action: 'challenge.create',
      actorId: req.user.id,
      targetType: 'challenge',
      targetId: challenge._id,
      metadata: {
        title: challenge.title,
        difficulty: challenge.difficulty,
        points: challenge.points,
      },
    });

    const { emitEvent } = require('../../../config/socket');
    emitEvent('new_challenge', {
      challengeId: challenge._id,
      title: challenge.title,
      difficulty: challenge.difficulty,
    });

    return sendSuccess(res, {
      statusCode: 201,
      data: challenge,
      message: 'Challenge created successfully',
    });
  } catch (err) {
    return next(err);
  }
};

const updateChallenge = async (req, res, next) => {
  try {
    if (req.body.points) {
      // keep user-supplied points
    } else if (req.body.difficulty) {
      req.body.points = getPointsForDifficulty(req.body.difficulty);
    } else {
      delete req.body.points;
    }
    const challenge = await Challenge.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!challenge) {
      res.status(404);
      throw new Error('Challenge not found');
    }

    await logAudit({
      action: 'challenge.update',
      actorId: req.user.id,
      targetType: 'challenge',
      targetId: challenge._id,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    return sendSuccess(res, {
      data: challenge,
      message: 'Challenge updated successfully',
    });
  } catch (err) {
    return next(err);
  }
};

const deleteChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      res.status(404);
      throw new Error('Challenge not found');
    }

    // --- Cleanup logic for Submissions and User Stats ---
    await cleanupSubmissionsAndUserStats([challenge._id]);
    // ----------------------------------------------------

    await challenge.deleteOne();

    await logAudit({
      action: 'challenge.delete',
      actorId: req.user.id,
      targetType: 'challenge',
      targetId: challenge._id,
      metadata: {
        title: challenge.title,
      },
    });

    return sendSuccess(res, {
      data: null,
      message: 'Challenge removed successfully',
    });
  } catch (err) {
    return next(err);
  }
};

const importChallenges = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { originalname, buffer } = req.file;
    const ext = originalname.split('.').pop().toLowerCase();
    let challengesData = [];

    if (ext === 'json') {
      try {
        challengesData = JSON.parse(buffer.toString('utf-8'));
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON format' });
      }
    } else if (ext === 'csv') {
      challengesData = await new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString('utf-8'));
        stream.pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      // Simple parsing: assuming each question is separated by a blank line or '---'
      // Example docx format parsing: very rudimentary
      const blocks = text.split(/\n\s*\n|---/);
      blocks.forEach(block => {
         const lines = block.trim().split('\n');
         if(lines.length >= 3) {
            challengesData.push({
               title: lines[0].replace(/Title:/i, '').trim() || 'Imported Challenge',
               difficulty: lines[1].replace(/Difficulty:/i, '').trim() || 'Medium',
               points: Number(lines[2].replace(/Points:/i, '').trim()) || 100,
               description: lines.slice(3).join('\n').trim()
            });
         }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format' });
    }

    // Process and validate array
    if (!Array.isArray(challengesData) || challengesData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid questions found in file' });
    }

    // Strip HTML tags from all imported string fields to prevent stored XSS
    const stripHtml = (str) => (str ? String(str).replace(/<[^>]*>/g, '').trim() : '');

    // Default formatting
    const formatted = challengesData.map(c => ({
      title: stripHtml(c.title) || 'Untitled',
      description: stripHtml(c.description) || 'No description provided.',
      difficulty: ['Easy', 'Medium', 'Hard'].includes(c.difficulty) ? c.difficulty : 'Medium',
      category: stripHtml(c.category) || 'General',
      points: getPointsForDifficulty(['Easy', 'Medium', 'Hard'].includes(c.difficulty) ? c.difficulty : 'Medium'),
      solutions: Array.isArray(c.solutions) ? c.solutions : [],
      testCases: c.testCases && Array.isArray(c.testCases) ? c.testCases : [],
    }));

    const created = await Challenge.insertMany(formatted);

    await logAudit({
      action: 'challenge.import',
      actorId: req.user.id,
      targetType: 'challenge',
      targetId: null,
      metadata: { count: created.length, format: ext },
    });

    return sendSuccess(res, {
      statusCode: 201,
      data: created,
      message: `Successfully imported ${created.length} challenges`,
    });
  } catch (err) {
    return next(err);
  }
};

const getLeetCodeDetails = async (req, res, next) => {
  try {
    const { slug } = req.query;
    if (!slug) {
      res.status(400);
      throw new Error('LeetCode slug is required');
    }

    const details = await fetchLeetCodeDetails(slug);
    return sendSuccess(res, { data: details });
  } catch (err) {
    return next(err);
  }
};

// Participant-facing browse of the standalone domain-question pool, filtered by tags and
// joined with the caller's mastery state. Selects only safe fields so answer keys
// (correctOption, explanation, modelAnswer, solutions) never reach the client.
const browseDomainPool = async (req, res, next) => {
  try {
    const DomainProgress = require('./DomainProgress.model');
    const { tags, type } = req.query;

    const filter = { type: { $in: ['mcq', 'written'] } };
    if (type === 'mcq' || type === 'written') filter.type = type;
    if (tags) {
      const tagList = String(tags).split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length) {
        filter.tags = { $in: tagList.map((t) => new RegExp(`^${t}$`, 'i')) };
      }
    }

    const challenges = await Challenge.find(filter)
      .select('title description type difficulty points tags options createdAt')
      .lean();

    const progresses = await DomainProgress.find({
      userId: req.user.id,
      challengeId: { $in: challenges.map((c) => c._id) },
    }).lean();
    const byId = new Map(progresses.map((p) => [String(p.challengeId), p]));

    const now = new Date();
    const items = challenges.map((c) => {
      const p = byId.get(String(c._id));
      return {
        ...c,
        masteryStatus: p?.status || 'Unattempted',
        nextAttemptAt: p?.nextAttemptAt || null,
        locked: p?.nextAttemptAt ? p.nextAttemptAt > now : false,
      };
    });

    return sendSuccess(res, { data: { items } });
  } catch (err) {
    next(err);
  }
};

// A participant's self-assessment of a written domain answer after seeing the model answer.
// Drives the mastery bucket and cooldown only — never points. Mastery transitions maintain
// the separate domainMastered counter.
const selfAssessDomain = async (req, res, next) => {
  try {
    const DomainProgress = require('./DomainProgress.model');
    const { nextAttemptAt } = require('../../../utils/domainScoring');
    const User = require('../users/User.model');
    const { challengeId, gotIt } = req.body;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge || challenge.type !== 'written') {
      res.status(404);
      throw new Error('Written question not found');
    }

    const existing = await DomainProgress.findOne({ userId: req.user.id, challengeId });
    const wasMastered = existing?.status === 'Mastered';

    let update;
    if (gotIt) {
      update = { type: 'written', status: 'Mastered', nextAttemptAt: null, selfAssessment: 'gotIt' };
    } else {
      const attempt = (existing?.attempts || 0) + 1;
      update = {
        type: 'written',
        status: 'NeedsReview',
        selfAssessment: 'reviewLater',
        attempts: attempt,
        nextAttemptAt: nextAttemptAt(challenge.points || 0, attempt),
      };
    }

    await DomainProgress.findOneAndUpdate(
      { userId: req.user.id, challengeId },
      { $set: update },
      { upsert: true }
    );

    if (gotIt && !wasMastered) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { domainMastered: 1 } });
    } else if (!gotIt && wasMastered) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { domainMastered: -1 } });
    }

    return sendSuccess(res, { data: { status: update.status, nextAttemptAt: update.nextAttemptAt || null } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChallenges,
  browseDomainPool,
  selfAssessDomain,
  getChallengeById,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  importChallenges,
  getLeetCodeDetails,
};
