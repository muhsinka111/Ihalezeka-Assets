---
name: Tender search pagination accumulation
description: ihale-arama accumulates result pages; any new-query entry point must reset pagination
---

The search page (`artifacts/ihalezeka/src/pages/ihale-arama.tsx`) accumulates results across pages: the data effect appends `data.items` to `allItems` whenever `page !== 1` ("load more"). It does NOT replace on a new query by itself.

**Rule:** Any code path that changes the applied filters/query must call `resetPagination()` (sets page=1, clears allItems/liveItems). The in-page Apply button does this via `applyFilters`. The URL-sync effect (keyed on `useSearch()`) must ALSO reset, because external entry points — the global top-bar search in `AppShell.tsx` and deep links — navigate to `/ihale-arama?q=...` directly without going through `applyFilters`.

**Why:** Without the reset, submitting a new query while paged past page 1 mixes the previous query's accumulated items with the new query's page-N results.

**How to apply:** When adding any new way to drive the search URL/filters, either route it through `applyFilters`, or ensure `resetPagination()` runs on the URL change.
