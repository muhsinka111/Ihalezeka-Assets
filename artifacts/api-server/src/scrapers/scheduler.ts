import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { runEkapScraper } from "./ekap-scraper.js";
import { runIlanScraper } from "./ilan-scraper.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";

export function startScraperScheduler(): void {
  // 06:00, 12:00, 18:00 Turkey time (UTC+3)
  cron.schedule(
    "0 3,9,15 * * *",
    async () => {
      logger.info("Cron: starting scheduled scraper run");
      const results = await Promise.allSettled([
        runEkapScraper(),
        runIlanScraper(),
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
    },
    { timezone: "UTC" },
  );

  logger.info("Scraper scheduler started (06:00, 12:00, 18:00 Istanbul time)");
}
