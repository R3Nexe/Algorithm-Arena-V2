const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  getChallenges,
  getChallengeById,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  importChallenges,
  getLeetCodeDetails,
  browseDomainPool,
  selfAssessDomain,
  bulkCreateDomainQuestions,
  getDueForReview,
} = require('./challenge.controller');

const { protect, admin } = require('../../../middleware/auth');
const { validate } = require('../../../middleware/validate');
const {
  challengeIdParamsSchema,
  challengeCreateSchema,
  challengeUpdateSchema,
  challengeQuerySchema,
} = require('../../../validators/challengeSchemas');

const ALLOWED_MIME_TYPES = new Set(['text/csv', 'text/plain', 'application/vnd.ms-excel']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only CSV files are accepted.`));
    }
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/fetch-leetcode-details', protect, admin, getLeetCodeDetails);

// Domain-question pool browse (must precede '/:id' so 'domain' isn't read as an id).
router.get('/domain', protect, browseDomainPool);
router.get('/domain/due', protect, getDueForReview);
router.post('/domain/self-assess', protect, selfAssessDomain);
router.post('/domain/bulk', protect, admin, bulkCreateDomainQuestions);

router.post('/import', protect, admin, upload.single('file'), importChallenges);

router
  .route('/')
  .get(protect, validate(challengeQuerySchema), getChallenges)
  .post(protect, admin, validate(challengeCreateSchema), createChallenge);

router
  .route('/:id')
  .get(protect, validate(challengeIdParamsSchema), getChallengeById)
  .put(protect, admin, validate(challengeIdParamsSchema), validate(challengeUpdateSchema), updateChallenge)
  .delete(protect, admin, validate(challengeIdParamsSchema), deleteChallenge);

module.exports = router;
