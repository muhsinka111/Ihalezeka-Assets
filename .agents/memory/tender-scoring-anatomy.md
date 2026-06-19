---
name: Tender scoring match-anatomy
description: How İhaleZeka computes the weighted "eşleşme anatomisi" fit score and its AI/rule hybrid + fallback contract
---

# Tender scoring "eşleşme anatomisi"

The overall `fitScore` is ALWAYS the weighted average of the six breakdown sub-scores
(`weightedFitScore(breakdown)`), for BOTH the AI path and the rule-based path. Never
trust the model's headline `fitScore` directly.

**Why:** the transparent breakdown UI (MatchAnatomyCard) and the headline % must stay
consistent — if you persisted the model's own headline number it could disagree with the
bars the user sees. Deriving it from the breakdown guarantees one reliable figure.

**How to apply:**
- Six canonical dimensions with fixed weights (sum = 100): cpv 25, experience 20,
  financial 20, geographic 15, timing 10, method 10 (`BREAKDOWN_WEIGHTS` /
  `BREAKDOWN_ORDER` in `tenderScorer.ts`). If you add/remove a dimension, update both and
  the openapi `ScoreBreakdownItem` enum + the DB has no enum (jsonb), so no migration.
- Hybrid: `computeRuleSignals()` produces structured pre-signals injected into the prompt;
  the AI validates/uses them. `normaliseBreakdown()` re-imposes canonical order/labels/
  weights and falls back per-dimension to the rule sub-score when the model omits/garbles one.
- Fallback is non-degraded: `computeRuleBasedScore()` returns the FULL shape (winnability,
  reasoning, pros, risks, breakdown[6], checklist) so an AI outage still yields a complete
  match anatomy.
- AI failures are retried (3 attempts, backoff) and the final rule fallback is logged at
  error level — never a silent fallback (that silent swallow was the original bug).
- Persisted fields live on `matchesTable`: `winnability` text, `breakdown` jsonb
  (`MatchBreakdownItem[]`), `checklist` text[]. Surfaced via openapi `Match` schema → codegen.
