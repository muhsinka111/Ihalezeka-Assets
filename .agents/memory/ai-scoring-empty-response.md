---
name: AI tender scoring silently falls back to rule-based
description: scoreWithAi returns empty content under gpt-5-mini, so all matches are effectively rule-based despite looking healthy
---

`scoreWithAi` (artifacts/api-server/src/lib/tenderScorer.ts) calls `gpt-5-mini` with `max_completion_tokens: 512` and `response_format: json_object`. In this environment it returns EMPTY message content on every call ("Empty AI response" thrown), so `scoreNewTenders` catches and falls back to `computeRuleBasedScore` for every tender. Matches are still upserted with valid rule-based `fitScore` + templated Turkish `reasoning`, so the pipeline LOOKS healthy — Fırsatlarım fills, no error surfaces to the user.

**Why:** gpt-5-mini is a reasoning model; a 512 completion-token budget is likely consumed entirely by reasoning tokens before any visible output, leaving `content` empty. Deterministic, not a rate limit (no 429).

**How to apply:** If asked "why is AI matching generic / how to improve match quality", this is the root cause, not the prompt. Fix by raising `max_completion_tokens` substantially (≈2000+) and/or revisiting model / response_format, and assert a non-empty JSON body before trusting the result. The same fallback hits ingest-time `scoreAndNotify`, so it affects ALL matches, not just backfills. For bulk rule-based backfills you can intentionally skip the doomed AI calls by unsetting `AI_INTEGRATIONS_OPENAI_API_KEY`/`_BASE_URL` for the run (isAiAvailable() → false → instant, no network).
