import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getAllEkapTendersForDate, formatEkapDate, enrichEkapTender } from "./ekap-client.js";
import {
  mapEkapToTender,
  upsertTender,
  finalizeScraperRun,
  updateScraperRunAnalyzed,
  retry,
  ScraperResult,
} from "./utils.js";
import { analyzeTender } from "../services/document-analyzer.js";
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

  const { analysis, docsDownloaded, docsTotal, extractedText, groundingSource } = await analyzeTender({
    title: tender.title,
    type: tender.type,
    method: tender.method,
    agencyName: tender.agencyName,
    il: tender.il,
    category: tender.category,
    cpvCodes: tender.cpvCodes,
    estimatedValue: tender.estimatedValue,
    deadline: tender.deadline,
    description: tender.description,
    sourceSystem: tender.sourceSystem,
    sourceUrl: tender.sourceUrl,
    documents: (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [],
    rawData: (tender.rawData as Record<string, unknown>) ?? {},
  });

  const existingRawData = (tender.rawData as Record<string, unknown>) ?? {};
  const updatedRawData = {
    ...existingRawData,
    _aiAnalysis: analysis,
    ...(extractedText ? { _docText: extractedText, _docTextSource: "document" } : {}),
  };

  await db
    .update(tendersTable)
    .set({ aiSummary: analysis, rawData: updatedRawData, updatedAt: new Date() })
    .where(eq(tendersTable.id, tenderId));

  logger.info(
    { tenderId, docsDownloaded, docsTotal, groundingSource },
    "Background AI analysis completed",
  );
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

          // Best-effort enrichment (new tenders only): resolve the real EKAP
          // detail/announcement text + official document URL via the detail
          // endpoint keyed by the tender's TOP-LEVEL hash id. The announcement
          // text becomes the notice `description` so the grounding chain grounds
          // analysis on real spec-level text (yeterlik criteria, scope) instead
          // of bare metadata. Degrades silently when EKAP is unreachable.
          try {
            const { detailText, documents } = await enrichEkapTender(tender.id);
            const patch: Partial<typeof mapped> = {};
            if (detailText.length >= 200) patch.description = detailText;
            if (documents.length > 0) patch.documents = documents;
            if (Object.keys(patch).length > 0) {
              await db
                .update(tendersTable)
                .set({ ...patch, updatedAt: new Date() })
                .where(eq(tendersTable.id, tenderId));
            }
          } catch (err) {
            logger.debug({ tenderId: tender.id, err }, "EKAP detail enrichment failed");
          }

          // Every new tender is analyzable: the grounding chain always yields
          // at least a metadata-grounded analysis, so no document-URL gate.
          newTenderIdsForAnalysis.push(tenderId);
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

  // Persist the scraper run record (with computed health status) and capture
  // its ID so we can patch it later with the number of completed analyses.
  const runId = await finalizeScraperRun({ source: "ekap", startedAt, result });

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
