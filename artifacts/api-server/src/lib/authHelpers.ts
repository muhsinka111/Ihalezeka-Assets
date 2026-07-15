import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql, gt, and } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient.js";

/**
 * Returns the businessId to scope all queries against.
 *
 * For authenticated sessions the userId IS the businessId (1:1).
 * For the dev-bypass sentinel ("demo-user") we return "demo-business" so that
 * all existing seed data remains accessible during local development — the same
 * mapping already applied in companyProfile.ts.
 *
 * Real users start with empty state and build their own data under their
 * userId; no "demo-business" data is ever surfaced to them.
 */
export function getBusinessId(req: Request): string {
  const userId = getUserId(req);
  if (userId === DEFAULT_USER_ID) return "demo-business";
  return userId;
}

/**
 * Shared sentinel for the anonymous/dev-bypass user.
 *
 * DEV BYPASS: while the frontend auth gate is disabled (VITE_BYPASS_AUTH), every
 * visitor resolves to this single id. That means one Stripe checkout flips
 * EVERYONE to Pro. This is acceptable for the current pre-launch phase. In
 * production the billing routes refuse to operate for this sentinel so
 * checkout/portal require a real authenticated session.
 */
export const DEFAULT_USER_ID = "demo-user";

/**
 * Centralized resolver for the current user's id. Returns the session userId
 * (attached by sessionAuthMiddleware) when a valid session cookie is present,
 * otherwise the shared dev-bypass sentinel.
 */
export function getUserId(req: Request): string {
  return req.authUserId ?? DEFAULT_USER_ID;
}

/**
 * Express middleware that requires a verified session. Returns 401 for any
 * request without a valid session cookie. Use this on credit-gated or
 * user-scoped endpoints that are available to both free and Pro users, as an
 * alternative to the stronger `requirePro` guard.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUserId) {
    res.status(401).json({ error: "auth_required", message: "Giriş yapmanız gerekiyor." });
    return;
  }
  next();
}

// ── Entitlement (free vs pro) ──────────────────────────────────────────────

export type Plan = "free" | "pro";

interface CacheEntry {
  plan: Plan;
  expiresAt: number;
}

// Short-lived in-memory cache so we don't hit the DB on every gated request.
const ENTITLEMENT_TTL_MS = 30_000;
const entitlementCache = new Map<string, CacheEntry>();

/** Drop a user's cached entitlement (call after checkout / webhook changes). */
export function invalidateEntitlement(userId: string): void {
  entitlementCache.delete(userId);
}

/**
 * Resolve a user's plan.
 *
 * Source of truth is the SYNCED `stripe.subscriptions` table (populated by
 * stripe-replit-sync via webhooks + backfill), NOT a live Stripe API call. A
 * user is Pro when their Stripe customer has any subscription in status
 * `active` or `trialing` (we sell a single Pro product, so any live
 * subscription ⇒ Pro).
 *
 * Robustness:
 *  - `ENTITLEMENTS_FORCE_PLAN=pro|free` short-circuits everything (used for
 *    local testing before Stripe is connected, and to verify gating).
 *  - Before Stripe is connected the `stripe` schema does not exist; the query
 *    throws and we fail closed to `free` so the app still boots and serves.
 */
export async function getEntitlement(
  req: Request,
  opts: { fresh?: boolean } = {},
): Promise<{ plan: Plan }> {
  const forced = process.env["ENTITLEMENTS_FORCE_PLAN"];
  if (forced === "pro" || forced === "free") return { plan: forced };

  const userId = getUserId(req);

  if (!opts.fresh) {
    const cached = entitlementCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return { plan: cached.plan };
  }

  let plan: Plan = "free";
  try {
    const rows = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId, isProOverride: usersTable.isProOverride })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    // Admin-granted Pro override (for testing without a real Stripe subscription)
    if (rows[0]?.isProOverride) {
      plan = "pro";
    } else {
      const customerId = rows[0]?.stripeCustomerId;
      if (customerId) {
        let checkedViaDb = false;
        // ── Try synced stripe.subscriptions table first ─────────────────────
        try {
          const result = await db.execute(sql`
            SELECT 1
            FROM stripe.subscriptions
            WHERE customer = ${customerId}
              AND status IN ('active', 'trialing')
            LIMIT 1
          `);
          checkedViaDb = true;
          if (((result as any).rows?.length ?? 0) > 0) plan = "pro";
        } catch {
          // stripe.subscriptions table not present yet — fall through to API
        }

        // ── Fall back to live Stripe API if DB table absent ─────────────────
        if (!checkedViaDb) {
          try {
            const stripe = await getUncachableStripeClient();
            const subs = await stripe.subscriptions.list({
              customer: customerId,
              status: "active",
              limit: 1,
            });
            if (subs.data.length > 0) plan = "pro";
          } catch {
            // Stripe not connected — fail closed to free
          }
        }
      } else {
        // ── No stored customerId — user may have paid via a payment link
        //    (which creates a fresh Stripe customer not yet linked to our DB).
        //    Search Stripe by the user's email as a best-effort check. ─────────
        const userEmail = rows[0] ? (await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.userId, userId))
          .limit(1)
          .then(r => r[0]?.email)) : undefined;

        if (userEmail) {
          try {
            const stripe = await getUncachableStripeClient();
            const customers = await stripe.customers.list({ email: userEmail, limit: 5 });
            for (const cust of customers.data) {
              const subs = await stripe.subscriptions.list({
                customer: cust.id,
                status: "active",
                limit: 1,
              });
              if (subs.data.length > 0) {
                // Link this Stripe customer to the user so future lookups are faster
                await db
                  .update(usersTable)
                  .set({ stripeCustomerId: cust.id })
                  .where(eq(usersTable.userId, userId));
                plan = "pro";
                break;
              }
            }
          } catch {
            // Stripe API not accessible — fail closed to free
          }
        }
      }
    }
  } catch {
    // Transient DB error — fail closed to free.
    plan = "free";
  }

  entitlementCache.set(userId, { plan, expiresAt: Date.now() + ENTITLEMENT_TTL_MS });
  return { plan };
}

/** Convenience boolean form of {@link getEntitlement}. */
export async function isPro(req: Request): Promise<boolean> {
  return (await getEntitlement(req)).plan === "pro";
}

/**
 * Express middleware that blocks non-Pro users from a premium endpoint with a
 * `402 Payment Required` carrying `{ error: "upgrade_required" }`. The frontend
 * treats this status as "show the paywall / upgrade CTA".
 */
export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (await isPro(req)) {
      next();
      return;
    }
  } catch {
    // fall through to 402
  }
  res.status(402).json({ error: "upgrade_required" });
}

// ── Credit system ─────────────────────────────────────────────────────────

/**
 * Ensure a row exists in the users table for the given userId and return its
 * current search_credits balance.
 */
async function ensureUserRow(userId: string): Promise<number> {
  await db
    .insert(usersTable)
    .values({ userId, searchCredits: 2 })
    .onConflictDoNothing({ target: usersTable.userId });

  const [row] = await db
    .select({ searchCredits: usersTable.searchCredits })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  return row?.searchCredits ?? 2;
}

/**
 * Attempt to consume one AI search credit for a free-tier user.
 *
 * - Pro users: always pass through (returns `{ ok: true }`).
 * - Free user with credits > 0: deducts 1 and returns `{ ok: true, remaining }`.
 * - Free user at 0: returns `{ ok: false }` — caller must respond with 402.
 *
 * Uses an atomic UPDATE … WHERE search_credits > 0 so concurrent requests
 * cannot over-spend credits.
 */
export async function consumeCredit(
  req: Request,
): Promise<{ ok: true; remaining?: number } | { ok: false }> {
  const proStatus = await isPro(req);
  if (proStatus) return { ok: true };

  const userId = getUserId(req);
  const current = await ensureUserRow(userId);
  if (current <= 0) return { ok: false };

  const result = await db
    .update(usersTable)
    .set({ searchCredits: sql`GREATEST(search_credits - 1, 0)` })
    .where(and(eq(usersTable.userId, userId), gt(usersTable.searchCredits, 0)))
    .returning({ searchCredits: usersTable.searchCredits });

  if (result.length === 0) return { ok: false };
  return { ok: true, remaining: result[0].searchCredits };
}

// ── Free-tier masking ──────────────────────────────────────────────────────

/**
 * Allowlist of tender fields a FREE user may receive. Everything else
 * (description, documents, contact, rawData, aiSummary, qualification/required
 * docs, etc.) is premium and must never be serialized to a free user.
 *
 * This is an ALLOWLIST projection on purpose: new premium columns added to the
 * tenders table are withheld by default rather than accidentally leaked.
 */
const FREE_TENDER_FIELDS = [
  "id",
  "ikn",
  "title",
  "agencyName",
  "agencyLogoUrl",
  "type",
  "method",
  "procurementMethod",
  "estimatedValue",
  "deadline",
  "cpvCodes",
  "il",
  "status",
  "category",
  "sourceSystem",
  "sourceUrl",
  "createdAt",
  "updatedAt",
  "lastFetchedAt",
  "relevance",
  "_isLive",
] as const;

const SUMMARY_MAX = 240;

/**
 * Project a tender (DB row or live-search item) down to the free allowlist,
 * plus a short truncated `summary` derived from the full description. Never
 * returns premium fields.
 */
export function maskTenderForFree<T extends Record<string, any>>(
  tender: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FREE_TENDER_FIELDS) {
    if (key in tender) out[key] = tender[key];
  }
  const desc = typeof tender["description"] === "string" ? (tender["description"] as string) : null;
  out["summary"] = desc
    ? desc.slice(0, SUMMARY_MAX) + (desc.length > SUMMARY_MAX ? "…" : "")
    : null;
  return out;
}
