# Client UI/UX Overhaul Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the participant client's design system (tokens, glass surfaces, spotlight, motion) and rework the five core-loop pages (Home, Missions, ChallengeDetails, Dashboard, Leaderboard) per the approved spec at `docs/superpowers/specs/2026-07-10-client-ui-ux-overhaul-phase1-design.md`.

**Architecture:** Token-first: Tasks 1–7 establish CSS tokens, a pure-CSS card/spotlight system, a motion module, and shared chrome (Navbar polish, new BottomTabBar). Tasks 8–12 rework pages on top of that system. Tasks 13–14 tune perceived speed and verify.

**Tech Stack:** React 19, Vite, Tailwind CSS 3 (CSS-variable driven), Framer Motion 12, TanStack React Query 5, GSAP (added in Task 12, lazy-loaded, Home only).

## Global Constraints

- Scope is `client/` only. No server, no admin-client, no API changes.
- Keep the deep-space identity: existing font stack, light/dark palettes, gradient `h1`, orbs on Home/Login. Do not change font variables.
- `backdrop-filter` is allowed ONLY on `--surface-overlay` elements (navbar, dropdowns, modals, bottom tab bar). Cards must not use `backdrop-blur`.
- Motion rules: durations from `lib/motion.js` only; no per-item entrance staggers on data pages; infinite animation only on Home; everything respects `prefers-reduced-motion`.
- ChallengeDetails accent unifies to global indigo (the yellow dark-mode override is deleted).
- GSAP must never appear in the initial/shared bundle — dynamic import inside Home only.
- The client has no unit-test runner. Each task's test cycle is: `cd client && npm run lint` → `npm run build` → visual verification in the dev server (both themes, 1280px and 375px where UI changed). Do not claim a task done without running these.
- Preserve all existing behavior (routing, data fetching, submission logic). This is a presentational overhaul; logic changes are limited to what tasks explicitly state.
- Commit after every task with the message given in the task.

---

### Task 1: Token layer + surface CSS

**Files:**
- Modify: `client/src/index.css` (token blocks at top; component classes; deletions)
- Modify: `client/tailwind.config.js`

**Interfaces:**
- Produces CSS classes used by all later tasks: `.surface-card`, `.card-static`, `.surface-overlay`, `.surface-inset`
- Produces CSS variables: `--surface-1`, `--surface-2`, `--surface-overlay`, `--border-subtle`, `--border-strong`, `--edge-highlight`, `--diff-easy`, `--diff-medium`, `--diff-hard`, `--radius-{sm,md,lg,xl}` (xl changes 1.25rem → 1.5rem)
- Produces Tailwind utilities: `border-subtle`, `border-strong`, `bg-surface-1`, `bg-surface-2`, `text-*`/`bg-accent` (existing, kept)

- [ ] **Step 1: Add new tokens to `:root` in `client/src/index.css`**

Inside the existing `:root` block, change `--radius-xl: 1.25rem;` to `--radius-xl: 1.5rem;` and add after the radius definitions:

```css
    /* Surfaces (glass without blur — translucent fill + border + catch-light) */
    --surface-1: rgba(255, 255, 255, 0.66);
    --surface-2: rgba(15, 23, 42, 0.04);
    --surface-overlay: rgba(255, 255, 255, 0.82);

    /* Borders */
    --border-subtle: rgba(15, 23, 42, 0.08);
    --border-strong: rgba(15, 23, 42, 0.16);
    --edge-highlight: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);

    /* Difficulty (single source of truth, RGB triplets) */
    --diff-easy: 34, 197, 94;
    --diff-medium: 234, 179, 8;
    --diff-hard: 239, 68, 68;
```

And inside the existing `[data-theme="dark"]` block add:

```css
    --surface-1: rgba(20, 22, 31, 0.62);
    --surface-2: rgba(255, 255, 255, 0.045);
    --surface-overlay: rgba(10, 10, 15, 0.78);
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.16);
    --edge-highlight: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent);
```

- [ ] **Step 2: Add surface component classes**

Add to the `@layer components` block in `index.css`:

```css
    /* ── Surface system ─────────────────────────────────────── */
    .surface-card {
        position: relative;
        background: var(--surface-1);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        transition:
            border-color 0.22s ease,
            transform 0.22s ease,
            box-shadow 0.22s ease;
    }

    /* Top catch-light: the "glass" read, no filter cost */
    .surface-card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 12px;
        right: 12px;
        height: 1px;
        background: var(--edge-highlight);
        opacity: 0.8;
        pointer-events: none;
    }

    /* Spotlight — coordinates written by lib/spotlight.js */
    .surface-card[data-spotlight]::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(480px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                rgba(var(--card-accent-rgb, var(--accent-rgb)), 0.12),
                transparent 40%);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    @media (hover: hover) {
        .surface-card:not(.card-static):hover {
            border-color: rgba(var(--card-accent-rgb, var(--accent-rgb)), 0.45);
            transform: translateY(-1px);
            box-shadow:
                0 0 0 0.5px rgba(var(--card-accent-rgb, var(--accent-rgb)), 0.18),
                0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .surface-card[data-spotlight]:not(.card-static):hover::after {
            opacity: 1;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .surface-card[data-spotlight]::after {
            display: none;
        }
    }

    /* Overlay surfaces — the ONLY place backdrop-filter is allowed */
    .surface-overlay {
        background: var(--surface-overlay);
        backdrop-filter: blur(12px) saturate(140%);
        -webkit-backdrop-filter: blur(12px) saturate(140%);
        border: 1px solid var(--border-subtle);
    }

    /* Inset/nested areas (code examples, table heads) */
    .surface-inset {
        background: var(--surface-2);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
    }
```

- [ ] **Step 3: Delete the one-off hacks from `index.css`**

Remove these blocks entirely (exact selectors):
1. `.leetcode-description::selection, ...` and the `[data-theme="dark"] .leetcode-description::selection, ...` blocks (the transparent-selection hack). Native selection styling returns.
2. `.challenge-details-theme` and `[data-theme="dark"] .challenge-details-theme` (accent unification — ChallengeDetails stops using this class in Task 9; deleting the CSS first is safe because the class then simply matches nothing).
3. `@keyframes golden-glow`, `.podium-gold-glow`, `@keyframes trophy-gold-glow`, `.podium-trophy-gold` (Leaderboard Task 11 replaces usage with static classes — grep for `podium-gold-glow|podium-trophy-gold` in `client/src` first; if still referenced, leave the classes in place and note it for Task 11, then delete in Task 11 instead).
4. `.social-icon`, `.social-whatsapp:hover`, `.social-instagram:hover`, `.social-linkedin:hover` (`!important` rules — Footer is restyled in Task 6; same grep-first rule as above: if `Footer.jsx` still references these classes, delete this CSS as part of Task 6 instead).
5. `.macos-glass` — keep for now (Phase-2 pages use it), but change its `backdrop-filter: blur(4px) saturate(120%)` line and the `-webkit-` twin to `background: var(--surface-1);` semantics by replacing the whole rule body with:

```css
.macos-glass {
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--glass-shadow);
    border-radius: var(--radius-lg);
}
```

- [ ] **Step 4: Map tokens into Tailwind**

In `client/tailwind.config.js` `theme.extend`, add:

```js
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        strong: "var(--border-strong)",
      },
```

and inside the existing `colors` object add:

```js
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          overlay: "var(--surface-overlay)",
        },
```

- [ ] **Step 5: Verify**

Run: `cd client && npm run lint && npm run build`
Expected: both succeed. Then `npm run dev`, load the app in both themes: pages still render (cards using `.macos-glass` now show the new solid-translucent surface; no visual breakage).

- [ ] **Step 6: Commit**

```bash
git add client/src/index.css client/tailwind.config.js
git commit -m "feat(client): rebuild design token layer and surface system"
```

---

### Task 2: Difficulty color constants module

**Files:**
- Create: `client/src/constants/difficulty.js`

**Interfaces:**
- Produces: `DIFFICULTY_RGB` (object: `{ Easy: "34, 197, 94", Medium: "234, 179, 8", Hard: "239, 68, 68" }`), `getDifficultyRGB(difficulty) -> string` (falls back to `"99, 102, 241"`), `DIFFICULTY_ORDER` (`{ Easy: 1, Medium: 2, Hard: 3 }`). Tasks 8–12 import these and delete their local `getRGB`/`DIFF_ORDER` copies.

- [ ] **Step 1: Create the module**

```js
// client/src/constants/difficulty.js
// Single source of truth for difficulty colors. Values mirror the
// --diff-easy/--diff-medium/--diff-hard CSS variables in index.css.

export const DIFFICULTY_RGB = {
  Easy: "34, 197, 94",
  Medium: "234, 179, 8",
  Hard: "239, 68, 68",
};

export const DIFFICULTY_ORDER = { Easy: 1, Medium: 2, Hard: 3 };

export const getDifficultyRGB = (difficulty) =>
  DIFFICULTY_RGB[difficulty] || "99, 102, 241";
```

- [ ] **Step 2: Verify + commit**

Run: `cd client && npm run lint`
Expected: clean.

```bash
git add client/src/constants/difficulty.js
git commit -m "feat(client): add shared difficulty color constants"
```

---

### Task 3: Motion module + MotionConfig + calmer page transition

**Files:**
- Create: `client/src/lib/motion.js`
- Modify: `client/src/App.jsx` (wrap routes with `MotionConfig`)
- Modify: `client/src/components/Layout.jsx` (page transition uses shared tokens)

**Interfaces:**
- Produces: `DUR` (`{ fast: 0.15, base: 0.22, slow: 0.32 }`), `EASE` (`[0.32, 0.72, 0, 1]`), `pageEnter` (Framer Motion props object with `initial/animate/exit/transition`), `fadeIn` (same shape, opacity only). Page tasks import these.

- [ ] **Step 1: Create `client/src/lib/motion.js`**

```js
// Motion tokens. Every Framer Motion duration/ease in the app comes from
// here — no ad-hoc timing values in components.

export const DUR = { fast: 0.15, base: 0.22, slow: 0.32 };
export const EASE = [0.32, 0.72, 0, 1];

// One page-level entrance. Applied to the page container only —
// never to individual cards/rows.
export const pageEnter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.base, ease: EASE },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DUR.base, ease: EASE },
};
```

- [ ] **Step 2: Wrap the app in `MotionConfig`**

In `client/src/App.jsx`: `import { MotionConfig } from 'framer-motion';` and wrap the JSX returned by `App` (the outer `<div className="app-container">`) with `<MotionConfig reducedMotion="user"> ... </MotionConfig>`.

- [ ] **Step 3: Use `pageEnter` in Layout**

In `client/src/components/Layout.jsx`, import `{ pageEnter }` from `../lib/motion` and replace the `MotionContainer` props

```jsx
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -10 }}
transition={{ duration: 0.28, ease: "easeOut" }}
```

with `{...pageEnter}`.

- [ ] **Step 4: Verify + commit**

Run: `cd client && npm run lint && npm run build`
Expected: clean. Dev server: route changes still cross-fade, slightly snappier.

```bash
git add client/src/lib/motion.js client/src/App.jsx client/src/components/Layout.jsx
git commit -m "feat(client): add motion token module and MotionConfig"
```

---

### Task 4: Delegated spotlight module

**Files:**
- Create: `client/src/lib/spotlight.js`
- Modify: `client/src/App.jsx` (init on mount)

**Interfaces:**
- Produces: `initSpotlight() -> cleanupFn`. One document-level rAF-throttled `pointermove` listener writing `--mouse-x`/`--mouse-y` onto the nearest `[data-spotlight]` ancestor of the pointer target. Card (Task 5) and any surface opt in via the `data-spotlight` attribute.

- [ ] **Step 1: Create `client/src/lib/spotlight.js`**

```js
// One delegated, rAF-throttled listener powers every card spotlight.
// Cards opt in with a `data-spotlight` attribute; the gradient itself
// lives in CSS (.surface-card[data-spotlight]::after in index.css).

let rafId = null;
let lastEvent = null;

const update = () => {
  rafId = null;
  const target = lastEvent.target;
  const el =
    target instanceof Element ? target.closest("[data-spotlight]") : null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mouse-x", `${lastEvent.clientX - rect.left}px`);
  el.style.setProperty("--mouse-y", `${lastEvent.clientY - rect.top}px`);
};

export function initSpotlight() {
  // No hover, no spotlight (touch devices); reduced motion opts out too.
  if (
    window.matchMedia("(hover: none)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {};
  }

  const onMove = (e) => {
    lastEvent = e;
    if (rafId == null) rafId = requestAnimationFrame(update);
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onMove);
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
```

- [ ] **Step 2: Initialize in `App.jsx`**

```jsx
import { initSpotlight } from './lib/spotlight';
// inside App():
React.useEffect(() => initSpotlight(), []);
```

- [ ] **Step 3: Verify + commit**

Run: `cd client && npm run lint && npm run build`
Expected: clean (spotlight has no visible consumers until Task 5).

```bash
git add client/src/lib/spotlight.js client/src/App.jsx
git commit -m "feat(client): add delegated rAF spotlight engine"
```

---

### Task 5: Card rewrite (pure CSS)

**Files:**
- Modify: `client/src/components/Card.jsx` (full rewrite below)

**Interfaces:**
- Consumes: `.surface-card` CSS (Task 1), spotlight engine (Task 4).
- Produces: same import surface as today — default export, props `{ children, className, innerClassName, hoverEffect = true, difficultyColor }`. Every existing call site keeps working unmodified. `difficultyColor` is still an RGB string like `"34, 197, 94"`.

- [ ] **Step 1: Replace the entire file**

```jsx
import React from "react";
import { clsx } from "clsx";

// Glass card. All hover behavior (border tint, lift, spotlight) is CSS —
// see .surface-card in index.css. The spotlight coordinates come from the
// single delegated listener in lib/spotlight.js via data-spotlight.
const Card = ({
  children,
  className,
  innerClassName,
  hoverEffect = true,
  // RGB string like "34, 197, 94" for difficulty-tinted hover.
  // Omit for generic cards — they use the theme accent.
  difficultyColor,
}) => (
  <div
    data-spotlight={hoverEffect ? "" : undefined}
    style={difficultyColor ? { "--card-accent-rgb": difficultyColor } : undefined}
    className={clsx(
      "surface-card overflow-hidden p-6",
      !hoverEffect && "card-static",
      className,
    )}
  >
    <div className={clsx("relative z-10", innerClassName)}>{children}</div>
  </div>
);

export default Card;
```

- [ ] **Step 2: Verify**

Run: `cd client && npm run lint && npm run build`, then dev server. Check Missions/Dashboard/Home cards in both themes: translucent solid fill, top catch-light, hover = border tint + spotlight + 1px lift, difficulty-colored hover on challenge cards, no shimmer/corners. Mouse spotlight follows the cursor (Task 4 engine).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Card.jsx
git commit -m "refactor(client): rewrite Card as pure-CSS surface with delegated spotlight"
```

---

### Task 6: Shared component restyle (EmptyState, SkeletonCard, PageHeader, Footer)

**Files:**
- Modify: `client/src/components/EmptyState.jsx` (full rewrite below)
- Modify: `client/src/components/SkeletonCard.jsx` (full rewrite below)
- Modify: `client/src/components/PageHeader.jsx` (border/radius token migration)
- Modify: `client/src/components/Footer.jsx` (social hover without `!important`)
- Modify: `client/src/index.css` (delete `.social-*` CSS if deferred from Task 1)

**Interfaces:**
- Produces: `EmptyState` gains optional `icon` prop (react-icons component). `SkeletonCard` gains `variant` prop: `"card"` (default) | `"row"` | `"stat"`. Page tasks use these variants for dimension-stable loading states.

- [ ] **Step 1: Rewrite `EmptyState.jsx`**

```jsx
import React from 'react';
import { FiInbox } from 'react-icons/fi';

const EmptyState = ({ title, description, actionLabel, onAction, icon: Icon = FiInbox }) => {
  return (
    <div className="surface-card card-static p-8 text-center">
      <div className="mx-auto mb-4 w-12 h-12 rounded-md bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-secondary mb-6 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-md bg-accent text-white font-medium transition-transform active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
```

- [ ] **Step 2: Rewrite `SkeletonCard.jsx` with dimension-stable variants**

```jsx
import React from 'react';

const shimmer = 'animate-pulse bg-black/10 dark:bg-white/10 rounded';

// Variants mirror the real component dimensions so content swap causes
// zero layout shift. "card" ≈ Card p-6, "row" ≈ challenge list row,
// "stat" ≈ dashboard stat tile.
const SkeletonCard = ({ className = '', variant = 'card' }) => {
  if (variant === 'row') {
    return (
      <div className={`surface-card card-static flex items-center gap-4 px-4 py-3 min-h-[56px] ${className}`}>
        <div className={`${shimmer} w-5 h-5 rounded-full shrink-0`} />
        <div className={`${shimmer} h-4 flex-1 max-w-[45%]`} />
        <div className={`${shimmer} h-5 w-16 rounded-full ml-auto`} />
        <div className={`${shimmer} h-4 w-10`} />
      </div>
    );
  }
  if (variant === 'stat') {
    return (
      <div className={`surface-card card-static p-4 min-h-[88px] ${className}`}>
        <div className={`${shimmer} h-3 w-1/2 mb-3`} />
        <div className={`${shimmer} h-6 w-1/3`} />
      </div>
    );
  }
  return (
    <div className={`surface-card card-static p-6 ${className}`}>
      <div className={`${shimmer} h-4 w-1/3 mb-4`} />
      <div className={`${shimmer} h-3 w-full mb-2`} />
      <div className={`${shimmer} h-3 w-5/6 mb-2`} />
      <div className={`${shimmer} h-3 w-2/3`} />
    </div>
  );
};

export default SkeletonCard;
```

- [ ] **Step 3: Token-align `PageHeader.jsx`**

In the back button's className replace `rounded-xl border border-black/10 dark:border-white/10` with `rounded-md border border-subtle` and the header wrapper's `border-b border-black/[0.08] dark:border-white/10` with `border-b border-subtle`. No structural changes.

- [ ] **Step 4: Footer social hover without `!important`**

Read `client/src/components/Footer.jsx`, find the social icon links (classes `social-icon social-whatsapp` etc.). Replace those CSS-class hooks with per-link Tailwind classes, e.g. for WhatsApp:

```jsx
className="... border border-subtle text-secondary transition-colors hover:text-[#25D366] hover:border-[#25D366] hover:bg-[#25D366]/10"
```

(same pattern for Instagram `#E1306C` and LinkedIn `#0077B5`). Then delete the `.social-icon` / `.social-whatsapp` / `.social-instagram` / `.social-linkedin` rules from `index.css` if Task 1 deferred them.

- [ ] **Step 5: Verify + commit**

Run: `cd client && npm run lint && npm run build`; dev server: check footer hover colors, an empty state (e.g. Missions with impossible filter), skeletons on hard reload.

```bash
git add client/src/components/EmptyState.jsx client/src/components/SkeletonCard.jsx client/src/components/PageHeader.jsx client/src/components/Footer.jsx client/src/index.css
git commit -m "refactor(client): restyle shared components to token system"
```

---

### Task 7: Navbar polish + BottomTabBar + Layout integration

**Files:**
- Create: `client/src/components/BottomTabBar.jsx` (full code below)
- Modify: `client/src/components/Navbar.jsx` (overlay surface + active underline)
- Modify: `client/src/components/Layout.jsx` (render tab bar, mobile bottom padding)
- Modify: `client/src/App.jsx` (ThemeToggle position clears the tab bar)

**Interfaces:**
- Consumes: `.surface-overlay` (Task 1).
- Produces: `<BottomTabBar />` — no props, self-hiding at `md:` and up.

- [ ] **Step 1: Create `BottomTabBar.jsx`**

```jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FiGrid, FiTarget, FiAward, FiUser } from "react-icons/fi";
import { clsx } from "clsx";

const TABS = [
  { name: "Dashboard", path: "/dashboard", icon: FiGrid },
  { name: "Missions", path: "/missions", icon: FiTarget },
  { name: "Ranks", path: "/leaderboard", icon: FiAward },
  { name: "Profile", path: "/profile", icon: FiUser },
];

// Mobile-only primary navigation. Secondary destinations stay in the
// Navbar hamburger drawer.
const BottomTabBar = () => {
  const location = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 surface-overlay border-t border-subtle"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ name, path, icon: Icon }) => {
          const isActive =
            path === "/profile"
              ? location.pathname === "/profile"
              : location.pathname.startsWith(path);
          return (
            <li key={path}>
              <NavLink
                to={path}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2 min-h-[52px] text-[0.68rem] font-semibold transition-colors",
                  isActive ? "text-accent" : "text-secondary",
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                <span>{name}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomTabBar;
```

- [ ] **Step 2: Navbar becomes an overlay surface with an underline indicator**

In `Navbar.jsx`:
1. Replace the `<nav>` className `border-b border-glass-border bg-glass-surface backdrop-blur-md shadow-sm` with `surface-overlay border-x-0 border-t-0`.
2. For the desktop nav items: render each link `relative`; when `isActive`, add inside the link:

```jsx
<motion.span
  layoutId="nav-underline"
  className="absolute -bottom-[1.35rem] left-2 right-2 h-[2px] rounded-full bg-accent"
  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
/>
```

(Adjust the `-bottom` offset so the underline sits on the navbar's bottom border — verify visually.) Remove any existing active-state pill/background if one exists so the underline is the single active indicator; keep hover text-color transitions.
3. Restyle the user dropdown panel to `surface-overlay rounded-lg` and its items to token borders (`border-subtle`) — replace ad-hoc `bg-*/border-*` values.
4. The mobile hamburger drawer keeps only secondary items: remove Dashboard/Leaderboard entries from the drawer list (they're in the tab bar now) and keep Clan, Archives, Chief Panel (conditional), Settings, Logout. Desktop nav items are unchanged.

- [ ] **Step 3: Layout renders the tab bar and pads for it**

In `Layout.jsx`:
1. `import BottomTabBar from "./BottomTabBar";`
2. Next to the `<Navbar ... />` line: `{user?.usernameSet !== false && <BottomTabBar />}`
3. On the `<main>` element, change the non-full-width padding from `py-8` to `pt-8 pb-24 md:pb-8` (content must clear the fixed bar on mobile). For the full-width (challenge/submission) case change `px-0 py-0` to `px-0 pt-0 pb-16 md:pb-0`.

- [ ] **Step 4: ThemeToggle clears the tab bar**

In `App.jsx`, change the ThemeToggle wrapper from `fixed bottom-20 sm:bottom-6 right-6 z-[60]` to `fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60]` (the tab bar exists below `md`, so the toggle sits above it until `md`).

- [ ] **Step 5: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server at 375px: tab bar visible with active states, content not hidden behind it, drawer has only secondary items, theme toggle above the bar. At 1280px: no tab bar, underline indicator slides between nav items.

```bash
git add client/src/components/BottomTabBar.jsx client/src/components/Navbar.jsx client/src/components/Layout.jsx client/src/App.jsx
git commit -m "feat(client): mobile bottom tab bar + navbar overlay polish"
```

---

### Task 8: Missions — list-first browse with sticky filter bar

**Files:**
- Create: `client/src/components/challenge/ChallengeRow.jsx` (full code below)
- Modify: `client/src/pages/Missions.jsx`

**Interfaces:**
- Consumes: `getDifficultyRGB`, `DIFFICULTY_ORDER` (Task 2), `SkeletonCard variant="row"` (Task 6), Card (Task 5).
- Produces: `ChallengeRow` — props `{ challenge, status, onHover }` where `challenge` is the API challenge object (`_id`, `title`, `difficulty`, `points`, `category`), `status` is one of `"solved" | "pending" | "attempted" | "rejected" | null`, `onHover` is called on `pointerenter`/`focus` (used for prefetch). ChallengeDetails task does not depend on this.

- [ ] **Step 1: Create `ChallengeRow.jsx`**

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiClock, FiEdit3, FiXCircle, FiCircle } from "react-icons/fi";
import { clsx } from "clsx";
import { getDifficultyRGB } from "../../constants/difficulty";

const STATUS_META = {
  solved: { icon: FiCheckCircle, className: "text-green-500", label: "Solved" },
  pending: { icon: FiClock, className: "text-yellow-500", label: "In review" },
  attempted: { icon: FiEdit3, className: "text-blue-400", label: "Draft saved" },
  rejected: { icon: FiXCircle, className: "text-red-500", label: "Rejected" },
};

const ChallengeRow = ({ challenge, status, onHover }) => {
  const meta = STATUS_META[status];
  const StatusIcon = meta?.icon || FiCircle;
  const rgb = getDifficultyRGB(challenge.difficulty);

  return (
    <Link
      to={`/challenge/${challenge._id}`}
      onPointerEnter={onHover}
      onFocus={onHover}
      data-spotlight=""
      style={{ "--card-accent-rgb": rgb }}
      className="surface-card flex items-center gap-3 px-4 py-3 min-h-[56px] group"
    >
      <StatusIcon
        size={18}
        className={clsx("shrink-0", meta ? meta.className : "text-tertiary")}
        title={meta?.label || "Not attempted"}
        aria-label={meta?.label || "Not attempted"}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary truncate group-hover:text-accent transition-colors">
          {challenge.title}
        </p>
        {challenge.category && (
          <p className="text-caption text-tertiary truncate md:hidden">{challenge.category}</p>
        )}
      </div>
      {challenge.category && (
        <span className="hidden md:inline-block text-caption text-tertiary surface-inset px-2 py-0.5 rounded-sm">
          {challenge.category}
        </span>
      )}
      <span
        className="shrink-0 text-caption font-bold px-2.5 py-0.5 rounded-full"
        style={{ color: `rgb(${rgb})`, background: `rgba(${rgb}, 0.12)` }}
      >
        {challenge.difficulty}
      </span>
      <span className="shrink-0 w-14 text-right font-mono text-caption text-secondary">
        {challenge.points} XP
      </span>
    </Link>
  );
};

export default ChallengeRow;
```

- [ ] **Step 2: Rework `Missions.jsx`**

Keep all existing state, queries, filters, and draft/submission logic. Changes:

1. Import `ChallengeRow`, `getDifficultyRGB`/`DIFFICULTY_ORDER` from `../constants/difficulty` (delete the local `getRGB` and `DIFF_ORDER`), `keepPreviousData` from `@tanstack/react-query`, and `useQueryClient`.
2. On `challengesQuery`, add `placeholderData: keepPreviousData` so filter/page changes never flash to skeleton.
3. **Default view = list.** The existing `viewMode` state currently defaults from localStorage/grid; change the fallback default to `"list"`. Grid view (existing Cards) remains behind the toggle.
4. **List rendering:** where the grid currently maps challenges to `<ChallengeCard>`, add the list branch mapping to `<ChallengeRow challenge={c} status={...} onHover={...} />` in a `flex flex-col gap-2` container. Status is derived from the existing submissions map + local drafts (the page already computes card badges from `submissionsQuery` + `getLocalDrafts()` — reuse the same derivation, mapping its result to `solved/pending/attempted/rejected/null`).
5. **Prefetch on intent:**

```jsx
const queryClient = useQueryClient();
const prefetchChallenge = (id) => {
  queryClient.prefetchQuery({
    queryKey: ["challenge", id],
    queryFn: () => api.get(`/challenges/${id}`).then((r) => r.data.data),
    staleTime: 60 * 1000,
  });
};
```

Pass `onHover={() => prefetchChallenge(c._id)}`. **Important:** first check the actual queryKey/queryFn used by ChallengeDetails' `challengeQuery` (around `ChallengeDetails.jsx:414`) and copy those exactly — prefetch only helps if the key matches.
6. **Sticky filter bar:** wrap the existing search + difficulty chips + category/set selects + view toggle in
   `<div className="sticky top-16 z-30 surface-overlay rounded-lg px-3 py-2 -mx-1 flex flex-wrap items-center gap-2">` (top-16 clears the h-16 navbar). Debounce the search input by 250ms if not already debounced (local `useState` for input value + `useEffect` with `setTimeout` writing to the filter state). Show an active-filter count chip with an "✕ Clear" button calling the existing reset logic when any filter is set.
7. **Loading state:** when `challengesQuery.isLoading` (first load only), render 8× `<SkeletonCard variant="row" />` in list mode / existing card skeletons in grid mode.
8. Remove any per-card `motion.div` entrance staggers; the page container keeps the Layout-level transition only.
9. Mobile (<md): rows already collapse via the classes in ChallengeRow; ensure the filter bar wraps and the select controls take `min-w-0 flex-1`.

- [ ] **Step 3: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server: list view default with status icons, filters stick under navbar, filter changes keep previous list visible (no skeleton flash), grid toggle works, 375px layout clean, hover prefetch fires (Network tab).

```bash
git add client/src/components/challenge/ChallengeRow.jsx client/src/pages/Missions.jsx
git commit -m "feat(client): list-first Missions browse with sticky filters and prefetch"
```

---

### Task 9: ChallengeDetails — accent unification, helper extraction, panel split, mobile submit bar

**Files:**
- Create: `client/src/lib/challengeOutput.js` (pure helpers moved out)
- Create: `client/src/components/challenge/ProblemPanel.jsx`
- Create: `client/src/components/challenge/TestResultPanel.jsx`
- Modify: `client/src/pages/ChallengeDetails.jsx`

**Interfaces:**
- Consumes: motion tokens (Task 3), tokens (Task 1).
- Produces: `challengeOutput.js` exports (moved verbatim, no behavior change): `LANG_LITERALS`, `decodeHtmlEntities`, `normalizeOutput`, `displayExpected`, `tryParseJson`, `floatsClose`, `deepEqualWithTolerance`, `canonicalize`, `outputsMatch`, `formatArgForStdin`, `argsToStdin`, `b64Encode`, `b64Decode`, `defaultStarterByLanguage`. ProblemPanel/TestResultPanel are presentational extractions whose exact props are decided during extraction (all state stays in the page component; panels receive values + callbacks).

- [ ] **Step 1: Extract pure helpers**

Move `ChallengeDetails.jsx` lines ~62–238 (the constants and pure functions listed above) verbatim into `client/src/lib/challengeOutput.js` with named exports; import them back into `ChallengeDetails.jsx`. Zero logic edits — this is a cut/paste with exports.

- [ ] **Step 2: Verify extraction is behavior-neutral**

Run: `cd client && npm run lint && npm run build`. Dev server: open a challenge, run a test case, confirm run/compare output works exactly as before. Commit this step alone:

```bash
git add client/src/lib/challengeOutput.js client/src/pages/ChallengeDetails.jsx
git commit -m "refactor(client): extract pure output helpers from ChallengeDetails"
```

- [ ] **Step 3: Unify accent**

In `ChallengeDetails.jsx`, remove the `challenge-details-theme` class from the page root (grep the file for it). If Task 1 deferred deleting the CSS, delete `.challenge-details-theme` blocks from `index.css` now. Dark mode now uses global indigo.

- [ ] **Step 4: Extract ProblemPanel and TestResultPanel**

Extraction strategy (state stays in the page; panels are render-only):
1. **ProblemPanel**: the left-pane content — description tab (`leetcode-description` markup), submissions-history tab, hints/manual content, and the `leftTab` tab strip. Props: the values/setters it renders (`challenge`, `leftTab`, `setLeftTab`, `historyQuery` data, etc. — read the JSX and pass exactly what it references).
2. **TestResultPanel**: the bottom editor panel (the `{/* ── Test / Result Panel ── */}` region, ~lines 1155–1400): test-case selector, stdin input, run output/result tabs, collapse handle. Same props approach.
3. While extracting, migrate the touched JSX to tokens: `rounded-*` ad-hoc values → `rounded-md`/`rounded-lg`, inline border colors → `border-subtle`, panel backgrounds → `surface-inset` where nested. Do NOT restyle the Monaco/CodeMirror editor internals.
4. The resizable-pane logic (`leftWidth`, `bottomHeight`, maximize) stays in the page component untouched.

- [ ] **Step 5: Sticky header + mobile submit bar**

1. Desktop sticky header: the existing title bar above the panes gets `sticky top-16 z-30 surface-overlay` and must contain: back link, title, difficulty pill (colors from `getDifficultyRGB`), points, submission status chip, and the Submit button (move/duplicate the existing submit trigger here if it currently lives lower; single source of truth for the submit handler stays in the page).
2. Mobile (`<lg`, where the existing `mobileTab` state switches Problem/Code): add a fixed bottom action bar

```jsx
<div className="lg:hidden fixed bottom-0 inset-x-0 z-40 surface-overlay border-t border-subtle px-4 py-3 flex items-center gap-3"
     style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
  {/* segmented Problem/Code switcher bound to existing mobileTab state */}
  {/* existing Run + Submit buttons, full-width */}
</div>
```

Bind the segmented control to the existing `mobileTab` state and reuse the existing run/submit handlers. Note: Layout already adds `pb-16 md:pb-0` for full-width routes (Task 7); confirm content clears this bar, adjust that padding if the bar is taller.
3. BottomTabBar (Task 7) also renders on this route below `md` — this action bar must sit above it visually: give the action bar `bottom-[52px]` adjustment or (preferred, simpler) hide the BottomTabBar on `/challenge/` and `/submission/` routes by early-returning `null` in `BottomTabBar` when `location.pathname.startsWith("/challenge/") || location.pathname.startsWith("/submission/")`. Do the preferred option.

- [ ] **Step 6: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server, both themes: dark mode is indigo (no yellow), desktop panes resize as before, run + submit flows work, submissions history renders, 375px: Problem/Code switcher + sticky action bar work, tab bar hidden on this route.

```bash
git add client/src/components/challenge/ client/src/pages/ChallengeDetails.jsx client/src/components/BottomTabBar.jsx client/src/index.css
git commit -m "feat(client): ChallengeDetails accent unification, panel split, mobile submit bar"
```

---

### Task 10: Dashboard — hierarchy rework

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: Card (Task 5), SkeletonCard variants (Task 6), `getDifficultyRGB`/`DIFFICULTY_ORDER` (Task 2), motion tokens (Task 3).

- [ ] **Step 1: Remove decorative motion**

Delete the `fd(d)` stagger helper (line ~341) and every `delay:` usage (e.g. `transition={{ delay: i * 0.05 }}` at ~line 1115). Replace per-section `motion.div` entrances with plain `div`s — the Layout `pageEnter` covers the page. Keep only interaction-driven motion (hover states, the existing carousel's slide mechanics if it has them).

- [ ] **Step 2: Restructure the top of the page**

Current order: Warning → Greeting → Hero Carousel → Stat bar → Two-column. New order and treatment:
1. **Greeting** stays first (compact, one line + subline).
2. **"Continue" card** (new, replaces the hero carousel as the primary element): one prominent `Card` showing the user's most recent local draft (from the existing `getLocalDrafts()`) or most recent pending submission (from `mySubmissionsQ`), with title, difficulty pill, "Continue solving →" CTA linking to `/challenge/:id`. If neither exists, show the active set's featured/first unsolved challenge with "Start a mission →". Reuse the existing derivation logic already computing card badges/deadline nudges — do not add new queries.
3. **Deadline nudge** (existing `getDeadlineNudge` output) renders as a slim banner chip inside/below the Continue card, not a separate section.
4. **Stat bar**: keep the existing 4 stats but compact: `grid grid-cols-2 md:grid-cols-4 gap-3`, each a `Card` `p-4` with label (text-caption text-tertiary uppercase) + value (font-mono text-xl). Loading = 4× `<SkeletonCard variant="stat" />`.
5. **The hero carousel region**: fold its content into the two-column "Missions" column as a simple list (its data is already fetched). Delete carousel-specific chrome (arrows/dots/auto-advance) — verify by reading the carousel JSX (~line 691) what data it shows and preserve that data as list items.
6. **Two-column section** stays: Missions list + Recent Activity (heatmap stays). Activity items lose entrance staggers (step 1).

- [ ] **Step 3: Token migration**

In this file replace: `rounded-[2rem]`/`rounded-3xl`/`rounded-2xl` → `rounded-lg` (cards) or `rounded-xl` (the Continue card), ad-hoc `border-white/10`-style values → `border-subtle`, ad-hoc glass backgrounds → `surface-card`/`surface-inset` classes. Replace local `getRGB`/`DIFF_ORDER` with imports from `../constants/difficulty`.

- [ ] **Step 4: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server both themes + 375px: Continue card shows correct target (test with a saved draft), stats compact, no entrance staggers, heatmap intact.

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat(client): dashboard hierarchy rework with Continue card"
```

---

### Task 11: Leaderboard — calm podium + readable table

**Files:**
- Modify: `client/src/pages/Leaderboard.jsx`
- Modify: `client/src/index.css` (delete podium keyframes if deferred from Task 1)

**Interfaces:**
- Consumes: tokens (Task 1), Card (Task 5).

- [ ] **Step 1: Static gold treatment**

In `Leaderboard.jsx` replace `podium-gold-glow` with static classes: `border-yellow-400/60 shadow-[0_0_24px_rgba(250,204,21,0.35)]` and `podium-trophy-gold` with `text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]`. Then delete the `golden-glow`/`trophy-gold-glow` keyframes and `.podium-gold-glow`/`.podium-trophy-gold` rules from `index.css` (if Task 1 deferred it).

- [ ] **Step 2: Table readability**

1. Sticky header: on the `<thead>` row apply `sticky top-16 z-20 surface-overlay` (verify against the actual table markup; if the table lives inside a Card with its own scroll container, stick to that container instead with `top-0`).
2. Current-user row: the page already computes `isMyRow` (see `getRankStyles`); ensure the row gets `bg-accent/10 border-l-2 border-l-accent` and keep any existing "jump to my rank" affordance.
3. Row hover: `hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors`.
4. Remove `MotionRow` entrance animations on table rows (replace `motion.tr` with `tr`); keep the clan/individual segmented control's existing behavior.

- [ ] **Step 3: Mobile card rows**

Below `md`, render the ranking as stacked rows instead of the table: rank badge, avatar/name, points — reuse the existing row data mapping in a `md:hidden` list of `surface-card card-static px-4 py-3` items, and hide the `<table>` with `hidden md:table`. (If the page already has a mobile fallback, upgrade it to these surfaces instead of adding a second one.)

- [ ] **Step 4: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server: podium calm (no pulsing), sticky header while scrolling, my-row highlighted, 375px shows card rows.

```bash
git add client/src/pages/Leaderboard.jsx client/src/index.css
git commit -m "feat(client): calm leaderboard podium and readable table"
```

---

### Task 12: Home — hierarchy + GSAP scroll reveal

**Files:**
- Modify: `client/package.json` (add `gsap`)
- Modify: `client/src/pages/Home.jsx`

**Interfaces:**
- Consumes: Card (Task 5), motion tokens (Task 3), `getDifficultyRGB` (Task 2).
- Constraint: GSAP loads via dynamic `import()` inside a `useEffect` in Home only. Confirm via build output that gsap lands in Home's chunk (or its own), never the entry chunk.

- [ ] **Step 1: Install GSAP**

Run: `cd client && npm install gsap`
Expected: added to `dependencies`.

- [ ] **Step 2: Hero hierarchy**

Consult the `frontend-design:frontend-design` and `gsap-react` skills before this step. In `Home.jsx`:
1. Keep `GridBackground`, orbs, and floating snippets (identity elements) but cap floating snippets at 4 concurrently rendered.
2. Hero: one display headline (existing gradient treatment), one-line value proposition under it, then exactly two CTAs — primary `Browse challenges` → `/missions` (filled accent button), secondary `Leaderboard` → `/leaderboard` (outline). Remove the CTA shimmer overlay (`{/* Shimmer */}` block ~line 541).
3. Stats row (existing `StatPill`s) stays under the CTAs; migrate pills to `surface-card card-static` styling.
4. Replace the local `getDifficultyRGB` (~line 199) with the Task-2 import.

- [ ] **Step 3: GSAP scroll reveals**

Tag each below-fold section root (difficulty legend, authenticated sections, any content section) with `data-reveal`. Add to Home:

```jsx
useEffect(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let ctx;
  let cancelled = false;
  import("gsap").then(async ({ gsap }) => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    if (cancelled) return;
    gsap.registerPlugin(ScrollTrigger);
    ctx = gsap.context(() => {
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        );
      });
    });
  });
  return () => {
    cancelled = true;
    ctx?.revert();
  };
}, []);
```

Remove the Framer-Motion whileInView/entrance animations from those same sections (one system per element).

- [ ] **Step 4: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Inspect build output: `gsap` chunk separate from `index` entry chunk. Dev server: hero reads clearly, sections reveal once on scroll, reduced-motion disables reveals (test via devtools emulation), 375px hero not cramped.

```bash
git add client/package.json client/package-lock.json client/src/pages/Home.jsx
git commit -m "feat(client): home hero hierarchy and lazy GSAP scroll reveals"
```

---

### Task 13: Perceived-speed tuning

**Files:**
- Modify: `client/src/main.jsx` (query defaults)
- Modify: `client/src/pages/Leaderboard.jsx`, `client/src/pages/Dashboard.jsx` (placeholderData where lists paginate/filter)

**Interfaces:**
- Consumes: nothing new. Missions already got `placeholderData` in Task 8.

- [ ] **Step 1: Query client defaults**

In `main.jsx` set `staleTime: 60 * 1000` (from 30s) and add `gcTime: 5 * 60 * 1000` in `defaultOptions.queries`.

- [ ] **Step 2: keepPreviousData on switchable lists**

Add `placeholderData: keepPreviousData` (import from `@tanstack/react-query`) to: `leaderboardQuery` + `clanLeaderboardQuery` in Leaderboard (segmented switch shouldn't flash), and `challengesQ` in Dashboard if it paginates/filters (read the query; skip if static).

- [ ] **Step 3: Verify + commit**

Run: `cd client && npm run lint && npm run build`. Dev server: toggling leaderboard segments keeps previous data visible while refetching.

```bash
git add client/src/main.jsx client/src/pages/Leaderboard.jsx client/src/pages/Dashboard.jsx
git commit -m "perf(client): query caching defaults and keepPreviousData on lists"
```

---

### Task 14: Final verification sweep

**Files:** none (verification only; fix-forward anything found)

- [ ] **Step 1: Static checks**

Run: `cd client && npm run lint && npm run build`
Expected: clean; in build output confirm `three`-vendor and `gsap` chunks are NOT in the entry chunk, and note total entry-chunk size vs. `git stash`-free baseline if available.

- [ ] **Step 2: Blur audit**

Run: `grep -rn "backdrop-blur\|backdrop-filter" client/src | grep -v surface-overlay`
Expected: only overlay surfaces (navbar, dropdowns, modals, tab bar, sticky bars) and Phase-2 pages not yet migrated. No cards.

- [ ] **Step 3: Full visual pass**

Dev server. For each of Home, Missions, ChallengeDetails, Dashboard, Leaderboard: light + dark, 1280px + 375px (16 checks + challenge flow): browse → open challenge → run → submit path works; screenshots captured for the final report.

- [ ] **Step 4: Motion audit**

Verify: no entrance staggers on data pages, reduced-motion emulation kills spotlight/reveals/orbs, page transitions snappy.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A client
git commit -m "fix(client): phase 1 verification sweep fixes"
```

(Skip if nothing changed.)
