import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { runEkapScraper } from "./ekap-scraper.js";
import { runIlanScraper } from "./ilan-scraper.js";
import { formatEkapDate } from "./ekap-client.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";

async function runAllScrapers(ekapDaysBack = 2, ilanHoursBack = 48): Promise<void> {
  const { start, end } = formatEkapDate(ekapDaysBack);
  const results = await Promise.allSettled([
    runEkapScraper(start, end),
    runIlanScraper(ilanHoursBack),
  ]);

  const allNewIds: number[] = [];

  results.forEach((r, i) => {
    const src = i === 0 ? "ekap" : "ilan_gov";
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
}

export function startScraperScheduler(): void {
  // Fire immediately on startup with a 30-day lookback to populate the DB
  setImmediate(() => {
    logger.info("Startup: running initial scraper with 30-day lookback");
    runAllScrapers(30, 30 * 24).catch((err) =>
      logger.error({ err }, "Startup scraper run failed")
    );
  });

  // 06:00, 12:00, 18:00 Turkey time (UTC+3)
  cron.schedule(
    "0 3,9,15 * * *",
    async () => {
      logger.info("Cron: starting scheduled scraper run");
      await runAllScrapers(2, 48);
    },
    { timezone: "UTC" },
  );

  logger.info("Scraper scheduler started (06:00, 12:00, 18:00 Istanbul time)");
}
