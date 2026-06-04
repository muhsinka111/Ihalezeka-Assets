import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getAllEkapTendersForDate, formatEkapDate } from "./ekap-client.js";
import {
  mapEkapToTender,
  upsertTender,
  logScraperRun,
  updateScraperRunAnalyzed,
  retry,
  ScraperResult,
} from "./utils.js";
import { analyzeDocuments } from "../services/document-analyzer.js";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

/**
 * Analyze a single tender's documents and write the result back to the DB.
 * Returns true on success, false if the tender was skipped (no docs / already
 * analyzed). Throws only on unexpected errors so batchProcess retry logic
 * can engage.
 */
async function backgroundAnalyzeTender(tenderId: number): Promise<boolean> {
  const [tender] = await db
    .select()
    .from(tendersTable)
    .where(eq(tendersTable.id, tenderId))
    .limit(1);

  if (!tender) return false;
  if (tender.aiSummary) return false;

  const documents =
    (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];

  const { analysis, docsDownloaded, docsTotal } = await analyzeDocuments({
    tenderTitle: tender.title,
    tenderType: tender.type ?? undefined,
    tenderMethod: tender.method ?? undefined,
    agencyName: tender.agencyName ?? undefined,
    documents,
  });

  const existingRawData = (tender.rawData as Record<string, unknown>) ?? {};
  const updatedRawData = { ...existingRawData, _aiAnalysis: analysis };

  await db
    .update(tendersTable)
    .set({ aiSummary: analysis, rawData: updatedRawData, updatedAt: new Date() })
    .where(eq(tendersTable.id, tenderId));

  logger.info({ tenderId, docsDownloaded, docsTotal }, "Background AI document analysis completed");
  return true;
}

export async function runEkapScraper(
  startDateOverride?: string,
  endDateOverride?: string,
): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, analyzed: 0, newTenderIds: [] };

  // Declared at function scope so it is accessible after the try block for
  // scheduling background analysis.
  const newTenderIdsForAnalysis: number[] = [];

  try {
    const { start, end } = formatEkapDate();
    const startDate = startDateOverride ?? start;
    const endDate = endDateOverride ?? end;

    logger.info({ startDate, endDate }, "EKAP scraper starting");

    const tenders = await retry(() => getAllEkapTendersForDate(startDate, endDate));
    result.fetched = tenders.length;

    for (const tender of tenders) {
      try {
        const mapped = mapEkapToTender(tender);
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
          // Only enqueue tenders that have at least one document with a URL
          if ((tender.dokumanListe ?? []).some((d) => !!d.url)) {
            newTenderIdsForAnalysis.push(tenderId);
          }
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ tenderId: tender.id, err }, "Failed to upsert EKAP tender");
      }
    }

    result.analyzed = newTenderIdsForAnalysis.length;
    logger.info(result, "EKAP scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "EKAP scraper failed");
  }

  // Persist the scraper run record and capture its ID so we can patch it later
  // with the actual number of successfully completed analyses.
  const runId = await logScraperRun({
    source: "ekap",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    recordsAnalyzed: 0,
    errorMessage: result.error ?? null,
  });

  if (newTenderIdsForAnalysis.length > 0) {
    logger.info(
      { queued: newTenderIdsForAnalysis.length },
      "Scheduling background AI analysis for new tenders with documents",
    );

    setImmediate(() => {
      batchProcess(
        newTenderIdsForAnalysis,
        async (tenderId) => {
          try {
            return await backgroundAnalyzeTender(tenderId);
          } catch (err) {
            logger.warn({ tenderId, err }, "Background AI document analysis failed");
            // Return false so this item is counted as not-analyzed; the error
            // is already logged and we don't want to suppress the batch result.
            return false;
          }
        },
        { concurrency: 2, retries: 2 },
      )
        .then(async (results) => {
          const analyzed = results.filter(Boolean).length;
          logger.info(
            { analyzed, queued: newTenderIdsForAnalysis.length },
            "Background AI analysis batch finished",
          );
          await updateScraperRunAnalyzed(runId, analyzed);
        })
        .catch((err) => logger.error({ err }, "Background analysis batch failed"));
    });
  }

  return result;
}
