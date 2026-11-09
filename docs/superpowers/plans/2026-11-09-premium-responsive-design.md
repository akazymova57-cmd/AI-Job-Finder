# Premium Theme and Responsive Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove blue from the UI and deliver a consistent, responsive job-discovery interface without changing vacancy ingestion.

**Architecture:** Keep the existing static vanilla stack. Consolidate the visual overrides into one coherent tokenized theme, correct desktop/mobile sidebar behavior, and add dependency-free regression checks.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-09-premium-responsive-design.md`

## Global Constraints
- No runtime dependencies.
- Preserve `data/jobs.json`, source adapters, allowlists, and localStorage keys.
- Desktop sidebar breakpoint: 1024px; mobile drawer below 1024px.
- Primary accent is muted emerald; blue/cyan is not permitted as a UI accent.
- Do not merge the PR automatically.

## Review Focus
- 320px and 360px viewport widths: no document-level horizontal overflow.
- 768px tablet: sidebar remains off-canvas and toggle/backdrop are usable.
- 1024px breakpoint: desktop grid and persistent sidebar activate without overlap.
- Keyboard use: Escape closes drawer and focus indicators remain visible without blue.
- Existing filters and pagination continue to respond to their current DOM IDs.

---

### Task 1: Add theme and responsive regression checks

**Files:**
- Create: `tests/ui-regression.test.mjs`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Test reads `styles.css` and `index.html` from the repository root.
- Workflow executes `node --test tests/ui-regression.test.mjs`.

- [ ] Add tests asserting the final theme tokens use emerald, not blue; mobile and desktop breakpoints are present; required sidebar IDs and filter IDs remain in HTML.
- [ ] Run the test before implementation and confirm it fails against the old theme/layout.
- [ ] Add the test command to the existing validation workflow.
- [ ] Commit the test-first change.

### Task 2: Consolidate the visual theme and responsive shell

**Files:**
- Modify: `styles.css`
- Modify: `app.js` responsive drawer focus management
- Modify: `index.html` cache-busting version strings

**Interfaces:**
- Keep existing selectors and DOM IDs consumed by `app.js`.
- Sidebar open/close remains driven by `body.sidebar-open`, `#sidebar-open`, `#sidebar-close`, and `#sidebar-backdrop`.

- [ ] Replace conflicting blue-oriented visual overrides with one final graphite/ivory/emerald theme.
- [ ] Normalize desktop grid at 1024px and mobile drawer below 1024px.
- [ ] Add overflow-safe sizing for grid/flex children, cards, long links, and controls.
- [ ] Preserve visible focus states and reduced-motion behavior; hide the closed drawer from tab order, trap focus while open, restore focus on close, and close the drawer when entering desktop width.
- [ ] Update cache-busting versions.
- [ ] Run the full UI regression test and JavaScript syntax checks.

### Task 3: Verify and publish a reviewable change

**Files:**
- No production data changes.

- [ ] Inspect the complete diff for accidental source/data/workflow changes.
- [ ] Confirm tests and validation workflow status from the PR.
- [ ] Open a PR to `main`; do not merge it.
- [ ] Report exactly which checks ran and any checks that remain unavailable.
