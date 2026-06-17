---
name: EKAP ISI access limitations
description: How EKAP İhale Sonuç İlanı (ISI / award notice) data can and cannot be fetched.
---

## The rule
EKAP's regular search API (`/b_ihalearama/api/Ihale/GetListByParameters`) and ihale-mcp `search_tenders` only return active İhale İlanları — they do not expose İhale Sonuç İlanları (ISIs). The `ihaleDurumlar` filter codes for "concluded" status (SONUCLANDI, IHALE_YAPILDI, numeric 2/3, SONUCILAN) returned 0 results in testing — EKAP's internal codes are not publicly documented.

## Architecture chosen
`award_results` table is populated by `runAwardScraper()` which:
1. Tries EKAP direct search with 6 candidate `ihaleDurumlar` codes (8-second timeout each)
2. Tries `/b_ihalearama/api/IhaleSonucIlan/GetListByParameters` ISI endpoint (8-second timeout)
3. Falls back to ihale-mcp keyword search for award text (also returns 0 — MCP doesn't index ISIs)
4. Processes any `status='awarded'` tenders already in DB (currently always 0 since EKAP scraper only ingests active tenders)

All paths fail gracefully. The competitors endpoints show a "collecting data" empty state until real ISI data is available.

**Why:** EKAP's public API doesn't expose a stable ISI search endpoint; the concluded-status codes are internal. This may change if IHALEMCP_API_KEY unlocks ISI access, or if EKAP's portal evolves.

**How to apply:** Don't rely on ihaleDurumlar filter or ihale-mcp for ISI discovery. Monitor whether a future ihale-mcp tool version adds `search_award_notices` or similar. The award_results table and competitors endpoint are fully wired — they'll auto-populate once ISI access is resolved.
