---
name: Tender search (Postgres FTS + trigram)
description: How İhaleZeka tender text search is built — extensions, normalization, relevance, graceful fallback
---
Tender search (`GET /tenders`, q param) is Postgres-native: pg_trgm + unaccent, no external service.

- **Turkish has no built-in Postgres FTS stemmer.** Don't use `to_tsvector('turkish', ...)` — that config doesn't exist. Normalize instead with `f_unaccent(lower(...))` (an IMMUTABLE wrapper over `unaccent('public.unaccent', $1)` so it can be indexed) and match via trigram `word_similarity > 0.3` OR substring LIKE.
- **Must unaccent BOTH sides before trigram/LIKE.** Turkish dotted/dotless i (İ/ı) breaks raw `similarity()` (e.g. 'yazilim' vs 'yazılım' ≈ 0.23); after unaccent both fold to 'yazilim' → 1.0.
- Search objects are created at api-server startup by `ensureSearchObjects()` (`src/lib/search-bootstrap.ts`), wired non-fatally into `index.ts`. It sets a `fuzzySearchReady` flag.
  **Why:** drizzle-kit push manages tables only, not extensions/functions/indexes — startup bootstrap is what gives dev+prod parity.
- **The route MUST guard on `isFuzzySearchReady()`** and fall back to plain multi-field ILIKE when false. Otherwise, if a managed DB role can't `CREATE EXTENSION`, every `q` search 500s instead of degrading.
- Relevance score = word_similarity + title/agency substring boosts, cast `::float8` (so node-pg returns a JS number, not a numeric string), returned per item and surfaced in UI as a match-quality badge; default sort becomes relevance when q is present.
