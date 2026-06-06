import app from "./app";
import { logger } from "./lib/logger";
import { ensureSearchObjects } from "./lib/search-bootstrap";

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
    // Non-fatal: log loudly but still start so the rest of the API works.
    logger.error({ err }, "Failed to ensure search objects; fuzzy search may be degraded");
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
