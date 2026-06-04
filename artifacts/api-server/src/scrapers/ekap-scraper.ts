import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getAllEkapTendersForDate, formatEkapDate } from "./ekap-client.js";
import { mapEkapToTender, upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import { analyzeDocuments } from "../services/document-analyzer.js";

async function backgroundAnalyzeTender(tenderId: number): Promise<void> {
  try {
    const [tender] = await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, tenderId))
      .limit(1);

    if (!tender) return;
    if (tender.aiSummary) return;

    const documents =
      (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];

    const analysis = await analyzeDocuments({
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

    logger.info({ tenderId }, "Background AI document analysis completed");
  } catch (err) {
    logger.warn({ tenderId, err }, "Background AI document analysis failed");
  }
}

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

    const tenders = await retry(() => getAllEkapTendersForDate(startDate, endDate));
    result.fetched = tenders.length;

    const newTenderIdsForAnalysis: number[] = [];

    for (const tender of tenders) {
      try {
        const mapped = mapEkapToTender(tender);
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
          if ((tender.dokumanListe ?? []).length > 0) {
            newTenderIdsForAnalysis.push(tenderId);
          }
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ tenderId: tender.id, err }, "Failed to upsert EKAP tender");
      }
    }

    logger.info(result, "EKAP scraper completed");

    if (newTenderIdsForAnalysis.length > 0) {
      logger.info(
        { count: newTenderIdsForAnalysis.length },
        "Scheduling background AI analysis for new tenders with documents",
      );
      setImmediate(() => {
        const analyzeSequentially = async () => {
          for (const id of newTenderIdsForAnalysis) {
            await backgroundAnalyzeTender(id);
            await new Promise((r) => setTimeout(r, 500));
          }
        };
        analyzeSequentially().catch((err) =>
          logger.error({ err }, "Background analysis batch failed"),
        );
      });
    }
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
