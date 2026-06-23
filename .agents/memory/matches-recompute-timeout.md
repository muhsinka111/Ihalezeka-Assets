---
name: matches recompute must be fire-and-forget
description: Why the user-triggered match recompute endpoint cannot await scoreNewTenders
---

A full match recompute (POST /matches/recompute, "Eşleşmeleri Yenile" button) scores
every tender for one business. The scorer writes one match row per tender-profile pair
via an individual upsert loop, so a single business = ~15k upserts that take well over
2 minutes — far past any HTTP/tool timeout.

**Rule:** any user- or endpoint-triggered full recompute must be fire-and-forget:
return 202 immediately, run scoreNewTenders in the background guarded by an in-flight
Set per businessId, and have the client poll/invalidate on a delay. Never `await` it
inside the request handler. The same constraint blocks running it synchronously inside
one shell/tool call — scope a one-off recompute per business and expect it to exceed
a 120s tool timeout (auto-committed upserts still persist, so partial runs accumulate).

**Why:** awaiting the full scoreNewTenders hangs the request past timeout; the button
appeared to fail even though work continued server-side.

**How to apply:** for offline/ops recomputes use a scoped script
(artifacts/api-server/scripts/recompute-business.ts <businessId>) run with AI disabled
via `env -u AI_INTEGRATIONS_ANTHROPIC_BASE_URL -u AI_INTEGRATIONS_ANTHROPIC_API_KEY`
for free rule-based scoring. Production is a separate DB and needs this recompute
post-deploy. Stale flat-score rows have the signature: empty `breakdown` jsonb + a
constant fit_score (e.g. 45/65) — detect and rescore just those.
