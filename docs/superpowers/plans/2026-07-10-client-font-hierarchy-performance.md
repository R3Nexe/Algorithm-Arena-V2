# Client Font Hierarchy & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken font imports (Space Grotesk, Fira Code), remove unused font requests (Exo 2, Work Sans), add Google Fonts preconnect hints, and lazy-load PixelBlast so Three.js is removed from the initial bundle.

**Architecture:** Pure config/CSS and React import changes — no new abstractions, no new files. `index.css` gets a merged font `@import`. `index.html` gets two `<link rel="preconnect">` tags. Each file that imports `PixelBlast` statically replaces that with `React.lazy()` and wraps usage in `<React.Suspense fallback={null}>`.

**Tech Stack:** React 19, Vite 7, Tailwind CSS 3, Google Fonts, Three.js (via PixelBlast)

## Global Constraints

- Do NOT change any CSS variable assignments (`--font-h1`, `--font-h2`, `--font-body`, `--font-mono`) in `index.css`
- Do NOT modify the PixelBlast component itself or any props passed to it
- Do NOT change `vite.config.js` — `three-vendor` stays in `manualChunks` as-is
- Font choices stay exactly as designed: Michroma (h1), Space Grotesk (h2), Inter (body), Fira Code (mono)
- All commands run from `client/` directory unless otherwise noted

---

### Task 1: Fix font imports and add preconnect hints

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/index.css`

**Interfaces:**
- Produces: `Space Grotesk` and `Fira Code` available as web fonts; `Exo 2`/`Work Sans` no longer requested; Google Fonts connections pre-established

- [ ] **Step 1: Add preconnect hints to `index.html`**

Open `client/index.html`. After line 6 (`<meta name="viewport" ...>`), add two lines:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

The `<head>` block should now read:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/algoarena-logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <title>Algorithm-Arena</title>
```

- [ ] **Step 2: Fix Google Fonts imports in `index.css`**

Open `client/src/index.css`. The current lines 10–11 and 21 are:

```css
@import url('https://fonts.googleapis.com/css2?family=Michroma&family=Orbitron:wght@400..900&display=swap');
```
(line 21)
```css
@import url('https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,400;1,200&family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap');
```

Replace both of those Google Fonts `@import` lines with a single merged one that retains Michroma + Orbitron and adds Space Grotesk + Fira Code:

Remove line 10:
```css
@import url('https://fonts.googleapis.com/css2?family=Michroma&family=Orbitron:wght@400..900&display=swap');
```

Remove line 21:
```css
@import url('https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,400;1,200&family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap');
```

Add this single import in their place (put it right after the Inter import on line 9, replacing the old line 10):

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..600&family=Michroma&family=Orbitron:wght@400..900&family=Space+Grotesk:wght@300..700&display=swap');
```

The top of `index.css` should now look like this (lines 1–26 approximately):

```css
/* ==========================================================================
   FONT CONFIGURATION AREA (Change your fonts here!)
   ========================================================================== */

/* 1. IMPORT GOOGLE FONTS & CUSTOM FONTS */

/* Default Stack Imports: Inter (Body), Michroma & Orbitron (Headings) */
@import url("https://rsms.me/inter/inter.css");
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..600&family=Michroma&family=Orbitron:wght@400..900&family=Space+Grotesk:wght@300..700&display=swap');

/* Additional Alternative Premium Fonts (Pre-imported for easy testing): */
/*
   - Space Grotesk: Futuristic, clean, geometric heading font
   - Outfit: Sleek, high-end, modern branding font
   - Plus Jakarta Sans: Extremely premium and readable neo-grotesque body font
   - JetBrains Mono: Gorgeous, clean developer monospaced code font
   - Syne: Expressive, artistic headline font
   - Montserrat: Bold, high-character sans-serif
*/

/* Tailwind Engine Directives */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Start dev server and verify fonts visually**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Open DevTools → Network → filter by "fonts.g". You should see a single request to `fonts.googleapis.com` containing `Fira+Code`, `Michroma`, `Orbitron`, and `Space+Grotesk`. There should be NO requests for `Exo+2` or `Work+Sans`.

Check visual rendering:
- Any `h2`/`h3` text (e.g. Dashboard → "Available Missions", "Recent Activity") should render in Space Grotesk — a geometric sans-serif, noticeably different from the system fallback
- Any `code`/`pre` text (e.g. ChallengeDetails code editor labels) should render in Fira Code — a monospaced font with ligatures

- [ ] **Step 4: Commit**

```bash
git add client/index.html client/src/index.css
git commit -m "perf: fix font imports and add preconnect hints for Google Fonts

- Merge two Google Fonts @import calls into one consolidated request
- Add Space Grotesk (h2/subheadings) and Fira Code (mono) which were
  missing, causing silent fallback to system fonts
- Remove unused Exo 2 and Work Sans imports (wasted network requests)
- Add preconnect hints for fonts.googleapis.com and fonts.gstatic.com"
```

---

### Task 2: Lazy-load PixelBlast in ErrorBoundary

**Files:**
- Modify: `client/src/components/ErrorBoundary.jsx`

**Context:** `ErrorBoundary` is a class component imported synchronously in `main.jsx` line 10. Because it statically imports `PixelBlast`, which statically imports from `three` and `postprocessing`, the `three-vendor` chunk (~500KB) is required by every user on every page before the app mounts. Making `PixelBlast` lazy breaks this dependency chain.

**Interfaces:**
- Produces: `ErrorBoundary` no longer pulls `three-vendor` into the entry bundle. The PixelBlast effect still displays when an error occurs.

- [ ] **Step 1: Replace static PixelBlast import with lazy import in `ErrorBoundary.jsx`**

Open `client/src/components/ErrorBoundary.jsx`. The full current file is:

```jsx
import React from 'react';
import PixelBlast from './PixelBlast';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('UI crash captured by ErrorBoundary', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app text-primary flex items-center justify-center p-6 relative overflow-hidden">
          {/* Background Pixel Blast */}
          <div className="fixed inset-0 z-0 opacity-60 pointer-events-none">
            <PixelBlast
              variant="square"
              pixelSize={8}
              color="#ef4444"
              patternScale={3}
              patternDensity={1.6}
              pixelSizeJitter={0.15}
              noiseAmount={0.06}
              transparent={true}
            />
          </div>

          <div className="macos-glass max-w-md p-8 text-center relative z-10">
            <h1 className="text-2xl font-bold mb-3">Unexpected Error</h1>
            <p className="text-secondary mb-6">
              Something went wrong while rendering this page. Please refresh and try again.
            </p>
            <button
              className="px-5 py-2 rounded-lg bg-accent text-white font-semibold"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

Replace it entirely with:

```jsx
import React from 'react';

const LazyPixelBlast = React.lazy(() => import('./PixelBlast'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('UI crash captured by ErrorBoundary', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app text-primary flex items-center justify-center p-6 relative overflow-hidden">
          {/* Background Pixel Blast */}
          <div className="fixed inset-0 z-0 opacity-60 pointer-events-none">
            <React.Suspense fallback={null}>
              <LazyPixelBlast
                variant="square"
                pixelSize={8}
                color="#ef4444"
                patternScale={3}
                patternDensity={1.6}
                pixelSizeJitter={0.15}
                noiseAmount={0.06}
                transparent={true}
              />
            </React.Suspense>
          </div>

          <div className="macos-glass max-w-md p-8 text-center relative z-10">
            <h1 className="text-2xl font-bold mb-3">Unexpected Error</h1>
            <p className="text-secondary mb-6">
              Something went wrong while rendering this page. Please refresh and try again.
            </p>
            <button
              className="px-5 py-2 rounded-lg bg-accent text-white font-semibold"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

- [ ] **Step 2: Build and verify three-vendor is out of the entry path**

```bash
npm run build 2>&1 | grep -E "(three|index|entry)"
```

Look at the Vite build output. Before this change, `dist/index.html` contained a `<link rel="modulepreload">` referencing the `three-vendor-*.js` chunk. After this change it should not. You can confirm:

```bash
grep "three" dist/index.html
```

Expected output: empty (no matches). The `three-vendor` chunk still exists in `dist/assets/` — that's correct — but it's no longer listed as a preload dependency of the entry point.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ErrorBoundary.jsx
git commit -m "perf: lazy-load PixelBlast in ErrorBoundary to remove Three.js from initial bundle

ErrorBoundary was synchronously imported in main.jsx, pulling three-vendor
(~500KB) into every user's initial page load. PixelBlast is now lazy so
three-vendor only loads when an error actually occurs."
```

---

### Task 3: Lazy-load PixelBlast in Login, NotFound, ClaimUsername

**Files:**
- Modify: `client/src/pages/Login.jsx`
- Modify: `client/src/pages/NotFound.jsx`
- Modify: `client/src/pages/ClaimUsername.jsx`

**Context:** These pages are already lazy-loaded as routes via `App.jsx`, but each statically imports `PixelBlast` within its chunk, creating a static dependency on `three-vendor` that gets fetched whenever the page chunk loads. Making PixelBlast lazy within each page creates a separate split point so `three-vendor` only loads when PixelBlast actually renders.

**Interfaces:**
- Produces: Login, NotFound, ClaimUsername page chunks no longer statically depend on `three-vendor`

- [ ] **Step 1: Lazy-load PixelBlast in `Login.jsx`**

Open `client/src/pages/Login.jsx`. Remove line 7:

```jsx
import PixelBlast from '../components/PixelBlast';
```

Add a lazy declaration immediately after the last import (after `import Logo from '../components/Logo';`):

```jsx
const LazyPixelBlast = React.lazy(() => import('../components/PixelBlast'));
```

Then find the `<PixelBlast` block (around line 155) and replace it with the lazy version wrapped in Suspense:

Before:
```jsx
      <div className="absolute inset-0 z-0 pointer-events-none">
        <PixelBlast
          variant="circle"
          pixelSize={4}
          color={theme === 'dark' ? '#4f46e5' : '#4f46e5'}
          patternScale={4}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
      </div>
```

After:
```jsx
      <div className="absolute inset-0 z-0 pointer-events-none">
        <React.Suspense fallback={null}>
          <LazyPixelBlast
            variant="circle"
            pixelSize={4}
            color={theme === 'dark' ? '#4f46e5' : '#4f46e5'}
            patternScale={4}
            patternDensity={1}
            pixelSizeJitter={0}
            enableRipples
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            liquid={false}
            liquidStrength={0.12}
            liquidRadius={1.2}
            liquidWobbleSpeed={5}
            speed={0.5}
            edgeFade={0.25}
            transparent
          />
        </React.Suspense>
      </div>
```

- [ ] **Step 2: Lazy-load PixelBlast in `NotFound.jsx`**

Open `client/src/pages/NotFound.jsx`. The full current file is:

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import PixelBlast from '../components/PixelBlast';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-app text-primary relative overflow-hidden flex items-center justify-center">
      {/* Background Pixel Blast */}
      <div className="fixed inset-0 z-0 opacity-60">
        <PixelBlast
          variant="circle"
          pixelSize={8}
          color="#ef4444"
          patternScale={3}
          patternDensity={1.6}
          pixelSizeJitter={0.25}
          transparent={true}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-xl px-4">
        <div className="macos-glass p-10 text-center">
          <p className="text-accent text-sm uppercase tracking-[0.2em] mb-3">Navigation Error</p>
          <h1 className="text-display font-black mb-3">404</h1>
          <p className="text-secondary text-lg mb-6">You have wandered into the void. This route does not exist.</p>
          <Link to="/" className="btn-primary inline-block px-6">
            Return to Safety
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
```

Replace it entirely with:

```jsx
import React from 'react';
import { Link } from 'react-router-dom';

const LazyPixelBlast = React.lazy(() => import('../components/PixelBlast'));

const NotFound = () => {
  return (
    <div className="min-h-screen bg-app text-primary relative overflow-hidden flex items-center justify-center">
      {/* Background Pixel Blast */}
      <div className="fixed inset-0 z-0 opacity-60">
        <React.Suspense fallback={null}>
          <LazyPixelBlast
            variant="circle"
            pixelSize={8}
            color="#ef4444"
            patternScale={3}
            patternDensity={1.6}
            pixelSizeJitter={0.25}
            transparent={true}
          />
        </React.Suspense>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-xl px-4">
        <div className="macos-glass p-10 text-center">
          <p className="text-accent text-sm uppercase tracking-[0.2em] mb-3">Navigation Error</p>
          <h1 className="text-display font-black mb-3">404</h1>
          <p className="text-secondary text-lg mb-6">You have wandered into the void. This route does not exist.</p>
          <Link to="/" className="btn-primary inline-block px-6">
            Return to Safety
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
```

- [ ] **Step 3: Lazy-load PixelBlast in `ClaimUsername.jsx`**

Open `client/src/pages/ClaimUsername.jsx`. Remove line 6:

```jsx
import PixelBlast from '../components/PixelBlast';
```

Add a lazy declaration immediately after the last import statement at the top of the file (after `import { Select, ... } from '../components/ui/select';`):

```jsx
const LazyPixelBlast = React.lazy(() => import('../components/PixelBlast'));
```

Then find the `<PixelBlast` block (around line 198) and replace it with the lazy version wrapped in Suspense:

Before:
```jsx
      <div className="absolute inset-0 z-0 pointer-events-none">
        <PixelBlast
          variant="square"
          pixelSize={4}
          color={theme === 'dark' ? '#4f46e5' : '#4f46e5'}
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
      </div>
```

After:
```jsx
      <div className="absolute inset-0 z-0 pointer-events-none">
        <React.Suspense fallback={null}>
          <LazyPixelBlast
            variant="square"
            pixelSize={4}
            color={theme === 'dark' ? '#4f46e5' : '#4f46e5'}
            patternScale={2}
            patternDensity={1}
            pixelSizeJitter={0}
            enableRipples
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            liquid={false}
            speed={0.5}
            edgeFade={0.25}
            transparent
          />
        </React.Suspense>
      </div>
```

- [ ] **Step 4: Verify all three pages still render PixelBlast correctly**

With the dev server running (`npm run dev`), visit each page and confirm PixelBlast renders:

1. `http://localhost:3000/login` — should show the pixel blast background effect
2. `http://localhost:3000/claim-username` — should show the pixel blast background effect
3. `http://localhost:3000/not-found-test` — navigate to any invalid URL to trigger 404, should show the red pixel blast effect

In DevTools → Network, the `PixelBlast` chunk and `three-vendor` chunk should now appear as **separate, deferred** network requests loaded only after the page JS runs — not as `<link rel="modulepreload">` entries in the initial HTML.

- [ ] **Step 5: Final build check**

```bash
npm run build
```

Check the build summary. The `three-vendor` chunk should still be present in `dist/assets/` (it's still generated), but `dist/index.html` should not reference it as a modulepreload:

```bash
grep "three-vendor" dist/index.html
```

Expected: no output (three-vendor is not preloaded in the entry HTML).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Login.jsx client/src/pages/NotFound.jsx client/src/pages/ClaimUsername.jsx
git commit -m "perf: lazy-load PixelBlast in Login, NotFound, ClaimUsername

Removes static three-vendor dependency from these page chunks.
Three.js and postprocessing now load only when PixelBlast renders,
not when the page chunk is fetched."
```
