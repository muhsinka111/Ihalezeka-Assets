---
name: Matches endpoint tender fallback
description: GET /matches/:tenderId returns 404 for tenders without a match record; how to fix it.
---

## The rule
`GET /matches/:tenderId` does an INNER JOIN between `matchesTable` and `tendersTable`. If a tender has never been scored (no row in `matchesTable`), the join returns nothing and the endpoint returns 404, causing the detail page to show "İhale bulunamadı".

## Fix
Two-step query: try the inner join first; if no row, fall back to a direct `tendersTable` query. Return a match-shaped response with null fit-score fields (`fitScore: null`, `pros: null`, `risks: null`, `status: "pending"`). The detail page renders the tender with zero score but full content.

**Why:** New tenders (just scraped), tenders from live EKAP search, and any tender the scorer hasn't processed yet will have no match record. The detail page should always be reachable.

**How to apply:** Any time you add or modify the `/matches/:tenderId` handler, preserve the two-step fallback. Do not revert to a pure inner join.
