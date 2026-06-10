---
name: Tender contact block is not in the API spec
description: The tender `contact` response field (incl. `fax`) is ad-hoc, not part of OpenAPI/api-zod; extend it without orval regen.
---

The structured contact block returned by `GET /api/matches/:id` (top-level
`contact`) and `GET /api/tenders/:id/mcp-enrichment` is NOT defined in
`lib/api-spec/openapi.yaml` nor generated into `lib/api-zod`. It is an ad-hoc
response field assembled in route code. The frontend declares its OWN
`TenderContact` type (in `artifacts/ihalezeka`).

**Why:** adding/removing fields on this block (e.g. `fax`) needs NO openapi/orval
regen — only the DB `TenderContact` (`lib/db/src/schema/tenders.ts`) and the
frontend's own type. Don't waste time regenerating the spec for contact changes.

**How to apply:** to extend the contact block, edit (1) `lib/db` `TenderContact`,
(2) the two route builders — `routes/matches.ts` `buildContact` and
`routes/tenders.ts` `/mcp-enrichment`, and (3) `ihale-detay.tsx`'s own
`TenderContact`. The persisted `contact` jsonb column is populated at ingest
(`deriveContact` in `scrapers/utils.ts`, no network) and by
`scripts/backfill-contacts.ts` (idempotent, `WHERE contact IS NULL`).
Display precedence: matches = persisted < aiSummary < raw/columns;
mcp-enrichment = live MCP > persisted > agencyName. Contact extraction is
honest-by-design: fax/phone keyword-scoped (fax never a bare match, so a phone
is never mislabelled), null when nothing derivable.
