import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

// KOSGEB has no stable, structured source we can scrape reliably. The public
// "destekler"/"duyurular" pages are JavaScript-rendered navigation/category
// pages with no machine-readable listing, and the heuristic HTML selectors
// matched nothing — every run fetched 0 records while silently logging success.
// Rather than keep that dishonest empty-success loop, the source is disabled.
// Re-enable by wiring a real KOSGEB API/feed and restoring a parser here.
const DISABLED_REASON =
  "KOSGEB için kararlı bir yapısal kaynak yok (sayfalar JS ile yükleniyor) — kaynak devre dışı bırakıldı.";

export async function runKosgbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("KOSGEB scraper skipped — source disabled (no stable structured source)");
  await finalizeScraperRun({
    source: "kosgeb",
    startedAt,
    result,
    disabled: true,
    reason: DISABLED_REASON,
  });

  return result;
}
