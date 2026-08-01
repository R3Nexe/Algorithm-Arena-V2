# Review Queue Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reviewers (clan chiefs and admin/moderator/superAdmin) step through submissions with Prev/Next arrows after clicking into one from the review grid, auto-advance after Accept/Reject, and give clan chiefs the same "Revoke Acceptance" action admins already have.

**Architecture:** A new pure-logic module `shared/lib/reviewQueue.js` (encode/decode a submission+challenge queue into a URL param, compute prev/next) is re-exported via thin shims in both apps' `src/lib/`, following the existing `challengeOutput.js`/`leetcodeDriver.js` convention. Both review-list pages encode the currently-rendered submissions into a `queue` URL param on their links; both `ChallengeDetails.jsx` pages decode it, render Prev/Next controls, and use it to auto-advance after grading. `AdminPanel.jsx` gains the same `?tab=` URL sync `ClanChiefPanel.jsx` already has, so the "queue exhausted" exit lands on the correct tab.

**Tech Stack:** React 19.2.0, react-router-dom 7.13.0, @tanstack/react-query 5.90.21 (identical versions in both `client` and `admin-client`). No test framework exists for the client apps (no vitest/jest) — pure-logic modules are verified with a throwaway Node `.mjs` script (the established pattern in this repo), and UI changes are verified with `eslint` + `vite build`.

## Global Constraints

- Queue is a **snapshot** of the list at click-time — reaching the last item of a paginated admin page does not fetch another page; the arrow simply disables.
- Auto-advance (to next queue entry, or back to the review list tab if none) applies **only** to Accept/Reject. Revoke (Accepted → Pending) does **not** navigate away — the reviewer stays on the same submission, which re-renders with the reverted status.
- Queue entries carry both `submissionId` and `challengeId` (format `sid:cid`, comma-joined) so "Next" can route to a different `/challenge/:id` in one hop, with no extra lookup request.
- No server changes — `PUT /api/submissions/:id` already authorizes clan chiefs to set any status (including `Pending`) for their own clan's members via `canActorManageUser`.
- Grid views (`ChiefReviewTab.jsx`, `ReviewTab.jsx`) are visually and behaviorally unchanged — only their submission links gain a `&queue=...` suffix.

---

### Task 1: Shared review-queue logic

**Files:**
- Create: `shared/lib/reviewQueue.js`

**Interfaces:**
- Produces: `encodeReviewQueue(items: {submissionId, challengeId}[]) -> string`, `decodeReviewQueue(str: string) -> {submissionId, challengeId}[]`, `getQueueNav(queue: {submissionId, challengeId}[], currentSubmissionId: string) -> {index: number, total: number, prev: {submissionId, challengeId}|null, next: {submissionId, challengeId}|null}`, `buildReviewUrl(item: {submissionId, challengeId}, queueStr: string) -> string`. All four are consumed by Tasks 3–9.

- [ ] **Step 1: Write the module**

```js
/**
 * Pure helpers for the reviewer "queue" — the ordered list of submissions
 * (each paired with its challenge) a reviewer is stepping through after
 * clicking in from a review list. Encoded into a URL param so Prev/Next
 * survives navigation between challenges and page refreshes.
 */

export const encodeReviewQueue = (items) => {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .filter((it) => it && it.submissionId && it.challengeId)
    .map((it) => `${it.submissionId}:${it.challengeId}`)
    .join(",");
};

export const decodeReviewQueue = (str) => {
  if (!str) return [];
  return str
    .split(",")
    .map((pair) => {
      const [submissionId, challengeId] = pair.split(":");
      return submissionId && challengeId ? { submissionId, challengeId } : null;
    })
    .filter(Boolean);
};

export const getQueueNav = (queue, currentSubmissionId) => {
  const list = Array.isArray(queue) ? queue : [];
  const index = list.findIndex((it) => it.submissionId === currentSubmissionId);
  if (index === -1) {
    return { index: -1, total: list.length, prev: null, next: null };
  }
  return {
    index,
    total: list.length,
    prev: index > 0 ? list[index - 1] : null,
    next: index < list.length - 1 ? list[index + 1] : null,
  };
};

export const buildReviewUrl = (item, queueStr) => {
  if (!item) return null;
  const params = new URLSearchParams();
  params.set("review", item.submissionId);
  if (queueStr) params.set("queue", queueStr);
  return `/challenge/${item.challengeId}?${params.toString()}`;
};
```

- [ ] **Step 2: Write and run a throwaway verification script**

```bash
cat > /tmp/reviewqueue_verify.mjs <<'EOF'
import { encodeReviewQueue, decodeReviewQueue, getQueueNav, buildReviewUrl } from "/Users/r3nexe/dev/Projects/Algorithm-Arena-V2/shared/lib/reviewQueue.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { console.log(`PASS ${name}`); pass++; } else { console.log(`FAIL ${name}`); fail++; } };

// Round trip
const items = [{ submissionId: "s1", challengeId: "c1" }, { submissionId: "s2", challengeId: "c2" }, { submissionId: "s3", challengeId: "c3" }];
const encoded = encodeReviewQueue(items);
check("encode format", encoded === "s1:c1,s2:c2,s3:c3");
const decoded = decodeReviewQueue(encoded);
check("round trip", JSON.stringify(decoded) === JSON.stringify(items));
check("encode empty", encodeReviewQueue([]) === "");
check("decode empty string", decodeReviewQueue("").length === 0);
check("decode null", decodeReviewQueue(null).length === 0);

// getQueueNav boundaries
const midNav = getQueueNav(items, "s2");
check("middle: index", midNav.index === 1);
check("middle: total", midNav.total === 3);
check("middle: prev", midNav.prev.submissionId === "s1");
check("middle: next", midNav.next.submissionId === "s3");

const firstNav = getQueueNav(items, "s1");
check("first: prev null", firstNav.prev === null);
check("first: next present", firstNav.next.submissionId === "s2");

const lastNav = getQueueNav(items, "s3");
check("last: next null", lastNav.next === null);
check("last: prev present", lastNav.prev.submissionId === "s2");

const singleNav = getQueueNav([{ submissionId: "only", challengeId: "c1" }], "only");
check("single: prev null", singleNav.prev === null);
check("single: next null", singleNav.next === null);
check("single: total 1", singleNav.total === 1);

const notFoundNav = getQueueNav(items, "missing");
check("not found: index -1", notFoundNav.index === -1);
check("not found: prev null", notFoundNav.prev === null);
check("not found: next null", notFoundNav.next === null);

const emptyNav = getQueueNav([], "s1");
check("empty queue: index -1", emptyNav.index === -1);
check("empty queue: total 0", emptyNav.total === 0);

// buildReviewUrl
const url = buildReviewUrl({ submissionId: "s2", challengeId: "c2" }, encoded);
check("buildReviewUrl shape", url === "/challenge/c2?review=s2&queue=s1%3Ac1%2Cs2%3Ac2%2Cs3%3Ac3");
check("buildReviewUrl no queue", buildReviewUrl({ submissionId: "s1", challengeId: "c1" }, "") === "/challenge/c1?review=s1");
check("buildReviewUrl null item", buildReviewUrl(null, encoded) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
EOF
node /tmp/reviewqueue_verify.mjs
```

Expected: `24 passed, 0 failed` (all `PASS` lines, exit code 0).

- [ ] **Step 3: Clean up the throwaway script**

```bash
rm -f /tmp/reviewqueue_verify.mjs
```

- [ ] **Step 4: Commit**

```bash
git add shared/lib/reviewQueue.js
git commit -m "feat: add shared review-queue navigation helpers"
```

---

### Task 2: App-local re-export shims

**Files:**
- Create: `client/src/lib/reviewQueue.js`
- Create: `admin-client/src/lib/reviewQueue.js`

**Interfaces:**
- Consumes: the four exports from `shared/lib/reviewQueue.js` (Task 1).
- Produces: the same four names, importable as `../lib/reviewQueue` from each app's `src/pages/`.

- [ ] **Step 1: Create the client shim**

```js
// Re-export from shared canonical copy to avoid duplication.
export { encodeReviewQueue, decodeReviewQueue, getQueueNav, buildReviewUrl } from '../../../shared/lib/reviewQueue';
```

Save as `client/src/lib/reviewQueue.js`.

- [ ] **Step 2: Create the admin-client shim**

Save the identical content as `admin-client/src/lib/reviewQueue.js`.

- [ ] **Step 3: Verify both apps resolve the shim**

```bash
cd client && npx eslint src/lib/reviewQueue.js && npx vite build --logLevel warn 2>&1 | tail -6
cd ../admin-client && npx eslint src/lib/reviewQueue.js && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors; both builds complete (pre-existing chunk-size and browserslist warnings are fine, no new errors).

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/reviewQueue.js admin-client/src/lib/reviewQueue.js
git commit -m "feat: re-export shared review-queue helpers in both apps"
```

---

### Task 3: Wire the queue into the clan-chief review list

**Files:**
- Modify: `client/src/pages/chief/ChiefReviewTab.jsx`

**Interfaces:**
- Consumes: `encodeReviewQueue`, `buildReviewUrl` from `../../lib/reviewQueue` (Task 2).

- [ ] **Step 1: Add the `useMemo` import and the queue helpers import**

In `client/src/pages/chief/ChiefReviewTab.jsx`, change:

```js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiCode, FiEye, FiCpu, FiFilter, FiExternalLink } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import { useAuth } from '../../context/useAuth';
import { api } from '../../lib/api';
import { canManageOwnClan, isClanArchived } from '../../lib/permissions';
```

to:

```js
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiCode, FiEye, FiCpu, FiFilter, FiExternalLink } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import { useAuth } from '../../context/useAuth';
import { api } from '../../lib/api';
import { canManageOwnClan, isClanArchived } from '../../lib/permissions';
import { encodeReviewQueue, buildReviewUrl } from '../../lib/reviewQueue';
```

- [ ] **Step 2: Compute the encoded queue from the currently filtered submissions**

Change:

```js
  const filteredSubs = submissionsQuery.data || [];
  const pendingCount = filteredSubs.filter(s => s.status === 'Pending').length;
```

to:

```js
  const filteredSubs = submissionsQuery.data || [];
  const pendingCount = filteredSubs.filter(s => s.status === 'Pending').length;
  const queueParam = useMemo(
    () => encodeReviewQueue(filteredSubs.map(sub => ({ submissionId: sub._id, challengeId: sub.challengeId?._id }))),
    [filteredSubs]
  );
```

- [ ] **Step 3: Point both submission links through `buildReviewUrl`**

Change:

```js
                  <Link 
                    to={`/challenge/${sub.challengeId?._id}?review=${sub._id}`}
                    className="font-bold text-primary truncate block hover:text-accent transition-colors"
                  >
                    {sub.challengeId?.title || 'Unknown Challenge'}
                  </Link>
```

to:

```js
                  <Link 
                    to={buildReviewUrl({ submissionId: sub._id, challengeId: sub.challengeId?._id }, queueParam)}
                    className="font-bold text-primary truncate block hover:text-accent transition-colors"
                  >
                    {sub.challengeId?.title || 'Unknown Challenge'}
                  </Link>
```

And change:

```js
                <Link 
                  to={`/challenge/${sub.challengeId?._id}?review=${sub._id}`}
                  className="px-4 py-2 rounded-lg bg-white/5 text-primary text-xs font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <FiEye /> Review Code
                </Link>
```

to:

```js
                <Link 
                  to={buildReviewUrl({ submissionId: sub._id, challengeId: sub.challengeId?._id }, queueParam)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-primary text-xs font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <FiEye /> Review Code
                </Link>
```

- [ ] **Step 4: Lint and build**

```bash
cd client && npx eslint src/pages/chief/ChiefReviewTab.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/chief/ChiefReviewTab.jsx
git commit -m "feat: encode review queue into chief review list links"
```

---

### Task 4: Wire the queue into the admin review list

**Files:**
- Modify: `admin-client/src/pages/admin/ReviewTab.jsx`

**Interfaces:**
- Consumes: `encodeReviewQueue`, `buildReviewUrl` from `../../lib/reviewQueue` (Task 2).

- [ ] **Step 1: Add the `useMemo` import and the queue helpers import**

Change:

```js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiCheck, FiCode, FiEye, FiFilter, FiClock, FiMessageSquare } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { api } from '../../lib/api';
```

to:

```js
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiCheck, FiCode, FiEye, FiFilter, FiClock, FiMessageSquare } from 'react-icons/fi';
import BaseCard from '../../components/BaseCard';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { api } from '../../lib/api';
import { encodeReviewQueue, buildReviewUrl } from '../../lib/reviewQueue';
```

- [ ] **Step 2: Compute the encoded queue from the currently rendered submissions**

Change:

```js
  const submissions = submissionsQuery.data?.data || [];
  const meta = submissionsQuery.data?.meta || {};
```

to:

```js
  const submissions = submissionsQuery.data?.data || [];
  const meta = submissionsQuery.data?.meta || {};
  const queueParam = useMemo(
    () => encodeReviewQueue(submissions.map(sub => ({ submissionId: sub._id, challengeId: sub.challengeId?._id }))),
    [submissions]
  );
```

- [ ] **Step 3: Point both submission links through `buildReviewUrl`**

Change:

```js
                      <Link
                        to={`/challenge/${sub.challengeId?._id}?review=${sub._id}`}
                        className="font-bold text-primary truncate block hover:text-accent transition-colors"
                      >
                        {sub.challengeId?.title || 'Unknown Challenge'}
                      </Link>
```

to:

```js
                      <Link
                        to={buildReviewUrl({ submissionId: sub._id, challengeId: sub.challengeId?._id }, queueParam)}
                        className="font-bold text-primary truncate block hover:text-accent transition-colors"
                      >
                        {sub.challengeId?.title || 'Unknown Challenge'}
                      </Link>
```

And change:

```js
                    <Link
                      to={`/challenge/${sub.challengeId?._id}?review=${sub._id}`}
                      className="px-4 py-2 rounded-lg bg-white/5 text-primary text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"
                    >
                      <FiEye /> Review
                    </Link>
```

to:

```js
                    <Link
                      to={buildReviewUrl({ submissionId: sub._id, challengeId: sub.challengeId?._id }, queueParam)}
                      className="px-4 py-2 rounded-lg bg-white/5 text-primary text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"
                    >
                      <FiEye /> Review
                    </Link>
```

- [ ] **Step 4: Lint and build**

```bash
cd admin-client && npx eslint src/pages/admin/ReviewTab.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 5: Commit**

```bash
git add admin-client/src/pages/admin/ReviewTab.jsx
git commit -m "feat: encode review queue into admin review list links"
```

---

### Task 5: Prev/Next arrows in the clan-chief challenge detail header

**Files:**
- Modify: `client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `decodeReviewQueue`, `getQueueNav`, `buildReviewUrl` from `../lib/reviewQueue` (Task 2); `queue` URL param produced by Task 3.
- Produces: `queueParam`, `queueNav` values consumed by Task 7 (auto-advance) and Task 9 (revoke UI placement, same file).

- [ ] **Step 1: Add the `FiChevronRight` icon and the reviewQueue import**

Change:

```js
import {
  FiClipboard,
  FiRefreshCw,
  FiTrash2,
  FiCode,
  FiChevronLeft,
  FiSend,
  FiExternalLink,
  FiCheck,
  FiXCircle,
  FiMessageSquare,
  FiUser,
  FiPlay,
  FiMaximize2,
  FiMinimize2,
  FiInfo,
  FiAlertTriangle,
  FiX,
} from "react-icons/fi";
```

to:

```js
import {
  FiClipboard,
  FiRefreshCw,
  FiTrash2,
  FiCode,
  FiChevronLeft,
  FiChevronRight,
  FiSend,
  FiExternalLink,
  FiCheck,
  FiXCircle,
  FiMessageSquare,
  FiUser,
  FiPlay,
  FiMaximize2,
  FiMinimize2,
  FiInfo,
  FiAlertTriangle,
  FiX,
} from "react-icons/fi";
```

And change:

```js
import { argsToJsonStdin, wrapWithDriver, isDrivableSignature } from "../lib/leetcodeDriver";
```

to:

```js
import { argsToJsonStdin, wrapWithDriver, isDrivableSignature } from "../lib/leetcodeDriver";
import { decodeReviewQueue, getQueueNav, buildReviewUrl } from "../lib/reviewQueue";
```

- [ ] **Step 2: Compute the queue and nav state**

Change:

```js
  const isReviewer = ["admin", "superAdmin", "super-admin", "clan-chief"].includes(
    user?.role,
  );
  const isReviewMode = Boolean(reviewSubmissionId) && isReviewer;

  const [repoUrl, setRepoUrl] = useState("");
```

to:

```js
  const isReviewer = ["admin", "superAdmin", "super-admin", "clan-chief"].includes(
    user?.role,
  );
  const isReviewMode = Boolean(reviewSubmissionId) && isReviewer;
  const queueParam = searchParams.get("queue") || "";
  const reviewQueueList = useMemo(() => decodeReviewQueue(queueParam), [queueParam]);
  const queueNav = useMemo(
    () => getQueueNav(reviewQueueList, reviewSubmissionId),
    [reviewQueueList, reviewSubmissionId],
  );

  const [repoUrl, setRepoUrl] = useState("");
```

- [ ] **Step 3: Render the Prev/Next cluster in the header**

Change:

```js
        <Link
          to={isReviewMode ? "/chief-panel?tab=review" : "/dashboard"}
          className="flex items-center gap-1 text-secondary hover:text-primary transition-colors text-xs"
        >
          <FiChevronLeft size={14} />
          <span className="hidden sm:inline">{isReviewMode ? "Code Reviews" : "Missions"}</span>
        </Link>
        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
        <a
```

to:

```js
        <Link
          to={isReviewMode ? "/chief-panel?tab=review" : "/dashboard"}
          className="flex items-center gap-1 text-secondary hover:text-primary transition-colors text-xs"
        >
          <FiChevronLeft size={14} />
          <span className="hidden sm:inline">{isReviewMode ? "Code Reviews" : "Missions"}</span>
        </Link>
        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
        {isReviewMode && queueNav.index !== -1 && (
          <>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => queueNav.prev && navigate(buildReviewUrl(queueNav.prev, queueParam))}
                disabled={!queueNav.prev}
                title="Previous submission"
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FiChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-tertiary tabular-nums px-0.5">
                {queueNav.index + 1}/{queueNav.total}
              </span>
              <button
                type="button"
                onClick={() => queueNav.next && navigate(buildReviewUrl(queueNav.next, queueParam))}
                disabled={!queueNav.next}
                title="Next submission"
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FiChevronRight size={14} />
              </button>
            </div>
            <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
          </>
        )}
        <a
```

- [ ] **Step 4: Lint and build**

```bash
cd client && npx eslint src/pages/ChallengeDetails.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ChallengeDetails.jsx
git commit -m "feat: add review-queue Prev/Next navigation to challenge detail header (chief)"
```

---

### Task 6: Prev/Next arrows in the admin challenge detail header

**Files:**
- Modify: `admin-client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `decodeReviewQueue`, `getQueueNav`, `buildReviewUrl` from `../lib/reviewQueue` (Task 2); `queue` URL param produced by Task 4.
- Produces: `queueParam`, `queueNav` values consumed by Task 8 (auto-advance, same file).

- [ ] **Step 1: Add the `FiChevronRight` icon and the reviewQueue import**

Change:

```js
import {
  FiClipboard,
  FiRefreshCw,
  FiCode,
  FiFileText,
  FiChevronLeft,
  FiExternalLink,
  FiCheck,
  FiXCircle,
  FiMessageSquare,
  FiUser,
  FiPlay,
  FiChevronDown,
  FiChevronUp,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
```

to:

```js
import {
  FiClipboard,
  FiRefreshCw,
  FiCode,
  FiFileText,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiCheck,
  FiXCircle,
  FiMessageSquare,
  FiUser,
  FiPlay,
  FiChevronDown,
  FiChevronUp,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
```

And change:

```js
import { argsToJsonStdin, wrapWithDriver, isDrivableSignature } from "../lib/leetcodeDriver";
import { useAuth } from "../context/useAuth";
```

to:

```js
import { argsToJsonStdin, wrapWithDriver, isDrivableSignature } from "../lib/leetcodeDriver";
import { decodeReviewQueue, getQueueNav, buildReviewUrl } from "../lib/reviewQueue";
import { useAuth } from "../context/useAuth";
```

- [ ] **Step 2: Compute the queue and nav state**

Change:

```js
  const isReviewer = ["admin", "superAdmin", "super-admin", "clan-chief"].includes(user?.role);
  const isReviewMode = Boolean(reviewSubmissionId) && isReviewer;

  const [codeByLang, setCodeByLang] = useState({});
```

to:

```js
  const isReviewer = ["admin", "superAdmin", "super-admin", "clan-chief"].includes(user?.role);
  const isReviewMode = Boolean(reviewSubmissionId) && isReviewer;
  const queueParam = searchParams.get("queue") || "";
  const reviewQueueList = useMemo(() => decodeReviewQueue(queueParam), [queueParam]);
  const queueNav = useMemo(
    () => getQueueNav(reviewQueueList, reviewSubmissionId),
    [reviewQueueList, reviewSubmissionId],
  );

  const [codeByLang, setCodeByLang] = useState({});
```

- [ ] **Step 3: Fix the back link and render the Prev/Next cluster in the header**

The current back link uses a `preventDefault` + `navigate(-1)` hack that this feature must not rely on (history-back is exactly the source of the "lands on the wrong tab" bug this plan fixes elsewhere). Replace it with a direct href, and add the Prev/Next cluster.

Change:

```js
        <Link
          to="/"
          onClick={(e) => { e.preventDefault(); navigate(-1); }}
          className="flex items-center gap-1 text-secondary hover:text-primary transition-colors text-xs"
        >
          <FiChevronLeft size={14} />
          <span className="hidden sm:inline">{isReviewMode ? "Reviews" : "Back"}</span>
        </Link>
        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
        <a href={challenge.link || "#"} target="_blank" rel="noopener noreferrer">
```

to:

```js
        <Link
          to={isReviewMode ? "/?tab=review" : "/"}
          className="flex items-center gap-1 text-secondary hover:text-primary transition-colors text-xs"
        >
          <FiChevronLeft size={14} />
          <span className="hidden sm:inline">{isReviewMode ? "Reviews" : "Back"}</span>
        </Link>
        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
        {isReviewMode && queueNav.index !== -1 && (
          <>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => queueNav.prev && navigate(buildReviewUrl(queueNav.prev, queueParam))}
                disabled={!queueNav.prev}
                title="Previous submission"
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FiChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-tertiary tabular-nums px-0.5">
                {queueNav.index + 1}/{queueNav.total}
              </span>
              <button
                type="button"
                onClick={() => queueNav.next && navigate(buildReviewUrl(queueNav.next, queueParam))}
                disabled={!queueNav.next}
                title="Next submission"
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FiChevronRight size={14} />
              </button>
            </div>
            <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
          </>
        )}
        <a href={challenge.link || "#"} target="_blank" rel="noopener noreferrer">
```

- [ ] **Step 4: Lint and build**

```bash
cd admin-client && npx eslint src/pages/ChallengeDetails.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 5: Commit**

```bash
git add admin-client/src/pages/ChallengeDetails.jsx
git commit -m "feat: add review-queue Prev/Next navigation to challenge detail header (admin)"
```

---

### Task 7: Auto-advance after grading (clan-chief app)

**Files:**
- Modify: `client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `queueNav`, `queueParam` from Task 5 (same file); `buildReviewUrl` from `../lib/reviewQueue`.

- [ ] **Step 1: Update `handleGrade`'s post-success navigation**

Change:

```js
      toast.success(`Submission ${status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["chief-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      // Return to the Review Submissions tab (not history back — the chief panel
      // switches tabs via local state, so navigate(-1) lands on the default tab).
      navigate("/chief-panel?tab=review");
```

to:

```js
      toast.success(`Submission ${status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["chief-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      if (status === "Pending") {
        // Revoke: stay on this submission so it re-renders with the reverted status.
        queryClient.invalidateQueries({ queryKey: ["review-submission", reviewSubmissionId] });
      } else if (queueNav.next) {
        // Auto-advance to the next submission in the queue.
        navigate(buildReviewUrl(queueNav.next, queueParam));
      } else {
        // Queue exhausted (or no queue) — return to the Review Submissions tab.
        // Not history back — the chief panel switches tabs via local state, so
        // navigate(-1) can land on the default tab instead.
        navigate("/chief-panel?tab=review");
      }
```

- [ ] **Step 2: Lint and build**

```bash
cd client && npx eslint src/pages/ChallengeDetails.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ChallengeDetails.jsx
git commit -m "feat: auto-advance to next queued submission after accept/reject (chief)"
```

---

### Task 8: Auto-advance after grading (admin app)

**Files:**
- Modify: `admin-client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `queueNav`, `queueParam` from Task 6 (same file); `buildReviewUrl` from `../lib/reviewQueue`.

- [ ] **Step 1: Update `handleGrade`'s post-success navigation**

Change:

```js
      toast.success(`Submission ${status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["chief-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      navigate(-1);
```

to:

```js
      toast.success(`Submission ${status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["chief-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      if (status === "Pending") {
        // Revoke: stay on this submission so it re-renders with the reverted status.
        queryClient.invalidateQueries({ queryKey: ["review-submission", reviewSubmissionId] });
      } else if (queueNav.next) {
        // Auto-advance to the next submission in the queue.
        navigate(buildReviewUrl(queueNav.next, queueParam));
      } else {
        // Queue exhausted (or no queue) — return to the Review Work tab.
        navigate("/?tab=review");
      }
```

- [ ] **Step 2: Lint and build**

```bash
cd admin-client && npx eslint src/pages/ChallengeDetails.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 3: Commit**

```bash
git add admin-client/src/pages/ChallengeDetails.jsx
git commit -m "feat: auto-advance to next queued submission after accept/reject (admin)"
```

---

### Task 9: Revoke Acceptance for clan chiefs

**Files:**
- Modify: `client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: `handleGrade` from Task 7 (same file, already handles `status === "Pending"` as a stay-in-place revoke).

No server changes: `PUT /api/submissions/:id` is already authorized for clan chiefs to set any status (including `Pending`) on their own clan's members via `canActorManageUser` (status-agnostic scope check).

- [ ] **Step 1: Add the `showRevokeConfirm` state**

Change:

```js
  // Review mode state
  const [reviewComment, setReviewComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [grading, setGrading] = useState(false);
```

to:

```js
  // Review mode state
  const [reviewComment, setReviewComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [grading, setGrading] = useState(false);
```

- [ ] **Step 2: Add the Revoke Acceptance block after the Accept/Reject buttons**

Change:

```js
                )}
              </div>
            </div>
          ) : null}
```

to:

```js
                )}
              </div>

              {reviewQuery.data?.status === "Accepted" && (
                <div className="flex gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                  {!showRevokeConfirm ? (
                    <button
                      onClick={() => setShowRevokeConfirm(true)}
                      disabled={grading}
                      className="w-full py-2 flex items-center justify-center gap-2 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all disabled:opacity-50 border border-orange-500/20"
                    >
                      <FiRefreshCw size={13} />
                      Revoke Acceptance
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { handleGrade("Pending"); setShowRevokeConfirm(false); }}
                        disabled={grading}
                        className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl bg-orange-500/15 text-orange-400 text-xs font-bold hover:bg-orange-500/25 transition-all disabled:opacity-50 border border-orange-500/30"
                      >
                        <FiRefreshCw size={13} />
                        {grading ? "Processing..." : "Confirm Revoke"}
                      </button>
                      <button
                        onClick={() => setShowRevokeConfirm(false)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary bg-black/5 dark:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
```

Note: `FiRefreshCw` is already imported in this file (used elsewhere) — no import change needed.

- [ ] **Step 3: Lint and build**

```bash
cd client && npx eslint src/pages/ChallengeDetails.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ChallengeDetails.jsx
git commit -m "feat: add Revoke Acceptance action for clan chiefs"
```

---

### Task 10: Sync AdminPanel's active tab to the URL

**Files:**
- Modify: `admin-client/src/pages/AdminPanel.jsx`

**Interfaces:**
- Produces: `/?tab=review` (and other tab ids) as a valid entry point, consumed by Task 8's exhausted-queue exit and Task 6's back link.

This mirrors the existing, working pattern in `client/src/pages/ClanChiefPanel.jsx:16-20` (`validTabs` array + `useState` initialized once from `searchParams.get('tab')`).

- [ ] **Step 1: Import `useSearchParams`**

Change:

```js
import React, { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
```

to:

```js
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
```

- [ ] **Step 2: Initialize `activeTab` from the URL**

Change:

```js
const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialClanFilter, setInitialClanFilter] = useState('');
```

to:

```js
const AdminPanel = () => {
  const [searchParams] = useSearchParams();
  const validTabs = ['dashboard', 'review', 'sets', 'clans', 'resources', 'members'];
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [initialClanFilter, setInitialClanFilter] = useState('');
```

- [ ] **Step 3: Lint and build**

```bash
cd admin-client && npx eslint src/pages/AdminPanel.jsx && npx vite build --logLevel warn 2>&1 | tail -6
```

Expected: no eslint errors, build completes.

- [ ] **Step 4: Commit**

```bash
git add admin-client/src/pages/AdminPanel.jsx
git commit -m "fix: sync AdminPanel active tab to the URL so review navigation lands correctly"
```

---

## Manual verification (after all tasks)

No component-level test runner exists for either client app (no vitest/jest configured), so final verification is manual, using each app's dev server:

1. `npm run dev` (from repo root, or `cd client && npm run dev` / `cd admin-client && npm run dev`).
2. As a clan chief: open **Review Submissions**, confirm the grid is unchanged, click a submission — arrows and `"N / total"` appear in the header. Step Prev/Next across submissions that belong to different challenges. Accept one — confirms it auto-advances to the next queued submission (or returns to Review Submissions if it was last). On an Accepted submission, click **Revoke Acceptance** → **Confirm Revoke** — confirms it stays on the same submission, now shown as Pending.
3. As an admin: repeat the same flow in **Review Work**. Confirm exhausting the queue returns to `/?tab=review` and the Review Work tab is active (not Overview).
4. Confirm a submission list filtered to a single item shows no enabled Prev/Next (both disabled, `"1 / 1"`).
