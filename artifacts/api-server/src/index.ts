import app from "./app";
import { logger } from "./lib/logger";
import { ensureSearchObjects } from "./lib/search-bootstrap";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { isNull, sql, eq } from "drizzle-orm";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient";

/**
 * Initialize the synced Stripe schema and kick off a background backfill.
 * Wrapped by the caller in try/catch: before the Stripe integration is
 * connected (no credentials) this throws, and the server must still boot —
 * entitlement then fails closed to "free".
 */
async function initStripe() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe");

  // Step 1: create stripe.* schema and tables (idempotent DDL).
  await runMigrations({ databaseUrl });
  logger.info("Stripe schema ready");

  // Step 2: initialise the sync client.
  const stripeSync = await getStripeSync();

  // Step 3: auto-register a webhook endpoint for this environment (non-fatal).
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) {
    try {
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `https://${domain}/api/stripe/webhook`,
      );
      logger.info(
        { url: webhookResult?.url ?? "setup complete" },
        "Stripe webhook configured",
      );
    } catch (err) {
      logger.warn({ err }, "Stripe webhook auto-registration failed (non-fatal)");
    }
  }

  // Step 4: backfill current Stripe data into synced tables (background, non-blocking).
  stripeSync
    .syncBackfill()
    .then(() => logger.info("Stripe data synced"))
    .catch((err) => logger.warn({ err }, "Stripe backfill failed (non-fatal)"));
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await ensureSearchObjects();
    logger.info("Search objects ensured (pg_trgm, unaccent, f_unaccent, indexes)");
  } catch (err) {
    logger.error({ err }, "Failed to ensure search objects; fuzzy search may be degraded");
  }

  // Stripe is optional at boot: before the integration is connected this throws
  // (missing credentials). Swallow it so the rest of the app still serves;
  // entitlement then resolves to "free" until Stripe is wired up.
  try {
    await initStripe();
    logger.info("Stripe initialized");
  } catch (err) {
    logger.warn({ err }, "Stripe not initialized (integration likely not connected yet)");
  }

  // One-time backfill: set sourceUrl for EKAP rows where it is null.
  // The hash ID lives in raw_data->>'id' and maps to the EKAP v2 detail URL.
  try {
    const result = await db.execute(sql`
      UPDATE tenders
      SET source_url = 'https://ekapv2.kik.gov.tr/ekap/detay/' || ikn
      WHERE source_system = 'ekap'
        AND (source_url IS NULL OR source_url = '')
        AND ikn IS NOT NULL
        AND ikn != ''
    `);
    const count = (result as any).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Backfilled EKAP sourceUrl for rows with null sourceUrl");
  } catch (err) {
    logger.error({ err }, "EKAP sourceUrl backfill failed (non-fatal)");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
