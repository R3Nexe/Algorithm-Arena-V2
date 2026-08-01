# Execution Time & Memory on Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every "Run" and "Submit" of code shows the exact execution time and peak memory Judge0 measured, and a submitted solution's stats persist and are visible later on Submission Details and in both review panels.

**Architecture:** The client already re-runs every test case through Judge0 before submitting and already receives `time`/`memory` per case — today that data is discarded after the pass/fail check. We add a pure aggregation step (max time, max memory across non-errored cases) and a pure formatter, both in the already-shared `shared/lib/challengeOutput.js`, and thread the two resulting numbers through the existing submit payload into a widened `Submission` schema. No new Judge0 calls, no server-side computation — the server only stores and returns what the client already measured.

**Tech Stack:** React (client + admin-client), Express + Mongoose + Zod (server), plain ESM shared module, Node's built-in `node:test` (server integration tests).

**Spec:** `docs/superpowers/specs/2026-07-16-submission-exec-stats-design.md`

## Global Constraints

- Aggregate only — no per-test-case persistence. `execTimeSec` = max time, `execMemoryKb` = max memory, both computed only over test cases that did NOT error (no `compile_output`, no `stderr`, `time != null`). If none qualify, the aggregate is `null` — nothing is sent, nothing is stored, nothing renders.
- Stored in Judge0's native units: `execTimeSec` is seconds (decimal), `execMemoryKb` is kilobytes. Conversion to human units (ms/s, KB/MB) happens only at render time via one shared formatter.
- Applies to any submission where code was executed (including "Submit Anyway"). Repo-link-only submissions never have stats.
- These fields are informational only — never read by grading, XP, or scoring logic. Server validation only rejects non-numeric/negative values.
- Display sites: Submission Details page (`client/src/pages/SubmissionDetails.jsx`) and both review panels (`client/src/pages/ChallengeDetails.jsx` chief review mode, `admin-client/src/pages/ChallengeDetails.jsx` admin review mode). NOT submission history/list rows (explicitly out of scope).
- Live "Run" panel gets one added summary line (`Max: 24 ms · 15.2 MB`) above its existing untouched per-case breakdown.
- Pre-existing submissions without these fields must render with no stat row — no migration, no backfill.
- `docs/` is gitignored — never `git add` the spec/plan files.

---

### Task 1: Server — schema, validation, controller pass-through

**Files:**
- Modify: `server/src/features/submissions/Submission.model.js`
- Modify: `server/validators/submissionSchemas.js`
- Modify: `server/src/features/submissions/submission.controller.js:15-62` (`submitCode`)
- Test: `server/tests/api.integration.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (server-only, independent of the client changes).
- Produces: `POST /api/submissions` accepts optional `execTimeSec` (number ≥ 0) and `execMemoryKb` (number ≥ 0) in the body; the created and later-fetched submission documents include these fields when provided. `language` enum now accepts `'c'`.

- [ ] **Step 1: Write the failing integration tests**

Add to `server/tests/api.integration.test.js`, after the existing `test('submission with userFeedback validation and storage', ...)` block (ends at line 659):

```js
test('submission execTimeSec/execMemoryKb round-trip and language=c is accepted', async () => {
  const admin = await registerUser({ username: 'exec_admin', email: 'exec_admin@example.com' });
  await User.findOneAndUpdate({ email: 'exec_admin@example.com' }, { role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'exec_admin@example.com',
    password: 'strong-password',
  });
  const adminToken = adminLogin.body.data.token;

  const student = await registerUser({ username: 'exec_student', email: 'exec_student@example.com' });

  const challengeRes = await request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Exec Stats Challenge',
      description: 'Test exec stats',
      difficulty: 'Easy',
      points: 100,
      category: 'Logic',
    });
  assert.equal(challengeRes.status, 201);
  const challengeId = challengeRes.body.data._id;

  // language 'c' + exec stats round-trip
  const submitRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({
      challengeId,
      code: 'int main(){return 0;}',
      language: 'c',
      execTimeSec: 0.024,
      execMemoryKb: 15564,
    });
  assert.equal(submitRes.status, 201);
  assert.equal(submitRes.body.data.language, 'c');
  assert.equal(submitRes.body.data.execTimeSec, 0.024);
  assert.equal(submitRes.body.data.execMemoryKb, 15564);

  const fetchRes = await request(app)
    .get(`/api/submissions/${submitRes.body.data._id}`)
    .set('Authorization', `Bearer ${student.token}`);
  assert.equal(fetchRes.status, 200);
  assert.equal(fetchRes.body.data.execTimeSec, 0.024);
  assert.equal(fetchRes.body.data.execMemoryKb, 15564);

  // omitting exec stats still works (repo-link-style submission)
  const noStatsRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ challengeId, code: 'int main(){return 1;}', language: 'c' });
  assert.equal(noStatsRes.status, 201);
  assert.equal(noStatsRes.body.data.execTimeSec, undefined);
  assert.equal(noStatsRes.body.data.execMemoryKb, undefined);

  // negative value rejected
  const badRes = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ challengeId, code: 'int main(){return 1;}', language: 'c', execTimeSec: -1 });
  assert.equal(badRes.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --test-name-pattern="submission execTimeSec"`
Expected: FAIL. Two independent failures are expected before implementation:
- `language: 'c'` gets rejected by the current `z.enum(['javascript', 'python', 'java', 'cpp'])` (400 instead of 201), OR
- if `language` happens to pass, `submitRes.body.data.execTimeSec` is `undefined` (assertion fails: expected `0.024`)

- [ ] **Step 3: Widen the Mongoose schema**

In `server/src/features/submissions/Submission.model.js`, add two fields after `submittedAt` (before the closing `});` of `submissionSchema`, at line 29:

```js
  submittedAt: { type: Date, default: Date.now },
  // Aggregate Judge0 stats from the test-case run that gated this submission.
  // Native Judge0 units: seconds (decimal) and kilobytes (integer). Absent on
  // submissions predating this field or made via repo-link only.
  execTimeSec: { type: Number },
  execMemoryKb: { type: Number },
```

- [ ] **Step 4: Widen the Zod schema and fix the missing `'c'` language**

In `server/validators/submissionSchemas.js`, replace the `submissionCreateSchema` body object (lines 11-17):

```js
    .object({
      challengeId: z.string().length(24),
      repositoryUrl: z.string().trim().url().optional(),
      code: z.string().trim().min(1).max(50000).optional(),
      language: z.enum(['javascript', 'python', 'java', 'cpp', 'c']).default('javascript'),
      userFeedback: z.string().trim().min(5).max(2000).optional(),
      execTimeSec: z.number().nonnegative().optional(),
      execMemoryKb: z.number().nonnegative().optional(),
    })
```

- [ ] **Step 5: Pass the fields through in the controller**

In `server/src/features/submissions/submission.controller.js`, `submitCode` (line 15-62), update the destructure and the `Submission.create` call:

```js
const submitCode = async (req, res, next) => {
  try {
    const { challengeId, repositoryUrl, code, language, userFeedback, execTimeSec, execMemoryKb } = req.body;
```

```js
    const submission = await Submission.create({
      userId: req.user.id,
      challengeId,
      repositoryUrl: repositoryUrl || undefined,
      code: code || undefined,
      language: language || 'javascript',
      userFeedback: userFeedback || undefined,
      execTimeSec: execTimeSec ?? undefined,
      execMemoryKb: execMemoryKb ?? undefined,
    });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npm test -- --test-name-pattern="submission execTimeSec"`
Expected: PASS.

- [ ] **Step 7: Run the full server suite**

Run: `cd server && npm test`
Expected: all tests passing (20/20 — 19 pre-existing + this new one), 0 fail.

- [ ] **Step 8: Commit**

```bash
git add server/src/features/submissions/Submission.model.js server/validators/submissionSchemas.js server/src/features/submissions/submission.controller.js server/tests/api.integration.test.js
git commit -m "feat: persist execution time/memory on submissions; fix missing C language

Submissions now optionally carry execTimeSec/execMemoryKb, the aggregate
Judge0 stats from the test-case run that gated the submit. Also fixes a
pre-existing gap where the submission language enum never included 'c',
which made C submissions fail validation despite Run working."
```

---

### Task 2: Shared lib — aggregation + formatter

**Files:**
- Modify: `shared/lib/challengeOutput.js`
- Modify: `client/src/lib/challengeOutput.js` (re-export list)
- Modify: `admin-client/src/lib/challengeOutput.js` (re-export list)
- Create: `shared/lib/verify-exec-stats.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 (pure functions, no server dependency).
- Produces: `computeExecStats(results) → { execTimeSec: number, execMemoryKb: number } | null` and `formatExecStats(execTimeSec, execMemoryKb) → { time: string, memory: string } | null`, both exported from `shared/lib/challengeOutput.js` and re-exported by both apps' `src/lib/challengeOutput.js`. `results` is an array of objects each optionally having `compile_output`, `stderr`, `time` (number or numeric string), `memory` (number or numeric string) — the same shape already produced by `runTestCases()` in both apps' `ChallengeDetails.jsx` (see `client/src/pages/ChallengeDetails.jsx:474-485`). Tasks 3, 4, and 5 import both functions from their app's `../lib/challengeOutput` (or `../../lib/challengeOutput` from a nested page).

- [ ] **Step 1: Write the failing verification script**

Create `shared/lib/verify-exec-stats.mjs`:

```js
// Verifies the pure exec-stats aggregation/formatting functions with real
// assertions (no mocks). Usage: node shared/lib/verify-exec-stats.mjs
import assert from "node:assert/strict";
import { computeExecStats, formatExecStats } from "./challengeOutput.js";

let failures = 0;
const check = (desc, fn) => {
  try {
    fn();
    console.log(`  ok   ${desc}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL ${desc}\n    ${e.message}`);
  }
};

// --- computeExecStats -------------------------------------------------------
check("empty array -> null", () => {
  assert.equal(computeExecStats([]), null);
});

check("undefined/null input -> null", () => {
  assert.equal(computeExecStats(undefined), null);
  assert.equal(computeExecStats(null), null);
});

check("all cases errored (compile_output) -> null", () => {
  const r = [{ compile_output: "syntax error", time: null, memory: null }];
  assert.equal(computeExecStats(r), null);
});

check("all cases errored (stderr) -> null", () => {
  const r = [{ stderr: "boom", time: "0.01", memory: 1000 }];
  assert.equal(computeExecStats(r), null);
});

check("mixed errored + successful: only successful cases count", () => {
  const r = [
    { compile_output: "", stderr: "runtime error", time: "0.5", memory: 50000 },
    { time: "0.02", memory: 15000 },
    { time: "0.03", memory: 12000 },
  ];
  assert.deepEqual(computeExecStats(r), { execTimeSec: 0.03, execMemoryKb: 15000 });
});

check("string time/memory values are coerced to numbers for max", () => {
  const r = [
    { time: "0.100", memory: "20000" },
    { time: "0.050", memory: "30000" },
  ];
  assert.deepEqual(computeExecStats(r), { execTimeSec: 0.1, execMemoryKb: 30000 });
});

check("single successful case", () => {
  const r = [{ time: "0.007", memory: 9000 }];
  assert.deepEqual(computeExecStats(r), { execTimeSec: 0.007, execMemoryKb: 9000 });
});

// --- formatExecStats ---------------------------------------------------------
check("null inputs -> null", () => {
  assert.equal(formatExecStats(null, null), null);
  assert.equal(formatExecStats(0.5, null), null);
  assert.equal(formatExecStats(null, 500), null);
});

check("sub-second time formats as rounded ms", () => {
  assert.deepEqual(formatExecStats(0.024, 500), { time: "24 ms", memory: "500 KB" });
});

check(">=1s time formats as seconds with 2 decimals", () => {
  assert.deepEqual(formatExecStats(1.5, 500), { time: "1.50 s", memory: "500 KB" });
});

check("sub-1024KB memory formats as rounded KB", () => {
  assert.deepEqual(formatExecStats(0.01, 1023), { time: "10 ms", memory: "1023 KB" });
});

check(">=1024KB memory formats as MB with 1 decimal", () => {
  assert.deepEqual(formatExecStats(0.01, 2048), { time: "10 ms", memory: "2.0 MB" });
});

check("exactly 1024KB crosses into MB", () => {
  assert.deepEqual(formatExecStats(0.01, 1024), { time: "10 ms", memory: "1.0 MB" });
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node shared/lib/verify-exec-stats.mjs`
Expected: FAIL — `computeExecStats` and `formatExecStats` are not yet exported from `shared/lib/challengeOutput.js`, so the import throws (`SyntaxError: The requested module './challengeOutput.js' does not provide an export named 'computeExecStats'`) or, if Node resolves it as `undefined`, every `check` throws `TypeError: computeExecStats is not a function`. Either way: non-zero exit, no "ALL PASS".

- [ ] **Step 3: Implement in the shared module**

Add to the end of `shared/lib/challengeOutput.js` (after `defaultStarterByLanguage`, currently ending at line 183):

```js

/**
 * Aggregates per-test-case Judge0 results (as produced by runTestCases()) into
 * a single submission-level stat: the worst-case (max) time and memory across
 * every test case that actually executed. Cases with a compile error, a
 * runtime stderr, or a missing time value contribute nothing. Returns null if
 * no case qualifies (e.g. every case errored).
 */
export const computeExecStats = (results) => {
  const usable = (results || []).filter(
    (c) => !c?.compile_output && !c?.stderr && c?.time != null,
  );
  if (usable.length === 0) return null;
  return {
    execTimeSec: Math.max(...usable.map((c) => Number(c.time))),
    execMemoryKb: Math.max(...usable.map((c) => Number(c.memory))),
  };
};

/**
 * Formats stored (Judge0-native-unit) exec stats into human-readable strings.
 * Time: milliseconds under 1s, otherwise seconds to 2 decimals.
 * Memory: kilobytes under 1024, otherwise megabytes to 1 decimal.
 * Returns null if either value is missing (nothing to show).
 */
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

- [ ] **Step 4: Run to verify it passes**

Run: `node shared/lib/verify-exec-stats.mjs`
Expected: all 12 checks `ok`, `ALL PASS`, exit 0.

- [ ] **Step 5: Add both functions to each app's re-export file**

In `client/src/lib/challengeOutput.js`, add `computeExecStats,` and `formatExecStats,` to the export list (alphabetical position doesn't matter — match the existing list's ordering by appending after `defaultStarterByLanguage,`):

```js
export {
  LANG_LITERALS,
  decodeHtmlEntities,
  normalizeOutput,
  displayExpected,
  tryParseJson,
  floatsClose,
  deepEqualWithTolerance,
  canonicalize,
  outputsMatch,
  formatArgForStdin,
  argsToStdin,
  b64Encode,
  b64Decode,
  defaultStarterByLanguage,
  computeExecStats,
  formatExecStats,
} from '../../../shared/lib/challengeOutput';
```

Apply the identical change to `admin-client/src/lib/challengeOutput.js` (same export list, same addition).

- [ ] **Step 6: Lint both re-export files**

Run: `cd client && npx eslint src/lib/challengeOutput.js && cd ../admin-client && npx eslint src/lib/challengeOutput.js`
Expected: no errors (pre-existing React-version warning is noise).

- [ ] **Step 7: Commit**

```bash
git add shared/lib/challengeOutput.js shared/lib/verify-exec-stats.mjs client/src/lib/challengeOutput.js admin-client/src/lib/challengeOutput.js
git commit -m "feat: add computeExecStats/formatExecStats to shared challenge-output lib

Pure aggregation (max time/memory across non-errored test cases) and
formatting (ms/s, KB/MB) helpers, verified with a real assertion harness
and re-exported by both apps so submit-flow and review-panel displays
share identical logic."
```

---

### Task 3: Client — capture and submit stats

**Files:**
- Modify: `client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `computeExecStats` from `../lib/challengeOutput` (Task 2). `runTestCases()` (existing, unchanged) returns the array `computeExecStats` expects — see `client/src/pages/ChallengeDetails.jsx:509` (`return results;`).
- Produces: `submitToServer(userFeedbackVal, stats)` — `stats` is `{ execTimeSec, execMemoryKb } | null | undefined`, spread into the POST body when truthy. No other task depends on this signature (Tasks 4-5 only read submissions back, they don't call this).

- [ ] **Step 1: Import the new helper**

In `client/src/pages/ChallengeDetails.jsx`, replace:

```js
import {
  argsToStdin,
  b64Encode,
  b64Decode,
  outputsMatch,
  defaultStarterByLanguage,
} from "../lib/challengeOutput";
```

with:

```js
import {
  argsToStdin,
  b64Encode,
  b64Decode,
  outputsMatch,
  defaultStarterByLanguage,
  computeExecStats,
} from "../lib/challengeOutput";
```

- [ ] **Step 2: Thread stats through submitToServer**

Locate `submitToServer` (line 544-568) and `handleSubmit` (line 570-607). Replace both functions:

```js
  const submitToServer = async (userFeedbackVal, stats) => {
    setSubmitting(true);
    try {
      await api.post("/api/submissions", {
        challengeId: id,
        repositoryUrl: repoUrl.trim() || undefined,
        code: codeSnippet.trim() || undefined,
        language,
        userFeedback: userFeedbackVal || undefined,
        ...(stats || {}),
      });
      toast.success("Solution submitted.");
      setRepoUrl("");
      setCodeByLang({});
      localStorage.removeItem(draftKey);
      setShowSubmitAnyway(false);
      setShowFeedbackModal(false);
      queryClient.invalidateQueries({ queryKey: ["my-submissions", id] });
      queryClient.invalidateQueries({ queryKey: ["dash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dash-profile"] });
    } catch (err) {
      toast.error(err.response?.data?.message || err.userMessage || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!repoUrl && !codeSnippet.trim())
      return toast.error("Please provide code or a GitHub link.");

    if (!codeSnippet.trim()) {
      await submitToServer();
      return;
    }

    setSubmitting(true);
    updateBottomCollapsed(false);
    setBottomTab("output");
    setRunOutput(null);

    try {
      const results = await runTestCases();
      const hasError = results.some((c) => c.compile_output || c.stderr);
      const orderIndependent = challengeQuery.data?.orderIndependent;
      const allPassed =
        !hasError &&
        results.every(
          (c) => c.expected != null && outputsMatch(c.stdout, c.expected, orderIndependent),
        );
      const stats = computeExecStats(results);

      if (allPassed) {
        toast.success("All test cases passed! Submitting solution...");
        await submitToServer(undefined, stats);
      } else {
        setShowSubmitAnyway(true);
        toast.error("Some test cases failed. You can choose to Submit Anyway.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to run verification tests.");
      setShowSubmitAnyway(true);
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 3: Leave the "Submit Anyway" call site as-is**

Near the end of the file (around line 1119-1124), `<FeedbackDialog open={showFeedbackModal} onClose={...} onSubmit={submitToServer} isSubmitting={submitting} />` passes `submitToServer` directly as the dialog's submit callback — when the user confirms "Submit Anyway" with an optional feedback note, the dialog invokes it as `submitToServer(feedbackText)`, one argument. This is the "Submit Anyway" path (bypasses `handleSubmit`'s re-run/gate entirely, per the existing `renderSubmitButton` logic at line 683-710). It has no `results` in scope, so `stats` correctly stays `undefined` there — no change needed at this call site. Do not modify the `<FeedbackDialog .../>` block.

- [ ] **Step 4: Lint**

Run: `cd client && npx eslint src/pages/ChallengeDetails.jsx`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

No test framework covers this file. Verify by reading the diff: `submitToServer`'s new `stats` parameter only affects the request body (additive, spread-guarded), and `handleSubmit`'s only new line is `const stats = computeExecStats(results);` plus passing it through — no control-flow change to the existing pass/fail gating logic. Confirm `git diff client/src/pages/ChallengeDetails.jsx` shows only these additive changes (no accidental removal of the existing `submitToServer()` no-arg call in the repo-link branch, which must remain unchanged).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ChallengeDetails.jsx
git commit -m "feat: send aggregate exec stats when submitting a solution

handleSubmit already re-runs every test case before deciding pass/fail;
now it also computes and forwards the max time/memory from that run so
the created submission carries real execution stats."
```

---

### Task 4: Display — Submission Details and both review panels

**Files:**
- Modify: `client/src/pages/SubmissionDetails.jsx`
- Modify: `client/src/pages/ChallengeDetails.jsx` (chief review header area)
- Modify: `admin-client/src/pages/ChallengeDetails.jsx` (admin review panel)

**Interfaces:**
- Consumes: `formatExecStats` from each app's `../lib/challengeOutput` (or `../../lib/challengeOutput` — match each file's existing relative import depth) — Task 2. Submission objects returned by `GET /api/submissions/:id` now include `execTimeSec`/`execMemoryKb` when present (Task 1; no other backend change needed — `getSubmissionById` has no field projection, confirmed at `server/src/features/submissions/submission.controller.js:376-379`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Submission Details stat row**

In `client/src/pages/SubmissionDetails.jsx`, add the import (alongside the existing `import { api } from '../lib/api';` at line 21):

```jsx
import { formatExecStats } from '../lib/challengeOutput';
```

After `const submission = submissionQuery.data;` (line 112), add:

```jsx
  const execStats = formatExecStats(submission.execTimeSec, submission.execMemoryKb);
```

In the header block (lines 140-143), add the stat row next to `StatusBadge`:

```jsx
        <div className="flex items-center gap-3 shrink-0">
          {execStats && (
            <span className="hidden sm:inline-flex items-center gap-2 text-[11px] font-mono text-secondary bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-full">
              <span>⏱ {execStats.time}</span>
              <span>·</span>
              <span>💾 {execStats.memory}</span>
            </span>
          )}
          <StatusBadge status={submission.status} />
        </div>
```

- [ ] **Step 2: Chief review panel stat row (client)**

In `client/src/pages/ChallengeDetails.jsx`, extend the same `../lib/challengeOutput` import Task 3 Step 1 already modified — add `formatExecStats` as one more line inside the same `{ ... }` block (final state: `argsToStdin, b64Encode, b64Decode, outputsMatch, defaultStarterByLanguage, computeExecStats, formatExecStats`).

Near the `statusChip` block (line 787-799, inside the header's flex row), add a stat span right after it, gated on review mode and data availability:

```jsx
          {isReviewMode && reviewQuery.data && (() => {
            const execStats = formatExecStats(reviewQuery.data.execTimeSec, reviewQuery.data.execMemoryKb);
            return execStats ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                ⏱ {execStats.time} · 💾 {execStats.memory}
              </span>
            ) : null;
          })()}
```

Place this immediately after the closing `)}` of the `statusChip` block (after line 799) and before `{renderSubmitButton("hidden lg:inline-flex")}` (line 800).

- [ ] **Step 3: Admin review panel stat row**

In `admin-client/src/pages/ChallengeDetails.jsx`, replace:

```js
import {
  normalizeOutput,
  displayExpected,
  argsToStdin,
  b64Encode,
  b64Decode,
  defaultStarterByLanguage,
  outputsMatch,
} from "../lib/challengeOutput";
```

with:

```js
import {
  normalizeOutput,
  displayExpected,
  argsToStdin,
  b64Encode,
  b64Decode,
  defaultStarterByLanguage,
  outputsMatch,
  formatExecStats,
} from "../lib/challengeOutput";
```

In the review panel's user-info row (lines 956-979), add the stat span after the status badge, inside the same `<div className="flex items-center gap-3">` (line 956), so it reads: avatar, name/submitted-at, exec-stats (if any), status badge:

```jsx
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent font-bold text-xs">
                      <FiUser size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {reviewQuery.data.userId?.username || "Unknown"}
                      </p>
                      <p className="text-[10px] text-secondary">
                        Submitted {new Date(reviewQuery.data.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    {(() => {
                      const execStats = formatExecStats(reviewQuery.data.execTimeSec, reviewQuery.data.execMemoryKb);
                      return execStats ? (
                        <span className="text-[10px] font-mono text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ⏱ {execStats.time} · 💾 {execStats.memory}
                        </span>
                      ) : null;
                    })()}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        reviewQuery.data.status === "Pending"
                          ? "bg-yellow-500/15 text-yellow-500"
                          : reviewQuery.data.status === "Accepted"
                            ? "bg-green-500/15 text-green-500"
                            : "bg-red-500/15 text-red-500"
                      }`}
                    >
                      {reviewQuery.data.status}
                    </span>
                  </div>
```

This replaces the existing block spanning lines 956-979 (same structure, one new conditional span inserted before the status badge).

- [ ] **Step 4: Lint all three files**

Run:
```bash
cd client && npx eslint src/pages/SubmissionDetails.jsx src/pages/ChallengeDetails.jsx
cd ../admin-client && npx eslint src/pages/ChallengeDetails.jsx
```
Expected: no new errors in either app (pre-existing unrelated errors, if any, are not this task's concern).

- [ ] **Step 5: Manual verification**

No test framework covers these files. Verify via `git diff` that each change is additive and conditionally rendered (`execStats && (...)` / ternary returning `null`), so submissions without stats render identically to before this change — confirm no existing JSX structure was altered outside the inserted blocks.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/SubmissionDetails.jsx client/src/pages/ChallengeDetails.jsx admin-client/src/pages/ChallengeDetails.jsx
git commit -m "feat: show execution time/memory on Submission Details and review panels

Renders the stored aggregate stat wherever a submission is later viewed —
the participant's own details page, and both the chief and admin review
panels. Submissions without stats (pre-existing, or repo-link-only)
render unchanged."
```

---

### Task 5: Live Run panel summary line

**Files:**
- Modify: `client/src/components/challenge/TestResultPanel.jsx`

**Interfaces:**
- Consumes: `computeExecStats`, `formatExecStats` from `../../lib/challengeOutput` (Task 2). `runOutput.cases` — the prop already passed into this component (see `client/src/pages/ChallengeDetails.jsx:948` `runOutput={runOutput}` and the panel's existing usage at `TestResultPanel.jsx:229` `runOutput.cases.map(...)`) — same shape `computeExecStats` expects.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the import**

In `client/src/components/challenge/TestResultPanel.jsx`, extend the existing import from `../../lib/challengeOutput` (line 13-17):

```jsx
import {
  argsToStdin,
  outputsMatch,
  displayExpected,
  computeExecStats,
  formatExecStats,
} from "../../lib/challengeOutput";
```

- [ ] **Step 2: Render the summary line above the per-case list**

Locate the Result tab's success branch (line 227-320, the `<div className="space-y-3">` wrapping `runOutput.cases.map(...)`, starting at line 228). Insert a summary line immediately before it:

```jsx
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const stats = computeExecStats(runOutput.cases);
                    const formatted = stats ? formatExecStats(stats.execTimeSec, stats.execMemoryKb) : null;
                    return formatted ? (
                      <p className="text-[11px] font-mono text-secondary bg-black/5 dark:bg-white/5 rounded-md px-2.5 py-1.5 inline-block">
                        Max: {formatted.time} · {formatted.memory}
                      </p>
                    ) : null;
                  })()}
                  {runOutput.cases.map((c, i) => {
```

This wraps the existing `{runOutput.cases.map((c, i) => {` (line 229) — do not change anything inside the `.map()` callback (lines 229-319 stay exactly as they are; the per-case `{c.time && (<p>...{c.time}s · {c.memory} KB</p>)}` display at lines 310-314 is explicitly left untouched per the spec).

- [ ] **Step 3: Lint**

Run: `cd client && npx eslint src/components/challenge/TestResultPanel.jsx`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Verify via `git diff` that the only change is the inserted IIFE block before the existing `.map()` call — the map's body (per-case rendering) is byte-identical to before.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/challenge/TestResultPanel.jsx
git commit -m "feat: add max time/memory summary line to live Run results

One aggregate line above the existing per-case breakdown, using the same
computeExecStats/formatExecStats helpers the submit flow now uses — Run
and Submit report identical numbers for identical code."
```

---

### Task 6: Full regression sweep

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything above.
- Produces: green build, ready for the whole-branch review.

- [ ] **Step 1: Shared verification scripts**

Run: `node shared/lib/verify-exec-stats.mjs`
Expected: `ALL PASS`, exit 0.

Run: `node shared/lib/verify-drivers.mjs`
Expected: `ALL PASS`, exit 0 (this task didn't touch the driver code, but confirms Task 2's edits to `shared/lib/challengeOutput.js` didn't somehow break the sibling `leetcodeDriver.js` module — both are imported by the same re-export files).

- [ ] **Step 2: Lints**

Run: `cd client && npm run lint`
Run: `cd admin-client && npm run lint`
Expected: exit 0 in both, no new errors introduced by this plan (pre-existing unrelated warnings/errors, if any, are not this plan's concern — note them if present).

- [ ] **Step 3: Server integration tests**

Run: `cd server && npm test`
Expected: all tests passing (20/20 — the 19 pre-existing plus Task 1's new test), 0 fail.

- [ ] **Step 4: Manual smoke (if dev server running)**

- Solve a challenge, click Run: confirm the new "Max: X ms · Y KB" summary line appears above the existing per-case results.
- Submit a passing solution: confirm no errors, submission is created.
- Open that submission's Submission Details page: confirm the ⏱/💾 stat row appears in the header next to the status badge.
- As a chief/admin, open the review queue and select that submission: confirm the same stat appears in the review panel.
- Submit a solution in language `c` specifically: confirm it no longer fails validation (this is the folded-in bug fix from Task 1).
- Open a submission made *before* this feature (or temporarily unset `execTimeSec` on one via direct DB edit): confirm Submission Details and the review panel render with no stat row and no layout glitch.
