---
name: EKAP document URLs are empty placeholders
description: Why document-grounded features in İhaleZeka fall back to title/metadata grounding
---

The EKAP scraper stores `tenders.documents` as arrays of objects with **empty**
`url`/`name`/`type` strings (placeholders), not real download links. In the current
dataset ~515 of 8176 tenders have a non-empty `documents` array, but **zero** have a
single non-empty `url`. ilan.gov tenders carry content in `rawData` HTML instead.

**Why it matters:** Any document-grounded feature (in-app viewer, doc-text extraction,
chat-with-documents, document-grounded AI verdict) has no bytes to fetch for these
tenders. The viewer's byte-proxy correctly 404s when `documents[i].url` is empty.

**How to apply:**
- Do NOT gate auto-behaviors solely on "has documents" — gate on real URLs
  (`documents.some(d => d.url)`) for the viewer, but allow the AI fit verdict to run
  even without docs (the analyzer falls back to title/metadata grounding).
- When testing document download/extraction end-to-end, you must seed a tender with a
  real public URL; the production dataset cannot exercise that path.
