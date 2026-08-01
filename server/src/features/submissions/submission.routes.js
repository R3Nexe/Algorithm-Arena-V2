const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const {
  submitCode,
  submitMcq,
  getSubmissions,
  getMySubmissions,
  getLeaderboard,
  getSubmissionById,
  updateSubmissionStatus,
  getSubmissionsByUsername,
  submitRunBatch,
  getRunBatchResults,
} = require('./submission.controller');

const { protect, admin, chiefOrAdmin } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validate');
const {
  submissionIdParamsSchema,
  submissionCreateSchema,
  submissionUpdateSchema,
  submissionQuerySchema,
  leaderboardQuerySchema,
  mySubmissionQuerySchema,
  userSubmissionQuerySchema,
} = require('../../../validators/submissionSchemas');

const runLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 runs per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const { ipKeyGenerator } = require('express-rate-limit');
    return req.user ? req.user.id : ipKeyGenerator(req.ip);
  },
  message: { success: false, message: 'Too many code execution requests. Please try again after a minute.' },
});

router
  .route('/')
  .get(protect, chiefOrAdmin, validate(submissionQuerySchema), getSubmissions)
  .post(protect, validate(submissionCreateSchema), submitCode);

router.get('/my-submissions', protect, validate(mySubmissionQuerySchema), getMySubmissions);
router.get('/my', protect, validate(mySubmissionQuerySchema), getMySubmissions);
router.get('/leaderboard', protect, validate(leaderboardQuerySchema), getLeaderboard);
router.get('/user/:username', protect, validate(userSubmissionQuerySchema), getSubmissionsByUsername);

router.post('/mcq', protect, submitMcq);

router.post('/run/batch', protect, runLimiter, submitRunBatch);
router.get('/run/batch', protect, getRunBatchResults);

router
  .route('/:id')
  .get(protect, validate(submissionIdParamsSchema), getSubmissionById)
  .put(protect, chiefOrAdmin, validate(submissionIdParamsSchema), validate(submissionUpdateSchema), updateSubmissionStatus);

module.exports = router;

