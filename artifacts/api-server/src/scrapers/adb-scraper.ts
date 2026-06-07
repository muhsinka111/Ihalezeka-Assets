import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

/**
 * ADB (Asian Development Bank) procurement notices.
 *
 * STATUS: DISABLED — intentionally makes no HTTP requests.
 *
 * ADB's procurement listing page (www.adb.org/projects/tenders) renders a
 * <div data-content="tenders" class="searchstax-site-search"> placeholder.
 * Actual notice content is loaded client-side by the SearchStax cloud search
 * widget; the Solr/JS SDK makes authenticated requests to a private SearchStax
 * cluster URL and API key that are not exposed in drupalSettings or in the
 * minified JS bundle.
 *
 * Verified: 2026-06-07 — fetched /projects/tenders (63 KB), confirmed SPA
 * placeholder, zero server-rendered notice rows.  No public ADB REST/RSS feed
 * for procurement is documented as of this date.
 *
 * Re-enable when: ADB publishes a public procurement API / RSS feed, or the
 * SearchStax cluster URL is discovered through JS analysis / browser DevTools.
 * Until then the source is kept in SOURCE_LABELS (admin visibility) but the
 * scraper exits immediately so it does not consume network budget on a known-
 * empty HTTP round-trip.
 */
const DISABLED_REASON =
  "disabled: ADB procurement page is a SearchStax SPA — no server-rendered rows. " +
  "Pending public ADB procurement API or RSS feed. (Verified 2026-06-07)";

export async function runAdbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    newTenderIds: [],
    error: DISABLED_REASON,
  };

  logger.info("ADB scraper: intentionally disabled (SearchStax SPA, no public API). Skipping HTTP request.");

  await finalizeScraperRun({ source: "adb", startedAt, result });
  return result;
}
