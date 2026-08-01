# Clan Chief Set Analytics — Design

**Date:** 2026-07-13
**Branch:** `feat/chief-set-analytics` (merges into `dev`)
**Status:** Approved, pending implementation

## Goal

Give clan chiefs per-question-set analytics inside the existing chief panel,
mirroring the admin dashboard's spirit. Three capabilities, all surfaced in the
existing `ChiefDashboardTab` ("Clan Overview") tab:

1. A card showing the clan's completion rate for the **closest active** question set.
2. A per-set member completion list (`solved/total`) with a **warn** button for
   members with zero submissions (functionality already exists).
3. A graph of the clan's holistic solve-rate trend across recent sets, with each
   member's individual movement vs. the previous set surfaced inline in the list.

## Key context (existing patterns reused)

- **Per-set completion** already has a precedent in `dashboard.controller.js`
  (`getDashboardSummary`): a member's solved count for a set = distinct
  **Accepted** `challengeId`s whose `challenge.questionSetId === setId`; the set's
  denominator is its challenge count.
- **Charts** in this codebase are hand-rolled SVG (`admin-client` `DashboardTab.jsx`).
  No charting library — this design adds none (YAGNI).
- **Warn** already works: `warnMutation` → `POST /api/users/:id/warn`, gated by
  `canIssueWarning`. Unchanged.
- `/api/clans/mine` returns the caller's clan with populated `members` and `chief`.

## Decisions

- **Set window:** the **last 4** question sets, ordered newest-first. Bounds the
  UI and query; guarantees a "previous set" exists for comparison.
- **Chief exclusion:** the chief is excluded from both the per-member map and the
  aggregate `clanCompletionPct`.
- **Completion denominator:** the set's actual challenge count (`X/N`), never a
  hardcoded 5.
- **Graph:** holistic clan solve-rate **trend across the 4 sets** (constant size
  regardless of clan growth). Individual "vs previous set" movement is shown as a
  per-row delta badge in the member list, not as per-member bars — this scales and
  avoids duplicating the member list as a second chart.

## Architecture

### Server: one new endpoint

`GET /api/clans/mine/set-analytics` — resolves the caller's clan the same way
`getMyClan` does, then computes analytics over the last 4 sets.

Response shape:
```jsonc
{
  "sets": [
    { "_id", "title", "weekNumber", "deadline", "challengeCount", "isActive" }
  ],                            // last 4, newest first
  "closestActiveSetId": "…",    // Published && deadline>now, nearest deadline; null if none
  "perSet": {
    "<setId>": {
      "clanCompletionPct": 62,                            // excludes chief
      "members": { "<userId>": { "solved": 3, "total": 5 } }
    }
  }
}
```

**Computation (one aggregation):**
1. `sets` = last 4 `QuestionSet` docs (sort `weekNumber` desc, tiebreak `deadline` desc), limit 4.
2. `challenges` = `Challenge.find({ questionSetId: { $in: setIds } }).select('_id questionSetId')`.
   Build `challengeId → setId` map and per-set `challengeCount`.
3. `memberIds` = clan members excluding the chief.
4. Aggregate distinct `(userId, challengeId)` from `Submission` where
   `userId ∈ memberIds`, `status: 'Accepted'`, `challengeId ∈ allChallengeIds`.
5. Tally in JS into `perSet[setId].members[userId].solved`; `total = challengeCount`.
6. `clanCompletionPct` = `round( totalSolved / (memberCount * total) * 100 )` per set
   (0 when a set has no challenges or the clan has no non-chief members).

**Isolation:** the per-set math lives in a small pure helper
(`computeSetAnalytics(clan, sets, challenges, acceptedPairs)`) so it is unit-testable
without a live request. Auth/clan-resolution stays in the controller.

### Client: `ChiefDashboardTab.jsx` (three changes)

A `useQuery(['chief-set-analytics', clan._id])` fetches the endpoint. Then:

1. **Closest-active-set card** — repoint the existing left-column "Clan Weekly
   Completion" ring to `perSet[closestActiveSetId].clanCompletionPct`; relabel to
   reflect the set (e.g. "Closest Set Completion" + set title). If
   `closestActiveSetId` is null, show an empty state ("No active set").
2. **"Member Progress Overview" card** — add set-selector tabs (the 4 sets,
   newest-first; default = closest active, else most recent). For the selected set,
   list members excluding the chief with `solved/total`, a delta badge vs the
   previous set (`▲ +2` / `▼ −1` / `—`), and the existing warn button. Replaces the
   current `weeklySolved`/`TARGET_PROBLEMS` wiring in this card.
3. **New clan-trend card** (full-width, below the grid) — hand-rolled SVG
   line/bar of `clanCompletionPct` across the 4 sets, chronological order.

The ring stays fixed on the closest active set; the member list and its deltas
follow the selected tab. Loading and empty (no sets) states render gracefully.

## Testing

- **Server:** integration test in `server/tests/api.integration.test.js` — seed a
  clan (chief + members) + 2 question sets + challenges + accepted submissions;
  assert per-set `solved/total`, chief exclusion from `clanCompletionPct`, and
  correct `closestActiveSetId` selection.
- **Client:** `npm run lint` + `vite build`; manual check of tab switching, delta
  badges, and empty states (no active set / no sets).

## Out of scope (YAGNI)

- No new charting dependency.
- No per-member bar chart (deltas in the list cover individual comparison).
- No changes to the weekly stat cards (Total Members / Active / Warned / Pending
  Reviews) beyond what already exists.
- No new warn logic — reuses the existing mutation and authorization.
