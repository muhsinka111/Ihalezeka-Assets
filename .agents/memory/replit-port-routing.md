---
name: Replit port routing and workflow monitor quirks
description: How Replit proxy routing and workflow monitor work together, and why ports not in [[ports]] fail detection
---

## Rule
New Vite/frontend artifacts assigned ports NOT listed in `.replit` `[[ports]]` will always fail with "DIDNT_OPEN_A_PORT" — even when the dev server starts successfully. The workflow monitor cannot TCP-detect ports outside the registered `[[ports]]` set. Direct edits to `.replit` are blocked.

**Why:** The workflow monitor runs in a different network namespace. Only ports listed in `[[ports]]` have a network bridge the monitor can reach. `createArtifact()` does NOT automatically add ports to `[[ports]]`.

## How to apply
When a react-vite artifact gets an unregistered port (e.g. 24180) and the workflow constantly fails:

1. **Serve the frontend from the api-server** (already on port 8080, which IS in `[[ports]]`):
   - Build the frontend: `pnpm --filter @workspace/<slug> run build`
   - Add `express.static(FRONTEND_DIST)` + `app.use((_req,res) => res.sendFile(index.html))` to api-server's `app.ts` AFTER the `/api` router
   - Express 5 SPA fallback: use `app.use(handler)` not `app.get("*", ...)` — path-to-regexp v8 rejects both `*` and `(.*)`

2. **Update the ihalezeka artifact.toml to point localPort to 8080** using `verifyAndReplaceArtifactToml`:
   - Change `localPort = 24180` → `localPort = 8080` in the `[[services]]` block
   - The Replit proxy will then route "/" to port 8080 (api-server)
   - The ihalezeka workflow can remain "failed" — proxy routing works regardless

3. **Vite config PORT guard**: Remove the `throw new Error` if PORT is unset — use defaults (`?? "24180"`) so `vite build` works without env vars being set.

## SPA fallback ordering (api-server serves frontend + /api)
When one Express server serves both `/api` and the SPA shell, the catch-all index.html handler must NOT swallow API/asset/non-GET requests:
- Mount a JSON 404 handler on `/api` AFTER the router, so unknown API routes return JSON 404 instead of the HTML shell.
- Guard the SPA fallback: only serve index.html for `GET`/`HEAD` requests where `req.accepts("html")`; otherwise `next()`. This keeps missing assets and non-GET methods on Express's default 404 rather than returning HTML 200.

## Clerk handshake 307 is expected on non-root routes (not a bug)
With global `clerkMiddleware`, a `curl` (no cookie jar) to SPA routes like `/dashboard` returns `307` to `*.clerk.accounts.dev/v1/client/handshake` (`x-clerk-auth-reason: dev-browser-missing`). A real browser follows it, sets the session cookie, and lands fine — confirmed by working preview screenshots. Don't chase this 307 as a routing/fallback bug; only `/` returns 200 directly in curl.

## build:watch caveat
ihalezeka dev command is `vite build --watch` (no port). `emptyOutDir: true` can cause brief 404s on assets during the ~50s rebuild window while api-server serves `dist/public`. Minor dev-time only; production uses the static `serve` config, so left as-is.
