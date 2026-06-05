---
name: React Query invalidation keys (generated client)
description: How to build queryKey arrays for invalidateQueries against the orval-generated React Query hooks
---

The orval-generated React Query hooks key their queries by the **full request path including the `/api` prefix**, e.g. `["/api/pipeline"]`, `["/api/dashboard/stats"]` — NOT the bare route (`["/pipeline"]`).

**Why:** `queryClient.invalidateQueries({ queryKey: [...] })` silently no-ops if the key prefix doesn't match. Using the bare path means the UI never refetches after a mutation, looking like a stale-data bug with no error.

**How to apply:** When invalidating after a mutation (e.g. add-to-pipeline), confirm the key against `getXxxQueryKey()` in `lib/api-client-react/src/generated/api.ts` before using it. Invalidate every dependent dashboard key together: `/api/pipeline`, `/api/dashboard/stats`, `/api/dashboard/pipeline-summary`, `/api/dashboard/win-predictions`.
