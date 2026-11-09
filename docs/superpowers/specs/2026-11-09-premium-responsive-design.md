# AI Job Finder — premium visual system and responsive discovery

## Intent
Make the published job finder comfortable on mobile and desktop, remove the blue visual identity completely, and make discovery controls easy to scan without changing the data-source or vacancy-ingestion architecture.

## Goals
- Replace blue accents with a restrained graphite, warm ivory, and muted emerald palette.
- Make the sidebar a stable desktop column and a keyboard-accessible off-canvas drawer below the mobile breakpoint.
- Preserve the existing Worldwide, experience, employment, salary, no-experience, sorting, pagination, and resume-match behavior.\n- Add explicit filters for vacancies without a mandatory English requirement and for vacancies where the employer explicitly accepts candidates without a degree.
- Improve visual hierarchy and focus/hover/selected states consistently across navigation, filters, cards, pagination, and links.
- Add repeatable static regression checks for theme and responsive layout.

## Non-goals
- No new vacancy providers, scraping, backend, account system, or changes to source allowlists.
- No automatic merge to main and no edits to vacancy records.
- No claims that heuristic vacancy attributes are employer-verified.

## Anti-goals
- No blue or cyan accent colors, gradients, focus rings, or links.
- No horizontal page overflow at common mobile widths.
- No breaking changes to current data schema or user localStorage keys.

## Approaches
1. Replace the entire UI architecture: rejected because the project is static vanilla HTML/CSS/JS and the existing feature behavior should be preserved.
2. Append a narrow CSS override while leaving conflicting generations in place: rejected because the accumulated cascade caused prior responsive regressions.
3. Consolidate the active visual layer with a single final tokenized theme, explicitly normalize responsive shell/sidebar behavior, and add static regression checks: selected because it preserves the stack while addressing cascade conflicts and providing verifiable guardrails.

## Implementation decisions
- Keep HTML, CSS, and vanilla JavaScript; do not add runtime dependencies.
- Use graphite/navy-neutral surfaces, warm off-white page background, emerald as the sole primary accent, and restrained amber/red semantic statuses.
- Desktop sidebar is a fixed-width grid column from 1024px; below 1024px it becomes an off-canvas drawer with backdrop and Escape support.
- English filtering excludes only explicit mandatory English requirements; preference wording such as "preferred" and "a plus" is not treated as mandatory.\n- Degree filtering includes only explicit statements accepting candidates without a degree or accepting equivalent experience; missing education data is not treated as proof.
- Use Node's built-in test runner for static theme/layout assertions; no dependency installation.

## Constraints
- Work on a feature branch and submit a PR to main; do not merge automatically.
- Preserve current source allowlists, refresh workflow behavior, and job data.
- Validate CSS/HTML/JS syntax and responsive/theme assertions in GitHub Actions before considering the work ready.
