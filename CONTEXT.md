# Algorithm Arena

A platform for running DSA coding-challenge events for a community, built around a
challenge → submission → manual review → scoring lifecycle. This glossary fixes the
vocabulary for **questions, answers, and scoring** — the area most prone to drift now
that questions come in more than one shape.

## Questions

**Question**:
A single prompt a participant answers, stored as a `Challenge` document. Every question
has a `type`. All questions share difficulty, points, and `tags`.
_Avoid_: Problem, task (except "DSA question", see below).

**Type**:
The discriminator on a question: `dsa`, `mcq`, or `written`. Determines how it is
answered, graded, and displayed. Defaults to `dsa`.

**DSA question**:
A `type: dsa` question answered with code, run against test cases via Judge0, then
manually reviewed. The original and only pre-existing question shape.
_Avoid_: Coding challenge, algorithm problem.

**Domain question**:
The umbrella for `mcq` and `written` questions — interview-style questions about a
subject area rather than code. Lives in a standalone pool, not in a Question Set.
_Avoid_: Theory question, quiz question.

**MCQ question**:
A `type: mcq` domain question with a fixed set of `options` and exactly one
`correctOption`. Auto-graded server-side.
_Avoid_: Poll, single-choice.

**Written question**:
A `type: written` domain question answered in prose, carrying a `modelAnswer`. The
learner self-assesses against the model answer; a reviewer separately scores it.
_Avoid_: Essay, long-answer, subjective question.

**Question Set**:
A weekly, deadline-bound collection of DSA questions with a target level. Domain
questions are **not** part of any Question Set.
_Avoid_: Assignment, batch, week.

**Interview Prep**:
The participant-facing area where the standalone domain-question pool is browsed by
`tags` and answered. Distinct from Missions (the DSA/Question-Set area).

## Answering & mastery

**Submission**:
A record of one participant answering one question — code, a selected MCQ option, or
written prose — carrying a review status and the points actually awarded.

**Mastery status**:
A participant's per-question state, held in `DomainProgress`: `Unattempted`,
`NeedsReview`, or `Mastered`. Independent of points.
_Avoid_: Progress, completion, done.

**Needs-review**:
The mastery status of a domain question the participant got wrong (MCQ) or self-marked
as not-yet-understood (written). Resurfaces after a cooldown.
_Avoid_: Failed, incorrect, pending.

**Mastered**:
The mastery status of a domain question answered correctly (MCQ) or self-marked as
understood (written). Still viewable, no longer resurfaced.

**Self-assessment**:
For written questions only: the participant's own *Got it* / *Review later* judgement
after seeing the model answer. Drives mastery status, never points.

**Cooldown**:
The lock period before a Needs-review question may be re-attempted. Escalates by
doubling per wrong/missed attempt (2 → 4 → 8 … days), capped once no points remain
to earn.
_Avoid_: Timeout, delay, wait.

## Scoring

**Full points**:
A question's base award, derived from its difficulty (Easy/Medium/Hard). The starting
value the MCQ decay halves and the amount a written approval grants.

**Decayed award**:
The MCQ points for a correct answer on attempt _n_: `round(fullPoints / 2^(n-1))`,
dropping to 0 once it would fall below 5. Anti-farming device unique to auto-graded
MCQ.
_Avoid_: Penalty, discount.

**Awarded points**:
The points a Submission actually granted (a decayed award, full points, or 0) — as
distinct from the question's full points. Recorded on the Submission.

**Domain-mastered count**:
A participant's tally of mastered domain questions, tracked separately from
`solvedProblems` so domain badges and DSA badges stay independent.
_Avoid_: Solved (that term is reserved for DSA `solvedProblems`).
