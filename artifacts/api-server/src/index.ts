import app from "./app";
import { logger } from "./lib/logger";
import { ensureSearchObjects } from "./lib/search-bootstrap";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { isNull, sql, eq } from "drizzle-orm";

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
