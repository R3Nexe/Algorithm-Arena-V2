# Review Queue Navigation — Design

**Date:** 2026-07-13
**Status:** Approved, pending implementation

## Goal

Make reviewing submissions faster for both reviewer roles — admins/moderators
("Review Work" tab, admin-client) and clan chiefs ("Review Submissions" tab,
participant client). Today, clicking a submission opens its challenge detail
page in review mode; grading it returns the reviewer to the list, forcing a
re-click for every submission. This adds:

1. Prev/Next arrows in the detail view to step through the submissions that
   were visible in the list at click-time, without returning to the grid.
2. Auto-advance to the next submission after Accept/Reject.
3. A "Revoke Acceptance" action for clan chiefs, matching the one admins
   already have.

## Existing architecture (relevant facts)

- Two independent React apps — `client` (participant) and `admin-client` —
  each with their own `ChallengeDetails.jsx` implementing the same
  `?review=<submissionId>` review-mode pattern, and their own review list page
  (`ChiefReviewTab.jsx` / `ReviewTab.jsx`).
- A `shared/` directory (aliased in both `vite.config.js`) already holds pure,
  framework-agnostic logic reused by both apps — e.g. `shared/lib/leetcodeDriver.js`,
  `shared/lib/challengeOutput.js`. Convention: the real implementation lives in
  `shared/lib/*.js`; each app has a thin re-export shim at `src/lib/*.js` so
  page-level imports (`../lib/foo`) stay app-local and unchanged.
- `React 19.2.0`, `react-router-dom 7.13.0`, and `@tanstack/react-query 5.90.21`
  versions are identical across both apps, so shared code may safely depend on
  React/React Router (resolved via each app's own installed copy at build time).
- The submission status-update endpoint (`PUT /api/submissions/:id`) is
  authorized by `canActorManageUser`, which is **status-agnostic** — it only
  checks clan scope. A clan chief can already set any of `Pending` / `Accepted`
  / `Rejected` for their own clan's members. Revoke (Accepted → Pending) needs
  **no server changes**, only a missing client-side UI block.
- `ClanChiefPanel.jsx` already initializes its active tab from `?tab=` in the
  URL (fixed previously). `AdminPanel.jsx` does not — its tab is local
  `useState('dashboard')` only. This means `navigate(-1)` (or any navigate to
  a bare `/admin`) from admin review mode does not reliably return to Review
  Work. This must be fixed for the auto-advance "queue exhausted" exit to work
  correctly for admins.

## Decisions

- **Shared logic only, not shared UI.** The reusable part is the *queue
  encoding/navigation logic*, not the page components — `ChallengeDetails.jsx`
  stays two separate files (existing architecture), each gaining the same
  arrow controls and calling the same shared helpers.
- **Queue = a snapshot**, not a live list. It is the ordered set of submission
  IDs (each paired with its challenge ID) visible in the grid at the moment the
  reviewer clicked in. Reaching a boundary (first/last item) disables the
  corresponding arrow — it does **not** auto-fetch another page of results for
  admin's paginated list. Reviewers return to the grid for that.
- **Auto-advance only on Accept/Reject.** After grading, the app immediately
  navigates to the next queue entry (or, if none remains, back to the review
  list tab). Revoke (Accepted → Pending) does **not** auto-advance — the
  reviewer stays on the same submission, now shown as Pending, ready to
  re-review immediately.
- **Queue entries carry `challengeId`.** Submissions in one queue can belong
  to different challenges, so "Next" must route to a different `/challenge/:id`
  path, not just swap a query param. Encoding the challenge ID alongside the
  submission ID avoids an extra lookup request on navigation.

## Architecture

### 1. `shared/lib/reviewQueue.js` (new)

Pure functions, no React/router imports inside the module itself:

```js
encodeReviewQueue(items)              // [{submissionId, challengeId}] -> "sid1:cid1,sid2:cid2,..."
decodeReviewQueue(str)                // -> [{submissionId, challengeId}]
getQueueNav(queue, currentSubmissionId) // -> { index, total, prev, next }  (prev/next: entry | null)
buildReviewUrl(item, queueStr)        // -> "/challenge/:challengeId?review=:submissionId&queue=:queueStr"
```

Each app gets a thin re-export shim (`client/src/lib/reviewQueue.js`,
`admin-client/src/lib/reviewQueue.js`) mirroring the `leetcodeDriver.js` /
`challengeOutput.js` precedent.

### 2. Review list pages — grid view unchanged, links gain a queue param

`ChiefReviewTab.jsx` and `ReviewTab.jsx` keep their current grid rendering,
filters, and (for admin) pagination exactly as-is. The only change: build the
encoded queue once from the currently rendered results (in display order), and
append it to each submission's review link via `buildReviewUrl`.

### 3. `ChallengeDetails.jsx` (both apps) — arrows + auto-advance + revoke

- Read `review` and `queue` from search params; decode the queue;
  `getQueueNav` gives `{ index, total, prev, next }`.
- Render `‹ Prev` / `"{index+1} of {total}"` / `Next ›` in the header next to
  the existing back link, visible only in review mode with a non-empty queue.
  Buttons disabled at boundaries (`prev`/`next` null).
- `handleGrade(status)`:
  - `Accepted` / `Rejected`: on success, if `next` exists, navigate to
    `buildReviewUrl(next, queueParam)`; otherwise navigate to the review list
    tab (`/chief-panel?tab=review` for client, `/admin?tab=review` for admin).
  - `Pending` (revoke): on success, do not navigate — stay on the current
    submission so it re-renders as Pending.
- **Client (`client/src/pages/ChallengeDetails.jsx`) gains the Revoke
  Acceptance block**, ported from `admin-client/src/pages/ChallengeDetails.jsx`
  (confirm dialog + `handleGrade("Pending")`), visible when
  `reviewQuery.data?.status === "Accepted"`. No new server calls — same
  `PUT /api/submissions/:id` endpoint, already authorized for clan chiefs.

### 4. `AdminPanel.jsx` — sync active tab to `?tab=`

Mirror `ClanChiefPanel.jsx`'s existing pattern: initialize `activeTab` from
`searchParams.get('tab')` (falling back to `'dashboard'`), and update the URL
when the tab changes. This is what makes `/admin?tab=review` a valid,
reliable exit destination after the queue is exhausted.

## Testing

- **Unit (shared):** `encodeReviewQueue`/`decodeReviewQueue` round-trip;
  `getQueueNav` boundary cases (first item → `prev: null`, last item →
  `next: null`, single-item queue → both null, id not found in queue).
- **Manual / build verification:** lint + Vite build for both apps (no server
  behavior changes beyond what's already authorized, so no new integration
  test is required — `canActorManageUser` coverage already exists in
  `api.integration.test.js` for clan-scoped status updates).
- Verify: grid views render unchanged; clicking a submission carries the
  correct queue; Prev/Next step through correctly across challenge
  boundaries; Accept/Reject auto-advances; Revoke stays in place; exhausting
  the queue returns to the correct list tab in both apps.

## Out of scope (YAGNI)

- No live-updating queue (e.g., new Pending submissions arriving while
  reviewing do not insert into the current queue).
- No auto-fetch of additional pages when the admin queue boundary is reached.
- No keyboard shortcuts for Prev/Next (can be a fast follow-up if requested).
- No changes to filter/sort behavior on either review list.
