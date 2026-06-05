import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

// TÜBİTAK has no stable, structured source we can scrape reliably. The public
// "destekler"/"duyurular" pages are JavaScript-rendered category-navigation
// pages with no machine-readable listing (and some URLs now 404). The heuristic
// HTML selectors only ever matched a couple of menu links, so runs effectively
// fetched 0 real records while logging success. The source is disabled honestly.
// Re-enable by wiring a real TÜBİTAK feed/API and restoring a parser here.
const DISABLED_REASON =
  "TÜBİTAK için kararlı bir yapısal kaynak yok (sayfalar JS ile yükleniyor, bazı URL'ler 404) — kaynak devre dışı bırakıldı.";

export async function runTubitakScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("TÜBİTAK scraper skipped — source disabled (no stable structured source)");
  await finalizeScraperRun({
    source: "tubitak",
    startedAt,
    result,
    disabled: true,
    reason: DISABLED_REASON,
  });

  return result;
}
