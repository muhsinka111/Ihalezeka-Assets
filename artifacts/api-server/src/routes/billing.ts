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
import { logger } from "../lib/logger.js";

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
 * Fetch active products + prices directly from the Stripe API.
 * Used as a fallback when the stripe.* synced tables don't exist yet.
 */
async function getProductsFromStripeApi(): Promise<any[]> {
  const stripe = await getUncachableStripeClient();
  const proProductId = process.env["STRIPE_PRO_PRODUCT_ID"];

  const [products, prices] = await Promise.all([
    stripe.products.list({ active: true, limit: 20 }),
    stripe.prices.list({ active: true, limit: 100 }),
  ]).catch((err) => {
    logger.warn({ err }, "Stripe API products/prices list failed (restricted key?)");
    throw err;
  });

  // Filter to just the İhaleZeka Pro product
  const filteredProducts = proProductId
    ? products.data.filter((p) => p.id === proProductId)
    : products.data.filter((p) => p.name.toLowerCase().includes("ihalezeka"));

  const pricesByProduct = new Map<string, any[]>();
  for (const price of prices.data) {
    const pid = typeof price.product === "string" ? price.product : price.product.id;
    if (!pricesByProduct.has(pid)) pricesByProduct.set(pid, []);
    pricesByProduct.get(pid)!.push({
      id: price.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      recurring: price.recurring ? { interval: price.recurring.interval } : null,
    });
  }

  return filteredProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    prices: (pricesByProduct.get(p.id) ?? []).sort(
      (a: any, b: any) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0),
    ),
  }));
}

/**
 * Build a synthetic products list from the STRIPE_DEFAULT_PRICE_ID or
 * STRIPE_PAYMENT_LINK env var. Used as the final fallback when both DB tables
 * and Stripe API are unavailable (e.g. restricted key without read permission).
 * Returns a product with unitAmount=null so the frontend uses its $99 fallback.
 */
function getProductsFromEnvFallback(): any[] {
  const priceId = process.env["STRIPE_DEFAULT_PRICE_ID"];
  const paymentLink = process.env["STRIPE_PAYMENT_LINK"];
  if (!priceId && !paymentLink) return [];
  return [
    {
      id: "pro",
      name: "İhaleZeka Pro",
      description: null,
      prices: [
        {
          id: priceId ?? "payment_link",
          unitAmount: 9900,
          currency: "usd",
          recurring: { interval: "month" },
        },
      ],
    },
  ];
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
 * GET /api/billing/products — active products with their active prices.
 * Filters to the designated İhaleZeka Pro product (STRIPE_PRO_PRODUCT_ID env var,
 * or the product whose name contains "ihalezeka" case-insensitively).
 * Tries the synced stripe.* tables first; falls back to a live Stripe API call.
 */
router.get("/billing/products", async (_req, res) => {
  // ── Try synced DB tables first ────────────────────────────────────────────
  try {
    const proProductId = process.env["STRIPE_PRO_PRODUCT_ID"];
    const productFilter = proProductId
      ? sql`AND p.id = ${proProductId}`
      : sql`AND lower(p.name) LIKE '%ihalezeka%'`;

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
      WHERE p.active = true ${productFilter}
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

    const dbProducts = Array.from(map.values());
    if (dbProducts.length > 0) {
      return res.json({ data: dbProducts });
    }
    // DB tables exist but are empty — fall through to API fallback
  } catch {
    // stripe.* tables don't exist yet — fall through to API fallback
  }

  // ── Fall back to live Stripe API ──────────────────────────────────────────
  try {
    const apiProducts = await getProductsFromStripeApi();
    if (apiProducts.length > 0) return res.json({ data: apiProducts });
  } catch {
    // Stripe API unavailable or permission denied — fall through to env fallback
  }

  // ── Final fallback: STRIPE_DEFAULT_PRICE_ID env var ───────────────────────
  return res.json({ data: getProductsFromEnvFallback() });
});

/**
 * Resolve the default Pro price id for İhaleZeka.
 * Prefers STRIPE_DEFAULT_PRICE_ID env var if set, then synced DB (filtered to
 * the ihalezeka product), then live Stripe API (also filtered by product name).
 */
async function resolveDefaultPriceId(): Promise<string | null> {
  // ── Explicit env override always wins ─────────────────────────────────────
  const envPriceId = process.env["STRIPE_DEFAULT_PRICE_ID"];
  if (envPriceId) return envPriceId;

  const proProductId = process.env["STRIPE_PRO_PRODUCT_ID"];

  // ── Try synced DB table ───────────────────────────────────────────────────
  try {
    const productFilter = proProductId
      ? sql`AND pr.product = ${proProductId}`
      : sql`AND lower(p.name) LIKE '%ihalezeka%'`;

    const result = await db.execute(sql`
      SELECT pr.id
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE pr.active = true AND pr.recurring IS NOT NULL
        ${productFilter}
      ORDER BY pr.unit_amount ASC NULLS LAST
      LIMIT 1
    `);
    const id = (result as any).rows?.[0]?.id as string | undefined;
    if (id) return id;
  } catch {
    // stripe.prices table doesn't exist yet
  }

  // ── Fall back to live Stripe API ──────────────────────────────────────────
  try {
    const stripe = await getUncachableStripeClient();
    if (proProductId) {
      const prices = await stripe.prices.list({
        active: true,
        type: "recurring",
        product: proProductId,
        limit: 10,
      });
      if (prices.data[0]?.id) return prices.data[0].id;
    } else {
      // Search all products, find the one named *ihalezeka*
      const products = await stripe.products.list({ active: true, limit: 20 });
      const proProduct = products.data.find((p) =>
        p.name.toLowerCase().includes("ihalezeka"),
      );
      if (proProduct) {
        const prices = await stripe.prices.list({
          active: true,
          type: "recurring",
          product: proProduct.id,
          limit: 10,
        });
        if (prices.data[0]?.id) return prices.data[0].id;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Stripe prices list failed; checking STRIPE_DEFAULT_PRICE_ID");
  }

  return null;
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
 *
 * Falls back to STRIPE_PAYMENT_LINK when no dynamic session can be created
 * (e.g. restricted API key without checkout-session write permission).
 */
router.post("/billing/checkout", async (req, res) => {
  const userId = ensureRealUser(req, res);
  if (!userId) return;

  try {
    const bodyPriceId = req.body?.priceId as string | undefined;
    const priceId = bodyPriceId ?? (await resolveDefaultPriceId());

    // ── If priceId is the payment-link sentinel or we have the env var set,
    //    redirect directly to the static Stripe payment link. ──────────────
    const paymentLink = process.env["STRIPE_PAYMENT_LINK"];
    if (priceId === "payment_link" || (!priceId && paymentLink)) {
      if (paymentLink) {
        invalidateEntitlement(userId);
        return res.json({ url: paymentLink });
      }
      return res.status(503).json({ error: "no_price_configured" });
    }

    if (!priceId) {
      // No price from DB, API, or env — last resort: try payment link
      if (paymentLink) {
        invalidateEntitlement(userId);
        return res.json({ url: paymentLink });
      }
      return res.status(503).json({ error: "no_price_configured" });
    }

    // ── Attempt dynamic Stripe Checkout session ───────────────────────────
    try {
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
      return res.json({ url: session.url });
    } catch (sessionErr) {
      // Dynamic session failed — fall back to payment link if configured
      logger.warn({ err: sessionErr }, "Checkout session creation failed; trying payment link");
      if (paymentLink) {
        invalidateEntitlement(userId);
        return res.json({ url: paymentLink });
      }
      throw sessionErr;
    }
  } catch (err) {
    logger.error({ err }, "Checkout error");
    res.status(500).json({ error: "checkout_failed" });
  }
});

/**
 * GET /api/billing/config — return the Stripe publishable key so the frontend
 * can initialise Stripe.js without baking the key into the build.
 */
router.get("/billing/config", (_req, res) => {
  const publishableKey = process.env["STRIPE_PUBLISHABLE_KEY"] ?? "";
  res.json({ publishableKey });
});

/**
 * POST /api/billing/checkout-session — create an embedded Stripe Checkout
 * session and return { clientSecret } so the frontend can mount
 * <EmbeddedCheckout> without redirecting away from the site.
 * Falls back to { error: "no_publishable_key" } if STRIPE_PUBLISHABLE_KEY
 * is not set (caller should use the redirect-based /checkout instead).
 */
/**
 * POST /api/billing/checkout-session — create a hosted Stripe Checkout session
 * and return { url } so the frontend can redirect to Stripe for payment.
 * (Embedded checkout is disabled because the Stripe SDK version is too old for
 * the new embedded_page API; revert to hosted once the SDK is upgraded.)
 */
router.post("/billing/checkout-session", async (req, res) => {
  const userId = ensureRealUser(req, res);
  if (!userId) return;

  if (!process.env["STRIPE_PUBLISHABLE_KEY"]) {
    return res.status(503).json({ error: "no_publishable_key" });
  }

  try {
    const bodyPriceId = req.body?.priceId as string | undefined;
    const priceId = bodyPriceId ?? (await resolveDefaultPriceId());

    if (!priceId || priceId === "payment_link") {
      return res.status(503).json({ error: "no_price_configured" });
    }

    const email = getSessionEmail(req);
    const customerId = await ensureStripeCustomer(userId, email);
    logger.info({ userId, customerId, priceId }, "Creating hosted checkout session");

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
  } catch (err: any) {
    logger.error({ err: err?.message ?? err, code: err?.code, type: err?.type }, "Checkout session error");
    res.status(500).json({ error: "checkout_failed", detail: err?.message ?? "unknown" });
  }
});

/**
 * GET /api/billing/subscription — return the active Stripe subscription for
 * the signed-in user so the frontend can show plan details and billing date.
 */
router.get("/billing/subscription", async (req, res) => {
  const userId = getUserId(req);

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    if (!user?.stripeCustomerId) {
      return res.json({ subscription: null });
    }

    const stripe = await getUncachableStripeClient();
    const list = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "all",
      limit: 1,
      expand: ["data.default_payment_method"],
    });

    const sub = list.data[0];
    if (!sub) return res.json({ subscription: null });

    const item = sub.items.data[0];
    const pm = sub.default_payment_method as any;

    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        amount: item?.price.unit_amount,
        currency: item?.price.currency,
        interval: item?.price.recurring?.interval,
        cardBrand: pm?.card?.brand ?? null,
        cardLast4: pm?.card?.last4 ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "Subscription fetch error");
    res.status(500).json({ error: "fetch_failed" });
  }
});

/**
 * POST /api/billing/cancel — cancel the active subscription at the end of the
 * current billing period (not immediately). Returns { cancelAtPeriodEnd: true }.
 */
router.post("/billing/cancel", async (req, res) => {
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
    const list = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    const sub = list.data[0];
    if (!sub) return res.status(404).json({ error: "no_subscription" });

    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    invalidateEntitlement(userId);
    res.json({ success: true, cancelAtPeriodEnd: true });
  } catch (err) {
    logger.error({ err }, "Cancel subscription error");
    res.status(500).json({ error: "cancel_failed" });
  }
});

/**
 * POST /api/billing/reactivate — undo a pending cancellation so the
 * subscription renews normally at period end.
 */
router.post("/billing/reactivate", async (req, res) => {
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
    const list = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 1,
    });

    const sub = list.data[0];
    if (!sub) return res.status(404).json({ error: "no_subscription" });

    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    invalidateEntitlement(userId);
    res.json({ success: true, cancelAtPeriodEnd: false });
  } catch (err) {
    logger.error({ err }, "Reactivate subscription error");
    res.status(500).json({ error: "reactivate_failed" });
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
    // Resolve email from session claims so we can create a customer if needed.
    const email = getSessionEmail(req);

    // Create a Stripe customer on-the-fly if the user has never gone through
    // checkout (e.g. dev/force-pro accounts, or webhook delivery gap).
    const customerId = await ensureStripeCustomer(userId, email);

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: buildReturnUrl(req, "/fiyatlandirma"),
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Portal error:", err);
    // If the Stripe billing portal isn't configured in the dashboard, surface
    // a specific code so the frontend can fall back to the payment link.
    const stripeCode = err?.raw?.code ?? err?.code ?? "";
    if (stripeCode === "configuration_not_found" || stripeCode === "portal_configuration_not_found") {
      return res.status(503).json({ error: "portal_not_configured" });
    }
    res.status(500).json({ error: "portal_failed" });
  }
});

export default router;
