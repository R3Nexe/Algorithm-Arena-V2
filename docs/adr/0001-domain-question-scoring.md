# Decaying MCQ points with escalating cooldown for domain questions

**Status:** accepted

## Context

We are adding domain questions (MCQ and written) as a standalone, deadline-free pool
alongside the existing DSA challenges. MCQ questions are auto-graded server-side and
have only four options, so unlimited retries would make points effectively guaranteed
and meaningless on the leaderboard. We still want wrong answers to be a learning
opportunity (flashcard-style) rather than a dead end, and we want mastery tracking to
be separate from the competitive score.

## Decision

For **MCQ** questions:

- The correct answer is revealed on the first wrong attempt, and the question is then
  locked for a **cooldown** before it may be re-attempted.
- Points for a correct answer on attempt _n_ are `round(fullPoints / 2^(n-1))`, where
  `fullPoints` comes from difficulty. Once that value would fall **below 5**, the award
  is **0**.
- The cooldown **escalates** by doubling per wrong attempt (2 → 4 → 8 … days) and is
  **capped** at the last points-earning rung — past that the question is practice-only:
  it can still become Mastered but yields no points and no longer escalates.

For **written** questions, points are **not** decayed: a reviewer approves (full points)
or not (0). The escalating cooldown still governs the self-assessed *Review later* bucket.

Mastering a domain question increments a **separate `domainMastered` counter**, not the
DSA `solvedProblems` count, so domain badges and DSA badges remain independent tracks.
Leaderboard **points** remain a single unified number across all question types.

## Consequences

- MCQ needs a bespoke server-side auto-grade-and-award path (points, XpLog,
  domain-mastered) rather than reusing the manual-review award path.
- The decayed/awarded amount and the cooldown timestamp cannot be derived from a
  Submission alone; they live in a per-user `DomainProgress` record.
- Reversing the scheme later means recomputing historical awards — the anti-farming
  shape is baked into how points were granted, not just how they're displayed.
