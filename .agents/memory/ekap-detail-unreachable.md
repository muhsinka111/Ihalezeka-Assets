---
name: EKAP detail/announcement API unreachable
description: EKAP v2 detail and announcement endpoints can't be called from outside the portal; consequences for tender grounding.
---

# EKAP detail/announcement API is unreachable from outside the portal

Probed live (June 2026) against `https://ekapv2.kik.gov.tr` reusing the working
search-API AES security headers and TLS-relaxed agent:

- `GET /b_ihalearama/api/IhaleDetay/GetByIhaleId?ihaleId=...` → **404** (route does not exist). Same for `Ihale/GetByIhaleId`, `Ihale/GetById`, `Ihale/Get`.
- The entire `/b_ihaleilan/...` announcement service → **406 Not Acceptable** for every route/version/method tried. 406 is a blanket response (route prefix matched, content negotiation/session rejected), so it needs a real portal session/cookie, not just headers.
- The SPA page `/ekap/ihale-detay/{id}` also 406s.
- The list API `GetListByParameters` returns only metadata fields (ihaleAdi, idareAdi, ihaleIlAdi, tip/usul/durum açıklamaları, ikn, tarih). No description/şartname prose. `dokumanListe` items are `{id, tarih, ihaleId}` — no URLs.

**Why it matters:** EKAP tenders genuinely have no fetchable detail text. The
reliable-analysis grounding chain therefore grounds EKAP on the **metadata
floor** (source=metadata, confidence=low), which still yields real, non-refusal
summaries. Do NOT chase the detail endpoint expecting it to work, and do NOT fake
a "notice"-quality description from metadata.

**How to apply:** `fetchEkapDetailText(ihaleId)` in `ekap-client.ts` is wired
(scraper + `scripts/backfill-ekap-descriptions.ts`) as a best-effort that returns
null today. If EKAP ever exposes a usable detail route, implement it there and
re-run the backfill — EKAP grounding upgrades to notice quality with no other
changes. Verify with `scripts/smoke-grounding.ts`.
