import { Router } from "express";
import { getAuth } from "@clerk/express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { scraperRunsTable } from "@workspace/db";
import { runEkapScraper } from "../scrapers/ekap-scraper.js";
import { runIlanScraper } from "../scrapers/ilan-scraper.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";
import { logger } from "../lib/logger.js";
import { isScraperRunning } from "../scrapers/scheduler.js";

const router = Router();

const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

const ALL_SOURCES = ["ekap", "ilan_gov", "ted", "worldbank", "ebrd", "kit", "tubitak", "kosgeb", "kalkinma_ajansi"] as const;

function isAdmin(req: Parameters<typeof getAuth>[0]): boolean {
  if (!ADMIN_USER_ID) return false;
  const { userId } = getAuth(req);
  return userId === ADMIN_USER_ID;
}

router.get("/admin/scraper/status", async (_req, res) => {
  try {
    // Fetch latest run per source using DISTINCT ON (most efficient for this pattern)
    const latestPerSource = await db.execute<{
      id: string;
      source: string;
      started_at: Date;
      completed_at: Date;
      records_fetched: number;
      records_inserted: number;
      records_updated: number;
      error_message: string | null;
    }>(
      sql`SELECT DISTINCT ON (source) id, source, started_at, completed_at,
             records_fetched, records_inserted, records_updated, error_message
          FROM scraper_runs
          ORDER BY source, completed_at DESC`
    );

    const sourceMap = new Map(latestPerSource.rows.map(r => [r.source, r]));

    const perSource = ALL_SOURCES.map(source => {
      const r = sourceMap.get(source);
      if (!r) return { source, lastRunAt: null, status: "never_run", recordsFetched: 0, recordsInserted: 0, errorMessage: null };
      return {
        source,
        lastRunAt: r.completed_at,
        status: r.error_message ? "error" : "ok",
        recordsFetched: r.records_fetched,
        recordsInserted: r.records_inserted,
        errorMessage: r.error_message ?? null,
      };
    });

    // Also fetch recent 20 runs (across all sources) for a timeline view
    const recentRuns = await db
      .select()
      .from(scraperRunsTable)
      .orderBy(desc(scraperRunsTable.completedAt))
      .limit(20);

    const lastSuccessful = recentRuns.find(r => !r.errorMessage);
    const lastRunAt = lastSuccessful?.completedAt ?? recentRuns[0]?.completedAt ?? null;

    res.json({
      isRunning: isScraperRunning(),
      lastRunAt,
      perSource,
      recentRuns: recentRuns.map(r => ({
        source: r.source,
        completedAt: r.completedAt,
        recordsFetched: r.recordsFetched,
        recordsInserted: r.recordsInserted,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch scraper status");
    res.status(500).json({ error: "Failed to fetch scraper status" });
  }
});

router.post("/admin/scraper/run", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const source = (req.query["source"] as string) || "both";

  try {
    if (source === "ekap") {
      const result = await runEkapScraper();
      if (result.newTenderIds && result.newTenderIds.length > 0) {
        scoreAndNotify(result.newTenderIds).catch((err) =>
          logger.error({ err }, "Notification dispatch failed")
        );
      }
      return res.json({ source: "ekap", result });
    }

    if (source === "ilan_gov") {
      const result = await runIlanScraper();
      if (result.newTenderIds && result.newTenderIds.length > 0) {
        scoreAndNotify(result.newTenderIds).catch((err) =>
          logger.error({ err }, "Notification dispatch failed")
        );
      }
      return res.json({ source: "ilan_gov", result });
    }

    const [ekapResult, ilanResult] = await Promise.allSettled([
      runEkapScraper(),
      runIlanScraper(),
    ]);

    const allNewIds: number[] = [];
    if (ekapResult.status === "fulfilled" && ekapResult.value.newTenderIds) {
      allNewIds.push(...ekapResult.value.newTenderIds);
    }
    if (ilanResult.status === "fulfilled" && ilanResult.value.newTenderIds) {
      allNewIds.push(...ilanResult.value.newTenderIds);
    }
    if (allNewIds.length > 0) {
      scoreAndNotify(allNewIds).catch((err) =>
        logger.error({ err }, "Notification dispatch failed")
      );
    }

    return res.json({
      ekap:
        ekapResult.status === "fulfilled"
          ? { success: true, result: ekapResult.value }
          : { success: false, error: String(ekapResult.reason) },
      ilan_gov:
        ilanResult.status === "fulfilled"
          ? { success: true, result: ilanResult.value }
          : { success: false, error: String(ilanResult.reason) },
    });
  } catch (err) {
    return res.status(500).json({ error: "Scraper failed", detail: String(err) });
  }
});

export default router;
