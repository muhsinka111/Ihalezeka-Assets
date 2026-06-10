---
name: İlan.gov ads carry no downloadable documents
description: GetAdDetail files field is null/empty for every ad — there is nothing to backfill for İlan documents
---

İlan.gov ad details (GetAdDetail) expose attachments via a `files` array, but it is `null` (live response) / `[]` (stored raw_data) for every ad we ingest — verified across all stored ads and a live probe. So the honest İlan document state is 0; there is no source data to backfill. The notice body lives in `content`/`text` (mapped to `description`), and the public ad page is `sourceUrl`.

**Why:** the listing types we scrape don't attach binary files; fabricating document entries would mislead users and pollute the document viewer + AI grounding chain.

**How to apply:** `mapIlanToTender` (artifacts/api-server/src/scrapers/utils.ts) runs `extractIlanDocuments(files[])` defensively so any future ad WITH files is captured at ingest, but expect 0 today. Do NOT write a network backfill for İlan docs — there is no source data. (EKAP is different: see ekap-detail-document-access / ekap-document-urls.)
