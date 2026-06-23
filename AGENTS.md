# Codex Instructions — Token Saving Mode

## Main rule

Work with the smallest possible context. Do not inspect, load, summarize, or modify files unless they are directly needed for the requested change.

## Default behavior

* Do not browse the whole repository.
* Do not open unrelated files.
* Do not run the app unless explicitly requested.
* Do not use the browser unless explicitly requested.
* Do not run tests, build, lint, install dependencies, or start servers unless explicitly requested.
* Do not read package lock files unless the task is about dependencies.
* Do not modify formatting-only sections unless required.
* Do not make opportunistic improvements outside the requested scope.
* Do not refactor unless explicitly requested.
* Do not explain every internal step.

## Before editing

Before changing code, state briefly:

1. Files you need to inspect.
2. Files you expect to modify.
3. Whether you need to run any command.

If the task can be done statically, do it without running commands.

## File access rules

Prefer targeted searches over broad scans.

Use:

* exact filenames when provided
* targeted `grep` / search terms
* direct imports from the file being edited

Avoid:

* reading entire directories
* opening many components "just in case"
* scanning unrelated services, assets, styles, tests, or configs

## UI / frontend tasks

For visual or layout changes:

* First edit JSX/CSS statically.
* Do not open the browser by default.
* Do not start the dev server by default.
* Do not inspect screenshots, console, or DOM unless requested.
* If browser verification is useful, ask before doing it.

## Backend / logic tasks

For logic changes:

* Inspect only the affected function, service, controller, or model.
* Do not trace the entire app unless the issue cannot be localized.
* Do not run full test suites unless requested.
* Prefer one focused verification command, if needed.

## Output style

Keep responses short.

After editing, return only:

* files changed
* short summary of changes
* commands run, if any
* anything pending or risky

Do not include long explanations unless requested.

## Scope control

If the request is ambiguous, ask one concise clarification before exploring many files.

If the requested change touches many areas, propose a smaller first step instead of loading the whole project.

## Commands

Ask before running commands that may consume significant time or context, including:

* npm install
* npm run build
* npm run dev
* full test suites
* browser automation
* large repository searches
* dependency updates
* formatting the whole project

## Git

Do not commit, push, create branches, or open pull requests unless explicitly requested.

## Preferred workflow

1. Understand the exact requested change.
2. Inspect the minimum files.
3. Make the smallest valid edit.
4. Show the diff summary.
5. Stop.

---

# Mobile responsiveness checklist

All UI changes in this project must work in both desktop and mobile viewports. When modifying any of the following files, also consider the mobile media query equivalents and add or update the mobile styles in `src/apex.css` / `src/styles.css` / `src/stitch.css`:

* `src/components/AppHeader.jsx` — sidebar, topbar, low-coins banner, sport filters, side nav, drawer.
* `src/pages/Eventos.jsx` — event list, sport filter toolbar, view-mode toggle, event card layout.
* `src/pages/EventDetail.jsx` — event hero, odds buttons, bet panel (slider, presets, +/- buttons, confirm), ranking, history.
* `src/pages/Earn.jsx` — daily missions, featured offers, offerwalls.
* `src/pages/Home.jsx` / `src/pages/Dashboard.jsx` — welcome, quick actions, balance cards.
* `src/pages/Profile.jsx` — user info, stats, predictions list.
* `src/pages/Predictions.jsx` — filters, match cards, betslip.
* `src/pages/Sportsbook.jsx` / `src/pages/Ranking.jsx` / `src/pages/Leagues.jsx` / `src/pages/LeagueDetail.jsx` / `src/pages/Fantasy.jsx` / `src/pages/Challenges.jsx` / `src/pages/Rewards.jsx` — list/grid layouts.

### Mobile-specific rules

* **Sidebar** is hidden on mobile by `.apex-desktop-sidebar { display: none }` (see `apex.css` line 78). The mobile drawer (`apex-mobile-drawer`) replaces it.
* **Topbar height** is 64px on mobile, 72px on desktop (`@media (min-width: 1100px)`). The CSS variable `--apex-topbar-h` should be set per breakpoint.
* **Sidebar width** variable `--apex-sidebar-w` is `248px` on desktop and `0px` on mobile.
* **Low-coins banner** is `position: fixed` and uses `top: var(--apex-topbar-h, 64px)` + `left: var(--apex-sidebar-w, 0px)`. Both variables must be defined at the topbar element so they cascade.
* **Slider** (`<input type="range">`) thumb styles are global (added at the desktop media query). Make sure they apply on mobile too — move them to the base CSS or duplicate in the mobile media query if needed.
* **Event card layout** in `Eventos.jsx` uses `grid-template-columns: 1fr auto 1fr` which can wrap awkwardly on narrow screens — verify or switch to `flex-wrap` below ~600px.
* **Bet panel** in `EventDetail.jsx` uses inline styles with hard-coded colors; verify it remains readable on the dark mobile background.
* **Navigation badges** in the sidebar (`apex-sidebar-badge`) should not appear in the mobile drawer — they're already inside the desktop sidebar only.
* **Bottom nav** (`apex-bottom-nav`) is hidden on desktop and shown on mobile.

### Test matrix (manual)

For any UI change, verify these widths:

1. `375px` (iPhone SE)
2. `414px` (iPhone Plus)
3. `768px` (iPad portrait)
4. `1100px+` (desktop)

### Known issues to revisit

* Banner z-index 99 vs sidebar z-index 120 — make sure banner content doesn't bleed under the sidebar at ~768–1100px during the breakpoint transition.
* The `<input type="range">` thumb CSS is currently inside the desktop media query — should be moved to the base level so it applies everywhere.
