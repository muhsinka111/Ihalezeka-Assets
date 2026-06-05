import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

// The regional development agencies (BEBKA, İSTKA, İZKA, BAKA, MARKA, ...) each
// run their own bespoke, JavaScript-rendered sites with no shared structured
// feed. The heuristic HTML selectors matched only navigation links, several
// agency URLs now 404, and every run fetched 0 real records while logging
// success. Rather than keep that dishonest empty-success loop, the source is
// disabled. Re-enable per-agency once a stable feed/parser exists.
const DISABLED_REASON =
  "Kalkınma Ajansları için ortak/kararlı bir yapısal kaynak yok (her ajansın sitesi farklı ve JS ile yükleniyor) — kaynak devre dışı bırakıldı.";

export async function runKalkinmaScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("Kalkınma Ajansları scraper skipped — source disabled (no stable structured source)");
  await finalizeScraperRun({
    source: "kalkinma_ajansi",
    startedAt,
    result,
    disabled: true,
    reason: DISABLED_REASON,
  });

  return result;
}
