import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Fetches Stripe credentials.
 *
 * Resolution order:
 * 1. Direct environment variables STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
 *    (set manually as Replit secrets when the OAuth connector is not used).
 * 2. Replit connector API (REPLIT_CONNECTORS_HOSTNAME + REPL_IDENTITY /
 *    WEB_REPL_RENEWAL) — populated when the Stripe integration is connected
 *    via the Integrations tab.
 *
 * Not cached -- call fresh on every request so rotated keys are picked up.
 */
async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  // ── 1. Direct env vars (preferred when connector OAuth is not used) ──────
  // Accept several common names users might have chosen for the secret.
  const directKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.ST_LIVE_API_KEYRIPE ||
    process.env.STRIPE_SECRET ||
    process.env.STRIPE_API_KEY;
  if (directKey) {
    return {
      secretKey: directKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK,
    };
  }

  // ── 2. Replit connector API ───────────────────────────────────────────────
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
      {
        headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (resp.ok) {
      const data = (await resp.json()) as {
        items?: Array<{ settings?: { secret_key?: string; webhook_secret?: string } }>;
      };
      const settings = data.items?.[0]?.settings;
      if (settings?.secret_key) {
        return {
          secretKey: settings.secret_key,
          webhookSecret: settings.webhook_secret,
        };
      }
    }
  }

  throw new Error(
    "Stripe credentials not found. " +
      "Set STRIPE_SECRET_KEY as a Replit secret, or connect Stripe via the Integrations tab.",
  );
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
