# Build Plan — Domain Questions (MCQ + Written)

Adds a second question track — interview-style **domain questions** — alongside DSA
challenges. See `CONTEXT.md` for vocabulary and `docs/adr/0001-domain-question-scoring.md`
for the scoring rationale.

## Shape of the feature (recap)

- New `type` on `Challenge`: `dsa` (default), `mcq`, `written`.
- **Standalone pool** — no Question Set, no deadline; browsed by `tags` in a participant
  **Interview Prep** section.
- **MCQ**: auto-graded server-side; decaying points `round(full / 2^(n-1))`, 0 once <5;
  reveal answer on first wrong; escalating cooldown 2→4→8… days, capped at last earning rung.
- **Written**: self-assessed against a `modelAnswer` (drives mastery + cooldown, no points)
  **and** separately reviewer-scored (full points or 0) via the existing review pipeline.
- **Points** are unified on `User.points`; **mastery** is a separate `domainMastered`
  counter so DSA badges/`codingLevel` are untouched.

Difficulty → full points: **Easy 100, Medium 200, Hard 350**. Decay ladders (round half-up):

| Difficulty | Earning rungs (attempt: award) | 0 from |
|---|---|---|
| Easy 100 | 100, 50, 25, 13, 6 | attempt 6 |
| Medium 200 | 200, 100, 50, 25, 13, 6 | attempt 7 |
| Hard 350 | 350, 175, 88, 44, 22, 11, 5 | attempt 8 |

Cooldown after the _k_-th wrong attempt = `2^k` days, frozen once the next correct award
would be 0.

---

## Phase 1 — Data model & scoring core (backend)

1. **`Challenge.model.js`** — add `type: { enum: ['dsa','mcq','written'], default: 'dsa' }`;
   MCQ fields `options: [String]`, `correctOption: Number`, `explanation: String`;
   written field `modelAnswer: String`. Code fields already optional. Add index on `type`.
   *No migration:* existing docs read back as `dsa`.
2. **`Submission.model.js`** — add `selectedOption: Number`, `answerText: String`,
   `awardedPoints: Number` (records the decayed/actual grant, distinct from face value).
3. **New `DomainProgress.model.js`** — `{ userId, challengeId, type, attempts, status:
   ['NeedsReview','Mastered'], nextAttemptAt: Date, awardedPoints, selfAssessment }`,
   unique compound index `{ userId, challengeId }`.
4. **`User.model.js`** — add `domainMastered: { type: Number, default: 0 }`.
5. **New `utils/domainScoring.js`** — pure, unit-testable:
   - `computeAward(fullPoints, attempt)` → decayed integer, 0 if <5.
   - `nextCooldown(fullPoints, wrongCount)` → `Date`, capped once no award remains.

## Phase 2 — MCQ auto-grade path (backend)

6. **`POST /api/submissions/mcq`** (submissions feature) — the bespoke path from the ADR:
   - Load `DomainProgress`; **reject if `nextAttemptAt > now`** (cooldown active) or already Mastered.
   - Compare `selectedOption` to `correctOption` **server-side**.
   - **Correct** → `award = computeAward(challenge.points, attempts+1)`; create
     `Submission(Accepted, awardedPoints=award)`; if award>0 increment `User.points` +
     `XpLog`; increment `User.domainMastered`; set progress `Mastered`. Emit
     `leaderboard_update`/`points_update` (reuse existing events).
   - **Wrong** → increment `attempts`; `status=NeedsReview`;
     `nextAttemptAt=nextCooldown(...)`; **no scoring Submission**; return `correctOption`
     + `explanation` for the reveal.
   - Reuse the existing 1-hour pending-duplicate guard shape where relevant.

## Phase 3 — Written path + review branch (backend)

7. **`POST /api/submissions/written`** — create `Submission(Pending, answerText)`; return
   `modelAnswer` so the client can reveal it for self-assessment.
8. **`POST /api/domain-progress/self-assess`** — body `{ challengeId, gotIt }`:
   `gotIt` → `Mastered` (+`domainMastered` once); else `NeedsReview` +
   `nextAttemptAt=nextCooldown(...)`. Never touches points.
9. **Review branch** in `submission.controller.js` (the accept block at ~481): when
   `challenge.type !== 'dsa'`, on accept/revert adjust **`domainMastered`** instead of
   `solvedProblems`/`codingLevel`; keep the `points` + `XpLog` logic unchanged. (MCQ never
   reaches manual review.)

## Phase 4 — Read paths & security (backend)

10. **Participant browse** — `GET /api/challenges/domain?tags=&status=` returning the pool
    grouped/filterable by `tags`, joined with the caller's `DomainProgress` for per-card
    state (Unattempted / NeedsReview+due / NeedsReview+locked-until / Mastered).
11. **Answer-key stripping (critical)** — participant-facing serializers must omit
    `correctOption`, `modelAnswer`, `solutions`, and `explanation` until the reveal
    conditions are met (MCQ: after a graded attempt; written: after submit). Add a
    `toParticipantJSON` projection; never rely on the client to hide these.
12. **Dashboard "due for review"** — extend dashboard controller: `DomainProgress` where
    `status=NeedsReview AND nextAttemptAt<=now` → count + list.

## Phase 5 — Admin authoring (backend + admin-client)

13. **Create/update** domain questions (extend challenge admin controller, type-aware
    validation: MCQ needs ≥2 options + a valid `correctOption`; written needs `modelAnswer`).
14. **Bulk upload** `POST /api/admin/challenges/bulk` accepting JSON (clean for MCQ
    options) and CSV; validate per row, report failures, insert in a batch.
15. **Admin UI** — authoring form with type-conditional fields (MCQ option builder w/
    correct marker + explanation; written model-answer editor) + an upload widget. Reuse
    existing admin challenge/question-set authoring patterns.
16. **Review queue** — written domain submissions surface in the existing review UI;
    show `answerText` alongside `modelAnswer` for the reviewer; Approve→full / Reject→0.

## Phase 6 — Participant UI (client)

17. **Interview Prep page** + nav entry with a due-count badge; browse by `tags`; cards
    show mastery state + lock countdown.
18. **MCQ view** — radio options → submit → result; on wrong, reveal correct + explanation
    and show cooldown-until; lock UI while cooling down.
19. **Written view** — textarea → submit → reveal `modelAnswer` → *Got it* / *Review later*
    self-assess buttons; show reviewer status/points separately when available.
20. **Dashboard widget** — "Due for review" list linking into Interview Prep.

## Phase 7 — Tests & seed

21. **Integration tests** (`server/tests/api.integration.test.js`): MCQ correct/wrong,
    decay values per difficulty, cooldown enforcement + escalation + cap, written
    submit→self-assess→review, `domainMastered` moves while `solvedProblems`/`codingLevel`
    stay put, and **answer-key leakage** guards on participant reads.
22. **Unit tests** for `utils/domainScoring.js` (ladder + cap boundaries at the <5 edge).
23. Optional seed script adding a handful of MCQ + written questions across a few `tags`.

---

## Risks / watch-items

- **Answer-key leakage** (Phase 4.11) is the highest-severity item — a single un-projected
  read exposes every correct answer. Test it explicitly.
- **Award correctness on revert** — un-accepting a written domain submission must subtract
  the same `awardedPoints` and decrement `domainMastered`, mirroring the existing DSA revert.
- **Cooldown across sessions** — `nextAttemptAt` is authoritative on the server; the client
  countdown is display-only.
- **`solvedProblems` coupling** — it drives `codingLevel` (25/75); the Phase 3.9 branch must
  be airtight so domain work never shifts a participant's coding level.

## Suggested execution order

Phase 1 → 2 → 3 (backend core, independently testable) → 4 (read/security) → 7 tests for
those → 5 (admin authoring, unblocks content) → 6 (participant UI) → remaining tests.
