---
name: Replit port routing & workflow readiness
description: How Replit monitors ports, routes proxy traffic, and what causes "Your app is starting..." for multi-artifact setups.
---

## Rule
Each artifact's **workflow process** must itself open the port declared in `[services.env] PORT`. Replit tracks which process opened which port — another process (different workflow) having the same port open does NOT satisfy the check.

**Why:** "Your app is starting…" persists indefinitely if the ihalezeka workflow never opens PORT. Replit's readiness monitor is per-workflow, not global TCP check.

**How to apply:** If an artifact's dev command is a build-only tool (e.g. `vite build --watch`), it will never open a port and will always show "starting…". The dev command MUST serve on PORT.

## Current Architecture (as of 2026-06-04)

| Artifact | Workflow command | Port | Role |
|---|---|---|---|
| ihalezeka | `pnpm run serve` → `vite build && vite preview` | 8080 | Frontend SPA + static assets |
| api-server | `pnpm run dev` | 9090 | REST API only (no static serving) |

- **ihalezeka** serves at path `/` (localPort=8080), PORT=8080 via `[services.env]`
- **api-server** runs internally on port 9090, paths=["/api"]. Replit proxy routes /api → 9090.
- **vite proxy**: ihalezeka's vite.config.ts proxies `/api` → `http://localhost:9090` (for local curl testing)
- **`[[ports]]` in .replit**: only 8080 and 8081 are listed. api-server on 9090 is NOT in [[ports]] → monitor shows "failed" but proxy routing still works.

## SPA fallback removed from api-server
api-server no longer serves static files. ihalezeka's `vite preview` handles all frontend serving.

## Clerk middleware
`clerkMiddleware()` with NO arguments (reads CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY from env directly). Dynamic `publishableKeyFromHost` was removed — it caused a mismatch/redirect-loop under Replit proxy headers.

## Express 5 SPA fallback (historical)
`app.use(handler)` not `app.get("*")` — path-to-regexp v8 rejects wildcards. No longer needed (static serving removed from api-server).

## Build note
`vite build --watch` does NOT open any port. Use `vite build && vite preview` as the dev command for a web artifact that needs to be served.
After any frontend source change: `pnpm --filter @workspace/ihalezeka run build` rebuilds dist/public. vite preview serves new files automatically (no restart needed).
