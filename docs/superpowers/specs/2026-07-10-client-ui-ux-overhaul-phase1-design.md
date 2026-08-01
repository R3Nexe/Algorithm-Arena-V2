# Client UI/UX Overhaul — Phase 1 (Design System + Core Loop) — Design Spec

**Date:** 2026-07-10
**Scope:** `client/` (participant app) only. Admin-client and server are untouched.
**Approach:** A — Token-first design system rebuild, then per-page UX pass on the core loop.

---

## Goals

Keep the existing "Deep Space" identity (indigo accent, glass surfaces, orbs,
Michroma / Space Grotesk / Inter / Fira Code type stack) but execute it at
Vercel-level quality: strict tokens, one coherent surface language, restrained
purposeful motion, first-class mobile, and fast real + perceived performance.

User decisions locked during brainstorming:

| Decision | Choice |
|---|---|
| Identity | Keep space vibe; implement glassmorphism properly (Vercel as reference) |
| Scope | Core loop first (this phase); Profile/Clans/Badges/Settings/Login in Phase 2; static pages in Phase 3 |
| Motion | Restrained + purposeful; GSAP allowed where performance is not critical |
| Spotlight | Keep on all cards, optimized (single delegated listener) |
| ChallengeDetails accent | Unify to global indigo (remove dark-mode yellow override) |
| Mobile nav | Bottom tab bar for main destinations |
| Pain points in scope | Challenge browse/solve flow, information density, mobile, perceived speed |

## Audit findings this design fixes

1. Card hover styles are set imperatively from JS (`Card.jsx` mutates
   `style.border` / `boxShadow` / `background` in mouseenter handlers).
2. Radius/shadow/border values re-invented inline per page (12 radius variants
   in Dashboard alone) despite a token scale existing in `:root`.
3. One-off hacks in `index.css`: `!important` social colors, transparent
   text-selection tricks, `challenge-details-theme` yellow accent override,
   infinite podium glow keyframes.
4. Decorative motion on data (staggered `delay: i * 0.05` entrances).
5. 23 `backdrop-blur` usages, most on cards over a static background where the
   effect is invisible but the paint cost is real.
6. Five simultaneous hover effects per card (spotlight, shimmer, blueprint
   corners, gradient fill, lift).
7. `getRGB()` difficulty-color helper copy-pasted across pages.

---

## Section 1 — Token layer rebuild (`client/src/index.css` + `tailwind.config`)

The `:root` block becomes the single source of truth.

- **Radius scale (4 values, mapped into Tailwind theme):**
  `--radius-sm` 8px (inputs, chips), `--radius-md` 12px (buttons),
  `--radius-lg` 16px (cards and all grid/list items), `--radius-xl` 24px
  (hero surfaces, modals). All ad-hoc `rounded-[2rem]` / `rounded-3xl`
  usage in Phase-1 files migrates to these.
- **Surface tokens:**
  - `--surface-1` — standard card fill: translucent solid, **no backdrop-blur**.
  - `--surface-2` — nested/inset areas (code examples, table headers).
  - `--surface-overlay` — navbar, dropdowns, modals, bottom tab bar. The
    **only** surfaces that use `backdrop-blur`, because content actually
    scrolls behind them.
- **Border tokens:** `--border-subtle`, `--border-strong`, and
  `--edge-highlight` — a 1px top catch-light gradient that conveys "glass"
  via border + light instead of filter cost.
- **Semantic difficulty tokens:** `--diff-easy`, `--diff-medium`, `--diff-hard`
  RGB triplets defined once; a single JS export in `client/src/constants/`
  replaces the copy-pasted `getRGB()` helpers.
- **Deletions:** transparent-selection hack, `challenge-details-theme`
  override, `!important` social hover colors (restyled properly in Footer),
  `golden-glow` / `trophy-gold-glow` infinite keyframes (replaced by a static
  gold treatment in Leaderboard).
- **Kept as-is:** font family variables and imports, light/dark palettes,
  gradient `h1` page-title treatment, orb keyframes (Home/Login only).

## Section 2 — Surface system + Card rework

`client/src/components/Card.jsx` is rewritten as a pure-CSS component:

- All hover styling (accent/difficulty border tint, elevation, spotlight)
  moves to CSS classes driven by tokens. All imperative style mutations and
  per-card mouse handlers are deleted.
- Difficulty color arrives as a CSS custom property (`--card-accent-rgb`)
  set once via the `style` prop, not via JS event handlers.
- Hover is exactly three coordinated effects: border tint → spotlight →
  1px lift. Shimmer line and blueprint corners are retired.

**Spotlight (optimized, app-wide):** new `client/src/lib/spotlight.js`
installs ONE rAF-throttled `pointermove` listener on `document`. On move it
finds `event.target.closest('[data-spotlight]')` and writes
`--mouse-x` / `--mouse-y` custom properties on that element only. Cards opt in
with `data-spotlight`. The gradient itself is a CSS pseudo-element reading
those variables. Zero per-card JS, zero React re-renders, effect disabled on
touch devices (no hover) and under `prefers-reduced-motion`.

## Section 3 — Motion system

New `client/src/lib/motion.js` exporting:

- Duration tokens: `fast` 0.15s, `base` 0.22s, `slow` 0.32s; one ease family.
- Shared variants: `pageEnter` (single fade + 6px rise on the page container),
  and micro-interaction presets.

Rules enforced across Phase-1 pages:

- `<MotionConfig reducedMotion="user">` wraps the app in `App.jsx`.
- No per-item entrance staggers on data pages.
- Infinite/ambient animation only on Home (and Login when Phase 2 touches it).
- **GSAP:** lazy-loaded (dynamic import) on Home only, for one
  scroll-choreographed hero/section-reveal sequence, guarded by
  `prefers-reduced-motion`. GSAP must not appear in the shared bundle.

## Section 4 — Shared components

- **Navbar:** stays top-fixed; becomes a proper `--surface-overlay`; active
  nav item gets a clean underline indicator (Framer Motion `layoutId`);
  user dropdown restyled to tokens.
- **BottomTabBar (new component):** rendered on `<768px` viewports.
  Tabs: Dashboard, Missions, Leaderboard, Profile. Fixed bottom, overlay
  glass, `env(safe-area-inset-bottom)` padding, ≥44px touch targets, active
  indicator. The hamburger drawer keeps only secondary destinations
  (Archives, Clan, Chief Panel, Settings, logout). Layout adds matching
  bottom padding on mobile so content never hides behind the bar.
- **PageHeader, EmptyState, SkeletonCard, buttons/chips/segmented controls:**
  restyled to tokens. Skeletons mirror final layout dimensions exactly —
  zero layout shift when data arrives.

## Section 5 — Home

- Hero hierarchy: display title, one-line value proposition, primary CTA
  ("Browse challenges") + secondary CTA ("Leaderboard"), live stats row.
- Grid + orbs ambient background stays.
- The GSAP scroll-choreographed reveal sequence lives here (see Section 3).
- Below-fold sections (how it works, top clans, recent activity) become
  scannable with consistent section rhythm.

## Section 6 — Missions (challenge browse)

- **List-first layout:** LeetCode-style rows — status icon (solved /
  attempted / draft / unattempted), title, difficulty pill, points, category
  tag. Existing grid view remains as a toggle.
- **Sticky compact filter bar:** debounced (≈250ms) search, difficulty chips,
  category + set selects, visible active-filter count with one-tap clear.
- Solved/attempted state computed from user submissions + local drafts
  (logic already exists; it gets surfaced per row).
- Mobile: rows collapse to two-line cards; filter bar horizontally scrollable.
- Empty state offers "clear filters" action.

## Section 7 — ChallengeDetails (solve page)

- Accent unified to global indigo (yellow dark-mode override removed).
- Desktop: two-pane problem/editor layout with a sticky header carrying
  title, difficulty, points, submission status, and the submit action.
- Mobile: segmented Problem/Code switcher + sticky bottom submit bar.
- The 1,581-line file is split into a `client/src/components/challenge/`
  folder (matching the project's feature-folder convention): ProblemPanel,
  EditorPanel, SubmitBar,
  SubmissionsList, and supporting pieces. Exact decomposition is verified
  against the real file structure at planning time — behavior is preserved;
  this is a presentational refactor.

## Section 8 — Dashboard

- Hierarchy rework: greeting + ONE primary "Continue" card (latest draft or
  pending submission) at top, compact 4-stat tile row, then two columns:
  recent activity feed + clan snapshot. Activity heatmap stays.
- All entrance staggers removed; single `pageEnter` on the container.

## Section 9 — Leaderboard

- Podium kept but calm: static gold accent treatment replaces the infinite
  pulse animations.
- Table: sticky header, row hover, current-user row visually highlighted,
  segmented clan/individual control.
- Mobile: card rows instead of a squeezed table.

## Section 10 — Perceived speed

- React Query: sensible `staleTime` per query; `placeholderData:
  keepPreviousData` on filtered/paginated lists so they never flash to
  skeleton on filter change.
- Prefetch challenge details on row hover/focus via
  `queryClient.prefetchQuery`.
- Dimension-stable skeletons and fixed header heights (no CLS).
- Blur diet from Section 1 reduces paint cost on scroll.

## Section 11 — Verification

Per page and at the end of the phase:

1. `cd client && npm run lint` — clean.
2. `cd client && npm run build` — succeeds; confirm GSAP and Three.js are not
   in the initial chunk (build output inspection).
3. Browser preview at 1280px and 375px, light and dark themes, with
   screenshots of every reworked page.
4. Server integration tests untouched (no API changes in this phase).

## Out of scope

- Phase 2: Profile, Clans, Badges, Settings, Login, ClaimUsername.
- Phase 3: static/legal pages (About, Contact, Terms, Privacy), NotFound.
- Admin-client entirely.
- Any server/API change.
- PixelBlast visual effect internals (already lazy-loaded by the previous
  perf spec).

## Files expected to change (Phase 1)

| Area | Files |
|---|---|
| Tokens | `client/src/index.css`, `client/tailwind.config.js` |
| Surface/Card | `client/src/components/Card.jsx`, `client/src/lib/spotlight.js` (new) |
| Motion | `client/src/lib/motion.js` (new), `client/src/App.jsx` (MotionConfig) |
| Shared | `Navbar.jsx`, `BottomTabBar.jsx` (new), `Layout.jsx`, `PageHeader.jsx`, `EmptyState.jsx`, `SkeletonCard.jsx`, `Footer.jsx` (social hover fix) |
| Constants | `client/src/constants/` difficulty color export |
| Pages | `Home.jsx`, `Missions.jsx`, `ChallengeDetails.jsx` (split into folder), `Dashboard.jsx`, `Leaderboard.jsx` |
