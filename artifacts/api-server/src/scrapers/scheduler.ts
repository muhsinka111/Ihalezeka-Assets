import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { runEkapScraper } from "./ekap-scraper.js";
import { runIlanScraper } from "./ilan-scraper.js";
import { runTedScraper } from "./ted-scraper.js";
import { runWorldBankScraper } from "./worldbank-scraper.js";
import { runEbrdScraper } from "./ebrd-scraper.js";
import { runKitScraper } from "./kit-scraper.js";
import { runTubitakScraper } from "./tubitak-scraper.js";
import { runKosgbScraper } from "./kosgeb-scraper.js";
import { runKalkinmaScraper } from "./kalkinma-scraper.js";
import { formatEkapDate } from "./ekap-client.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";

let _scraperRunning = false;

export function isScraperRunning(): boolean {
  return _scraperRunning;
}

async function runAllScrapers(ekapDaysBack = 2, ilanHoursBack = 48, grantDaysBack = 30, intlDaysBack = 7): Promise<void> {
  _scraperRunning = true;
  try {
    const { start, end } = formatEkapDate(ekapDaysBack);

    const results = await Promise.allSettled([
      runEkapScraper(start, end),
      runIlanScraper(ilanHoursBack),
      runTedScraper(intlDaysBack),
      runWorldBankScraper(intlDaysBack),
      runEbrdScraper(),
      runKitScraper(),
      runTubitakScraper(),
      runKosgbScraper(),
      runKalkinmaScraper(),
    ]);

    const sourceNames = ["ekap", "ilan_gov", "ted", "worldbank", "ebrd", "kit", "tubitak", "kosgeb", "kalkinma_ajansi"];
    const allNewIds: number[] = [];

    results.forEach((r, i) => {
      const src = sourceNames[i];
      if (r.status === "fulfilled") {
        logger.info({ src, result: r.value }, "Scraper run completed");
        if (r.value.newTenderIds && r.value.newTenderIds.length > 0) {
          allNewIds.push(...r.value.newTenderIds);
        }
      } else {
        logger.error({ src, reason: r.reason }, "Scraper run failed");
      }
    });

    if (allNewIds.length > 0) {
      logger.info({ count: allNewIds.length }, "Dispatching notifications for new tenders");
      await scoreAndNotify(allNewIds).catch((err) =>
        logger.error({ err }, "Notification dispatch failed")
      );
    }
  } finally {
    _scraperRunning = false;
  }
}

export function startScraperScheduler(): void {
  // Fire immediately on startup with a wide lookback to populate the DB
  setImmediate(() => {
    logger.info("Startup: running initial scraper with extended lookback");
    runAllScrapers(30, 30 * 24, 30, 30).catch((err) =>
      logger.error({ err }, "Startup scraper run failed")
    );
  });

  // 06:00, 12:00, 18:00 Turkey time (UTC+3)
  cron.schedule(
    "0 3,9,15 * * *",
    async () => {
      logger.info("Cron: starting scheduled scraper run");
      await runAllScrapers(2, 48, 30, 7);
    },
    { timezone: "UTC" },
  );

  logger.info("Scraper scheduler started — EKAP, ilan.gov.tr, TED, World Bank, EBRD, KİT, TÜBİTAK, KOSGEB, Kalkınma Ajansları");
}
