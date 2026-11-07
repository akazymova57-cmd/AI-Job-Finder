# AI Job Finder

A lightweight, no-build MVP for discovering international remote jobs.

## Current features

- Search job titles, companies, tags and descriptions.
- Filter by broad geography, entry-level signals and employment type.
- Rank results using transparent keyword-based relevance scoring.
- Open the original vacancy on the provider's website.
- Cache API results in the browser for six hours.

## Run locally

Open `index.html` in a browser. If your browser blocks local-file requests, run a static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Data source and attribution

This MVP uses the public Remotive API: https://remotive.com/api/remote-jobs

Remotive requires attribution and a link to each original listing. The interface names Remotive as the source and sends users to the original vacancy. The API may delay listings and should not be polled more than four times per day. Review the provider's current terms before any public/commercial deployment.

## Important limitations

- The "entry-level" label is a keyword heuristic, not a verified experience requirement.
- Geography is inferred from provider-supplied location text; always confirm country eligibility on the original listing.
- This version does not use an LLM, scrape websites, submit applications, or guarantee job validity.
- No API keys or personal data are required.

## Roadmap

1. Add more providers after reviewing their API terms and attribution rules.
2. Improve country/work-authorization filtering.
3. Add user profiles and explainable matching.
4. Add optional AI resume and cover-letter assistance.
5. Add Telegram alerts with user consent.
6. Add tests, monitoring and deployment automation.

## Deploy

The project is static and can be hosted with GitHub Pages. In the repository settings, enable Pages and select the `main` branch with the root folder as the publishing source.