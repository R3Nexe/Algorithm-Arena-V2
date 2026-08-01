# Execution Time & Memory on Submissions

**Date:** 2026-07-16
**Status:** Approved

## Problem

Judge0 already returns `time` (seconds) and `memory` (KB) per executed test case. The client already surfaces these transiently, per-case, in the live "Run" result panel (`client/src/components/challenge/TestResultPanel.jsx:310-313`). But `handleSubmit` in `client/src/pages/ChallengeDetails.jsx` re-runs every test case through Judge0 before deciding pass/fail, has the same `time`/`memory` data in memory at that point, and discards it — `submitToServer` posts only `{challengeId, repositoryUrl, code, language, userFeedback}`. The `Submission` model has no fields for it. Once a submission is made, its execution performance is gone forever — not visible in submission history, submission details, or the manual review UI.

## Scope

- Persist a single aggregate time/memory stat per submission (not per-test-case).
- Show it on Submission Details (participant-facing) and in both review panels (chief in `client/`, admin in `admin-client/`).
- Tighten the live Run panel with a one-line aggregate summary, in addition to its existing per-case breakdown (unchanged).
- Out of scope: per-test-case persistence, re-executing at review time, using these numbers for grading/XP/scoring, backfilling pre-existing submissions.

## Design

### 1. Aggregation rule

From the array of per-test-case Judge0 results already produced by `runTestCases()`:
- Filter out any case with `compile_output`, `stderr`, or a missing/null `time` (errored or timed-out cases contribute nothing).
- If no cases remain, the aggregate is `null` (nothing is stored/shown).
- Otherwise: `execTimeSec = max(time)` across remaining cases, `execMemoryKb = max(memory)` across remaining cases — the "worst case" the judge observed, matching the spirit of a LeetCode-style Runtime/Memory stat.

This applies to any submission that goes through the normal pass/fail gate in `handleSubmit` (i.e. `runTestCases()` ran and all cases passed). "Submit Anyway" — the escape hatch used when a participant believes their code is correct but the judge itself is misbehaving — deliberately does **not** carry stats: that path bypasses `handleSubmit`'s re-run entirely (it goes through `FeedbackDialog`'s `onSubmit={submitToServer}`, called with only the feedback text), and since the whole premise of Submit Anyway is "the judge run isn't trustworthy," its timing/memory numbers wouldn't be a meaningful performance signal even if captured. Repo-link-only submissions (no pasted code) never execute, so they never have stats either.

### 2. Data model

`server/src/features/submissions/Submission.model.js` — add two optional fields:

```js
execTimeSec: { type: Number },   // Judge0's native unit: seconds, decimal (e.g. 0.024)
execMemoryKb: { type: Number },  // Judge0's native unit: kilobytes, integer (e.g. 15564)
```

No default, no required. Absent on submissions made before this feature, or on repo-link-only submissions. Stored in Judge0's native units — no lossy conversion happens before persistence; formatting for display happens at render time only.

### 3. Server validation

`server/validators/submissionSchemas.js`, `submissionCreateSchema` body — add:

> **Pre-existing bug fixed in passing:** this schema's `language` field is `z.enum(['javascript', 'python', 'java', 'cpp'])` — missing `'c'`, even though `authSchemas.js`'s `preferredLanguage` enum already includes it. Since the C driver shipped, any participant submitting a C solution gets a hard 400 on Submit despite Run working fine. This task's edit is in the same object as the fix, so it's folded in here rather than filed separately.

```js
execTimeSec: z.number().nonnegative().optional(),
execMemoryKb: z.number().nonnegative().optional(),
```

These fields are informational only — never read by any grading, XP, or scoring logic — so validation only needs to reject non-numeric/negative garbage, not authenticate the client's computation.

`submitCode` controller (`server/src/features/submissions/submission.controller.js`) passes them straight into `Submission.create({...})` alongside the existing fields.

### 4. Client: compute + submit

New export in `shared/lib/challengeOutput.js` (see §5 — colocated with the formatter that consumes its output, and needed by both the submit flow and the live Run panel per §8):

  ```js
  export const computeExecStats = (results) => {
    const usable = (results || []).filter(
      (c) => !c.compile_output && !c.stderr && c.time != null,
    );
    if (usable.length === 0) return null;
    return {
      execTimeSec: Math.max(...usable.map((c) => Number(c.time))),
      execMemoryKb: Math.max(...usable.map((c) => Number(c.memory))),
    };
  };
  ```

- In `client/src/pages/ChallengeDetails.jsx`, `handleSubmit` already computes `results` via `runTestCases()` before the pass/fail branch. Import `computeExecStats` from the shared re-export and compute `const stats = computeExecStats(results);` there, then pass it through to `submitToServer`.
- `submitToServer(userFeedbackVal, stats)` spreads `stats` (if non-null) into the POST body:

  ```js
  await api.post("/api/submissions", {
    challengeId: id,
    repositoryUrl: repoUrl.trim() || undefined,
    code: codeSnippet.trim() || undefined,
    language,
    userFeedback: userFeedbackVal || undefined,
    ...(stats || {}),
  });
  ```

- The repo-link-only branch (`if (!codeSnippet.trim()) { await submitToServer(); return; }`) passes no stats — nothing was executed.

### 5. Shared formatter

Also in `shared/lib/challengeOutput.js` (already shared cross-app, already holds `outputsMatch`/`displayExpected` — natural home), consumed by both apps via their existing re-export files (same pattern as `leetcodeDriver.js`):

```js
export const formatExecStats = (execTimeSec, execMemoryKb) => {
  if (execTimeSec == null || execMemoryKb == null) return null;
  const time = execTimeSec < 1
    ? `${Math.round(execTimeSec * 1000)} ms`
    : `${execTimeSec.toFixed(2)} s`;
  const memory = execMemoryKb < 1024
    ? `${Math.round(execMemoryKb)} KB`
    : `${(execMemoryKb / 1024).toFixed(1)} MB`;
  return { time, memory };
};
```

Every display site below imports this — no formatting logic duplicated three times.

### 6. Display: Submission Details

`client/src/pages/SubmissionDetails.jsx` — render a stat row (e.g. `⏱ 24 ms   💾 15.2 MB`) only when `submission.execTimeSec != null`, near the top of the submission card alongside the existing status/points/language row.

### 7. Display: review panels

Both `client/src/pages/ChallengeDetails.jsx` (chief review mode, `isReviewMode`) and `admin-client/src/pages/ChallengeDetails.jsx` (admin review mode) already fetch the submission under review (`sub` in the review-load effect). Add the same stat row next to the submitted code/language indicator, same conditional rendering and formatter.

### 8. Live Run panel tightening

`client/src/components/challenge/TestResultPanel.jsx` — at the top of the "Test Result" tab body (`bottomTab === "output"`, above the per-case list), when `runOutput?.cases?.length` exists, import `computeExecStats`/`formatExecStats` from the shared re-export and render one summary line: `Max: 24 ms · 15.2 MB`. The existing per-case `{c.time}s · {c.memory} KB` lines are untouched. Because both helpers live in `shared/lib/challengeOutput.js` (§4/§5), the submit flow and the live Run panel share identical aggregation and formatting logic with no duplication.

## Error handling / edge cases

- All test cases errored (compile failure, all timeouts): `computeExecStats` returns `null` → no stats sent, no stat row rendered anywhere. Never crashes on empty/all-null input.
- Partial failure (some cases pass, some error): errored cases are excluded from the max; stats reflect only cases that actually executed.
- Pre-existing submissions without these fields: `execTimeSec == null` guards every display site — they simply render without the stat row, no migration needed.
- Negative or non-numeric values from a tampered client: rejected by Zod validation (`nonnegative()`), submission creation fails with the existing validation-error path — no special handling needed since these fields aren't required for a valid submission (they're `.optional()`).

## Testing

- Server: extend the existing submission integration test (`server/tests/api.integration.test.js`) to POST a submission with `execTimeSec`/`execMemoryKb` and assert they round-trip on the created document and on `GET` by id.
- Server: assert a negative `execTimeSec` is rejected (400).
- Client: no existing test framework covers `ChallengeDetails.jsx` interactively; verify `computeExecStats` and `formatExecStats` with plain unit-style assertions if a client test runner is available, otherwise verify via manual smoke (run a challenge, submit, check Submission Details + review panel).
