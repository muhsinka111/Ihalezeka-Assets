/**
 * Canonical public origin for İhaleZeka. Used by sitemap, robots, blog SSR,
 * and legal/marketing SSR pages so every absolute URL points at the same
 * domain regardless of the request host (proxy, preview, replit.app, etc.).
 *
 * Override with the SITE_URL env var if the canonical domain ever changes.
 */
export const SITE_URL = (process.env["SITE_URL"] ?? "https://ihalezeka.com").replace(/\/+$/, "");
