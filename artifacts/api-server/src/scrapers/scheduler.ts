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
import { runUngmScraper } from "./ungm-scraper.js";
import { runAdbScraper } from "./adb-scraper.js";
import { runAiibScraper } from "./aiib-scraper.js";
import { runIsdbScraper } from "./isdb-scraper.js";
import { formatEkapDate } from "./ekap-client.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";
import { dispatchSavedSearchAlerts } from "../lib/savedSearchAlerts.js";

let _scraperRunning = false;

export function isScraperRunning(): boolean {
  return _scraperRunning;
}

interface ScraperConfig {
  /** EKAP lookback in days (used to compute start/end date for EKAP API) */
  ekapDaysBack: number;
  /** ilan.gov.tr lookback in hours */
  ilanHoursBack: number;
  /** TED / World Bank lookback in days (international sources with date filters) */
  intlDaysBack: number;
  /**
   * Grant/HTML scrapers (TÜBİTAK, KOSGEB, Kalkınma, EBRD, KİT) always scrape
   * current page content and rely on IKN deduplication — no date-based filter.
   * grantDaysBack is reserved for future use if APIs become available.
   */
  grantDaysBack: number;
}

const STARTUP_CONFIG: ScraperConfig = {
  ekapDaysBack: 30,
  ilanHoursBack: 30 * 24,
  intlDaysBack: 30,
  grantDaysBack: 30,
};

const SCHEDULED_CONFIG: ScraperConfig = {
  ekapDaysBack: 2,
  ilanHoursBack: 48,
  intlDaysBack: 7,
  grantDaysBack: 30,
};

async function runAllScrapers(cfg: ScraperConfig): Promise<void> {
  _scraperRunning = true;
  try {
    const { start, end } = formatEkapDate(cfg.ekapDaysBack);

    // Groups run concurrently; within each group, items are independent
    const results = await Promise.allSettled([
      // Domestic procurement (daily cadence)
      runEkapScraper(start, end),
      runIlanScraper(cfg.ilanHoursBack),
      // KİT public enterprises (scrape current listings, dedup by IKN)
      runKitScraper(),
      // International tenders with date-filter APIs
      runTedScraper(cfg.intlDaysBack),
      runWorldBankScraper(cfg.intlDaysBack),
      // International HTML (no date filter — dedup handles staleness)
      runEbrdScraper(),
      // International sources (UNGM auto-falls back to UNDP ColdFusion portal when SPA detected)
      runUngmScraper(cfg.intlDaysBack),
      runAdbScraper(),
      runAiibScraper(cfg.intlDaysBack),
      runIsdbScraper(),
      // Grant programs (30-day cadence; current listings, dedup by IKN)
      runTubitakScraper(),
      runKosgbScraper(),
      runKalkinmaScraper(),
    ]);

    const sourceNames = [
      "ekap", "ilan_gov", "kit", "ted", "worldbank", "ebrd",
      "ungm", "adb", "aiib", "isdb",
      "tubitak", "kosgeb", "kalkinma_ajansi",
    ];
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
      await dispatchSavedSearchAlerts(allNewIds).catch((err) =>
        logger.error({ err }, "Saved-search alert dispatch failed")
      );
    }
  } finally {
    _scraperRunning = false;
  }
}

export function startScraperScheduler(): void {
  // Startup run: extended lookback to populate DB from cold start
  setImmediate(() => {
    logger.info(STARTUP_CONFIG, "Startup: running initial scraper with extended lookback");
    runAllScrapers(STARTUP_CONFIG).catch((err) =>
      logger.error({ err }, "Startup scraper run failed")
    );
  });

  // 06:00, 12:00, 18:00 Turkey time (UTC+3 → 03:00, 09:00, 15:00 UTC)
  cron.schedule(
    "0 3,9,15 * * *",
    async () => {
      logger.info(SCHEDULED_CONFIG, "Cron: starting scheduled scraper run");
      await runAllScrapers(SCHEDULED_CONFIG);
    },
    { timezone: "UTC" },
  );

  logger.info(
    "Scraper scheduler started — active: EKAP, ilan.gov.tr, KİT per-agency (BOTAŞ/TCDD/TPAO/DHMİ/TOKİ/DSİ each with own scraper_runs row), Kalkınma Ajansları per-agency (BAKA/BEBKA/DOGAKA/MARKA each with own scraper_runs row), World Bank, EBRD, UNGM (falls back to UNDP ColdFusion portal), AIIB (static ppo-data-all.js — inserts records), IsDB, TÜBİTAK, KOSGEB; disabled: ADB (SearchStax SPA/no public API); conditional: TED (requires TED_API_KEY)",
  );
}
