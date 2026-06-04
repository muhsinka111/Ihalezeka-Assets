import { logger } from "../lib/logger.js";
import { getAllRecentIlanAds } from "./ilan-client.js";
import { mapIlanToTender, upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";

export async function runIlanScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("ilan.gov.tr scraper starting");

    const ads = await retry(() => getAllRecentIlanAds(48));
    result.fetched = ads.length;

    for (const ad of ads) {
      try {
        const mapped = mapIlanToTender(ad);
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ adId: ad.id, err }, "Failed to upsert ilan.gov.tr ad");
      }
    }

    logger.info(result, "ilan.gov.tr scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "ilan.gov.tr scraper failed");
  }

  await logScraperRun({
    source: "ilan_gov",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
