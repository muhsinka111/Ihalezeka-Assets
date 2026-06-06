---
name: EKAP detail & document access
description: How to reach EKAP v2 tender detail/announcement text and resolve the official document URL, and why the binary şartname is not downloadable.
---

# EKAP v2 detail + document access

The EKAP v2 search payload's per-tender **top-level hash `id`** (e.g. `2caeff30…`, ~64 hex
chars; stored as `raw_data->>'id'`) is the key for both detail endpoints. Do **not** use the
numeric `dokumanListe[].ihaleId` — the detail endpoint rejects it with HTTP 500 "Kayıt Bulunamadı".

Both endpoints reuse the **same** signed `X-Custom-Request-*` security headers and TLS-relaxed
agent that the existing EKAP search client already builds — call that shared header/signing
helper in `ekap-client.ts`; do not hardcode or copy any key material.

- **Detail / announcement text**: `POST /b_ihalearama/api/IhaleDetay/GetByIhaleIdIhaleDetay`
  body `{ihaleId: <hash>}`. Returns `ilanList[].veriHtml` — the legally-mandated İhale İlanı
  (and any Düzeltme İlanı), ~5–20KB of HTML containing scope, dates and yeterlik (qualification)
  criteria. Strip to text → this is real spec-level grounding ("notice" quality), a big upgrade
  over bare metadata. Also `ihaleOzellikList` (yeterlik-type enum flags) and `ihaleBilgi`.

- **Official document URL**: `POST /b_ihalearama/api/EkapDokumanYonlendirme/GetDokumanUrl`
  body `{islemId:"1", ihaleId:<hash>}`. `islemId` MUST be `"1"` (a document id fails). Returns a
  legacy `ekap.kik.gov.tr/EKAP/Ortak/VatandasIlanGoruntuleme.aspx?...aramaDownload=true` URL.

## The binary şartname is NOT downloadable headlessly
**Why:** the document URL 302-redirects to `IlanDokumanDownload.aspx`, which reads `ihaleId`
from the ASP.NET session set on the FIRST hop. With plain browser headers (NOT the ekapv2
`X-Custom-*`/`Origin:ekapv2` security headers — those trip the F5 WAF → 400), a session warmed
at `ekap.kik.gov.tr/EKAP/YeniIhaleArama.aspx` and the same cookie jar carried across the 302,
the flow now reaches a terminal **HTTP 200 with a ~294KB body** — but that body is the
**F5/Shape anti-bot JS challenge**, not the file: only ~335 visible chars ("Doğrula / İşleminiz
Devam Ediyor"), ~8KB challenge script, plus `__VIEWSTATE` and a `TS…` bot-defense cookie. The
gate text is buried well past the first 50KB, so detection must scan the whole page. Getting a
200 does NOT mean you got the document — it requires executing their obfuscated JS, so the real
PDF/ZIP needs a full browser + captcha solver (out of scope). Treat the gate as a TERMINAL,
non-retriable condition (re-warming can't solve a JS challenge — don't waste retries). The
reference `ihale-mcp` repo also only *returns* this URL; it never downloads the file.

**How to apply:** store the resolved URL as a real `documents` entry (a working link for the
human user, who passes the gate in their own browser) but ground AI analysis on the detail
`veriHtml` text instead of the file. Harden document text extraction to drop HTML/interstitial
pages (see `extractTextFromDocument`) so the gate page is never ingested as "document" text — the
grounding chain then correctly falls back to notice. See `enrichEkapTender` in
`artifacts/api-server/src/scrapers/ekap-client.ts`.
