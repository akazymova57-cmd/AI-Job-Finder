# AI Job Finder

A lightweight, no-build MVP for discovering international remote jobs and comparing vacancy text with a resume using a transparent local keyword dictionary.

## Current features

- Search job titles, companies, tags and descriptions.
- Filter by broad geography, experience signal, employment type and disclosed salary.
- Sort by resume-skill overlap, publication date or salary disclosure.
- Paste resume text or upload a plain-text `.txt` / Markdown `.md` file (maximum 1 MB).
- Extract a limited, explicit dictionary of skills from the resume and vacancy text.
- Show matched skills, skills mentioned in the vacancy but not found in the resume, and a coverage percentage.
- Open the original vacancy URL on the provider's website.
- Cache API results in the browser for six hours.

## Favorites and application tracker

- Save vacancies to a local favorites list.
- Track each saved vacancy as saved, planned, applied, interview, rejected or offer received.
- Open the original vacancy source from the tracker.
- Favorites and statuses are stored in this browser's localStorage only; they are not synced between devices and can be cleared with site data.

## Resume matching: what the percentage means

The matching score is deliberately not described as AI. The browser checks for a fixed list of skill phrases in the resume and in each vacancy's title, tags and description.

`matched skills / recognized vacancy skills × 100`

For example, if a vacancy contains five recognized skills and three of them are also found in the resume, the displayed coverage is 60%. The card lists both the overlap and the skills not found in the resume.

This is only a keyword-coverage indicator. It does not understand context, proficiency, years of experience, seniority, language level, work authorization or whether a skill is mandatory. A skill mentioned in a company description can also be counted. If the dictionary finds no skills in a vacancy, no percentage is shown. The dictionary is intentionally visible in `app.js` and can be extended.

## Resume privacy and supported formats

Resume text is processed in the current browser tab only. It is not sent to Remotive, stored in localStorage or uploaded to a backend. The current version reads TXT and MD files only. PDF and DOCX parsing are not implemented.

## Run locally

Open `index.html` in a browser. If your browser blocks local-file requests, run a static server:

    python -m http.server 8000

Then open http://localhost:8000.

## Data source, attribution and request limits

This MVP uses the public Remotive API: https://remotive.com/api/remote-jobs

The interface attributes Remotive and links each result to the original vacancy URL supplied by the API. The browser caches results for six hours and tracks API request attempts locally, blocking more than four requests in a rolling 24-hour window per browser profile. Failed attempts count toward this local limit to avoid repeated polling.

This client-side limit is a courtesy safeguard, not server-side enforcement; clearing browser storage or using another browser can reset it. Review Remotive's current API terms before public or commercial deployment.

## Important limitations

- No LLM, paid API, scraping, application submission or account system is used.
- Experience and geography filters are keyword heuristics, not verified eligibility checks.
- Location labels and vacancy details can be stale; confirm country eligibility, language requirements and terms on the employer's page.
- The frontend is static. There is no server-side rate limiter, database, user profile storage or monitoring yet.

## Deploy

The project can be hosted as a static site with GitHub Pages. In repository settings, enable Pages and select the `main` branch with the root folder as the publishing source.
