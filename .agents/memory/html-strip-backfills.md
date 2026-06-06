---
name: HTML→text backfills
description: Why HTML stripping for column backfills must run in JS, not SQL regexp_replace
---

# Strip stored HTML in JS, not Postgres regex

When backfilling a plain-text column (e.g. `tenders.description`) from stored HTML
(e.g. `raw_data.content` for `ilan_gov`), do the stripping in application code using
the same `stripHtml` the runtime grounding chain uses — not with a SQL
`regexp_replace` pass.

**Why:** Postgres POSIX regexp does not support lazy/non-greedy quantifiers the way
JS does. A SQL attempt to drop `<style>...</style>` / `<script>...</script>` /tags
matched greedily and devoured the real notice body, leaving rows effectively empty.
That bad pass had to be reset to NULL and redone. JS `stripHtml` (with a proper
non-greedy block remover + entity decode) produces correct text.

**How to apply:** For one-time backfills, write a `tsx` script that imports the
exported `stripHtml` from `artifacts/api-server/src/services/document-analyzer.ts`,
selects rows with stored HTML, and writes the stripped text capped (~20k chars).
Run with `pnpm --filter @workspace/api-server exec tsx scripts/<file>.ts`. Keep DB
writes in real Node (drizzle/psql) — the code_execution sandbox can block UPDATEs
and can't resolve workspace deps from the repo root.
