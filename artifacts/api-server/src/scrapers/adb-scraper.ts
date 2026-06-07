import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

/**
 * ADB (Asian Development Bank) procurement notices.
 *
 * STATUS: INTENTIONALLY DISABLED — makes no HTTP requests.
 *
 * Investigation log (2026-06-07):
 *   - www.adb.org/projects/tenders: renders <div data-content="tenders"
 *     class="searchstax-site-search"> placeholder; actual notice content is
 *     loaded client-side by the SearchStax cloud search widget via an
 *     authenticated private Solr cluster.  Zero server-rendered rows.
 *   - www.adb.org/site/business-opportunities/institutional-procurement-notices:
 *     static informational page, no machine-readable notice list.
 *   - www.adb.org/projects/tenders/_common/tenders-data.js (and ppo-data-all.js):
 *     Drupal routes these paths to the same HTML page (HTTP 200 with full HTML).
 *   - www.adb.org/projects/tenders.json, ?format=json, ?_format=json: all return
 *     full Drupal HTML (Drupal ignores these suffixes/params for this route).
 *   - cms.adb.org (Consultant Management System): requires Oracle EBS login.
 *   - AfDB (African Development Bank, potential swap-in): all afdb.org domains
 *     return DNS failure or HTTP 403 from Replit's IP range.
 *   - UNGM POST /Public/Notice/Search with Agencies:[85] (ADB UNGM code):
 *     returns HTML error page — authenticated session required.
 *   - UNGM GET variants (Organization=85, Agencies=85 query params): 404.
 *
 * AIIB (aiib-scraper.ts) is maintained as an active Asia-Pacific development
 * bank source (sourceSystem: "aiib") producing real procurement data via the
 * static ppo-data-all.js file on www.aiib.org.
 *
 * Re-enable when: ADB publishes a public procurement REST/RSS feed, or the
 * SearchStax cluster URL + API key are discovered via browser DevTools capture.
 */
const DISABLED_REASON =
  "ADB procurement page is a SearchStax SPA — no server-rendered rows and no " +
  "public procurement REST/RSS API is available. (Verified 2026-06-07)";

export async function runAdbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("ADB scraper: intentionally disabled (SearchStax SPA, no public API). Skipping.");

  await finalizeScraperRun({
    source: "adb",
    startedAt,
    result,
    disabled: true,
    reason: DISABLED_REASON,
  });
  return result;
}
