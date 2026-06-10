import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  getUserId,
  getEntitlement,
  invalidateEntitlement,
  DEFAULT_USER_ID,
} from "../lib/authHelpers.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router = Router();

/** Email from the Clerk session claims, if any. */
function getSessionEmail(req: Parameters<typeof getAuth>[0]): string | undefined {
  const claims = getAuth(req as any).sessionClaims as Record<string, unknown> | null | undefined;
  const email = claims?.["email"];
  return typeof email === "string" ? email : undefined;
}

/** Build an absolute return URL from the browser origin + the app base path. */
function buildReturnUrl(req: any, path: string): string {
  const origin =
    (typeof req.headers.origin === "string" && /^https?:\/\//.test(req.headers.origin)
      ? req.headers.origin
      : `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? ""}`) || "";
  const base = String(req.body?.basePath ?? "").replace(/\/+$/, "");
  return `${origin}${base}${path}`;
}

/**
 * GET /api/billing/entitlement — the current user's plan.
 * `?fresh=1` bypasses the server-side cache (used right after checkout).
 */
router.get("/billing/entitlement", async (req, res) => {
  try {
    const fresh = req.query["fresh"] === "1" || req.query["fresh"] === "true";
    const { plan } = await getEntitlement(req, { fresh });
    res.json({ plan });
  } catch {
    res.json({ plan: "free" });
  }
});

/**
 * GET /api/billing/products — active products with their active prices, read
 * from the synced stripe.* tables. Returns an empty list before Stripe is
 * connected (schema absent) so the pricing page still renders.
 */
router.get("/billing/products", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id            AS product_id,
        p.name          AS product_name,
        p.description   AS product_description,
        pr.id           AS price_id,
        pr.unit_amount  AS unit_amount,
        pr.currency     AS currency,
        pr.recurring    AS recurring
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC NULLS LAST
    `);

    const map = new Map<string, any>();
    for (const row of (result as any).rows as any[]) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          prices: [] as any[],
        });
      }
      if (row.price_id) {
        map.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    res.json({ data: Array.from(map.values()) });
  } catch {
    res.json({ data: [] });
  }
});

/** Resolve the default Pro price id (cheapest active recurring price). */
async function resolveDefaultPriceId(): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id
    FROM stripe.prices
    WHERE active = true AND recurring IS NOT NULL
    ORDER BY unit_amount ASC NULLS LAST
    LIMIT 1
  `);
  return ((result as any).rows?.[0]?.id as string | undefined) ?? null;
}

/** Ensure a users row exists and has a Stripe customer; returns the customer id. */
async function ensureStripeCustomer(userId: string, email?: string): Promise<string> {
  await db
    .insert(usersTable)
    .values({ userId, email: email ?? null })
    .onConflictDoNothing({ target: usersTable.userId });

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: email ?? user?.email ?? undefined,
    metadata: { userId },
  });

  await db
    .update(usersTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(usersTable.userId, userId));

  return customer.id;
}

/** Reject billing actions for the dev-bypass user in production. */
function ensureRealUser(req: any, res: any): string | null {
  const userId = getUserId(req);
  if (process.env["NODE_ENV"] === "production" && userId === DEFAULT_USER_ID) {
    res.status(401).json({ error: "auth_required" });
    return null;
  }
  return userId;
}

/**
 * POST /api/billing/checkout — start a Stripe Checkout session for the Pro
 * subscription. Body: { priceId?, basePath? }. Returns { url }.
 */
router.post("/billing/checkout", async (req, res) => {
  const userId = ensureRealUser(req, res);
  if (!userId) return;

  try {
    const priceId = (req.body?.priceId as string | undefined) ?? (await resolveDefaultPriceId());
    if (!priceId) {
      return res.status(503).json({ error: "no_price_configured" });
    }

    const email = getSessionEmail(req);
    const customerId = await ensureStripeCustomer(userId, email);

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: buildReturnUrl(req, "/ihale-arama?checkout=success"),
      cancel_url: buildReturnUrl(req, "/fiyatlandirma?checkout=cancel"),
      allow_promotion_codes: true,
    });

    invalidateEntitlement(userId);
    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "checkout_failed" });
  }
});

/**
 * POST /api/billing/portal — open the Stripe billing portal so the user can
 * manage or cancel their subscription. Body: { basePath? }. Returns { url }.
 */
router.post("/billing/portal", async (req, res) => {
  const userId = ensureRealUser(req, res);
  if (!userId) return;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: "no_customer" });
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: buildReturnUrl(req, "/fiyatlandirma"),
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    res.status(500).json({ error: "portal_failed" });
  }
});

export default router;
