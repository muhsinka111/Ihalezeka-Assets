import { logger } from "../lib/logger.js";
import { getAllEkapTendersForDate, formatEkapDate } from "./ekap-client.js";
import { mapEkapToTender, upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";

export async function runEkapScraper(
  startDateOverride?: string,
  endDateOverride?: string,
): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    const { start, end } = formatEkapDate();
    const startDate = startDateOverride ?? start;
    const endDate = endDateOverride ?? end;

    logger.info({ startDate, endDate }, "EKAP scraper starting");

    const tenders = await retry(() =>
      getAllEkapTendersForDate(startDate, endDate),
    );
    result.fetched = tenders.length;

    for (const tender of tenders) {
      try {
        const mapped = mapEkapToTender(tender);
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ tenderId: tender.id, err }, "Failed to upsert EKAP tender");
      }
    }

    logger.info(result, "EKAP scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "EKAP scraper failed");
  }

  await logScraperRun({
    source: "ekap",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
