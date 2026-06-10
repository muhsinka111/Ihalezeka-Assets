---
name: Express router-level middleware leak
description: Why a bare router.use(mw) inside a sub-router mounted at "/" gates unrelated sibling routers, and how to scope it
---

# Express router-level gate leak

When sub-routers are all mounted at the root path in a parent router (e.g.
`parent.use(dashboardRouter); parent.use(tendersRouter); ...`), a request is
passed **through every sub-router mounted at `/`** in order until one sends a
response. So a bare `subRouter.use(middleware)` (no path) inside any of those
sub-routers runs for **every** request that reaches it — not just that router's
own routes.

Concretely: a premium router with a top-level `router.use(requirePro)` that 402s
for free users will block requests destined for *other* routers mounted after it
(and if it is mounted first, it blocks the entire API). This silently broke the
free tier — free `/api/tenders` returned 402 because an earlier-mounted router's
bare `requirePro` fired first.

**Why:** `router.use(fn)` with no path matches all paths; `parent.use(subRouter)`
mounts at `/`, so the request enters every such sub-router's middleware stack. A
gate that doesn't call `next()` ends the request there.

**How to apply:** Scope the gate to the router's own path prefix
(`router.use("/dashboard", requirePro)`), or apply it per-route
(`router.get("/x", requirePro, handler)`). Never use a bare `router.use(gate)` in
a sub-router that is mounted at `/` alongside siblings. Verify with curl that a
free/unauthorized request to a *different* router still succeeds.
