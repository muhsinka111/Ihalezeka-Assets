/**
 * Whether the dev-only admin login (one-click sign-in via /admin/dev-token) may
 * be shown. The preview build runs in Vite production mode (`vite build`), so
 * `import.meta.env.DEV` is false even inside the Replit workspace — we can't
 * rely on it. Instead detect the Replit dev domain / localhost at runtime.
 * Deployed apps (*.replit.app or a custom domain) are excluded, matching the
 * backend's NODE_ENV gate on the token endpoint.
 */
export function isDevLoginEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".replit.dev");
}
