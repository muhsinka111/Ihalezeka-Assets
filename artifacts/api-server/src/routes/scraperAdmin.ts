import { Router, type Request } from "express";
import { desc, eq, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { scraperRunsTable, tendersTable } from "@workspace/db";
import { runEkapScraper } from "../scrapers/ekap-scraper.js";
import { runIlanScraper } from "../scrapers/ilan-scraper.js";
import { runAwardScraper } from "../scrapers/award-scraper.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";
import { logger } from "../lib/logger.js";
import { isScraperRunning } from "../scrapers/scheduler.js";
import { SOURCE_LABELS } from "../scrapers/utils.js";
import { getUserId } from "../lib/authHelpers.js";

const router = Router();

const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

/** All known sources — derived from SOURCE_LABELS so new scrapers appear automatically. */
const ALL_SOURCES = Object.keys(SOURCE_LABELS);

function isAdmin(req: Request): boolean {
  if (!ADMIN_USER_ID) return true;
  return getUserId(req) === ADMIN_USER_ID;
}

interface RecentRunRow {
  [key: string]: unknown;
  id: string;
  source: string;
  started_at: Date;
  completed_at: Date | null;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  error_message: string | null;
  status: string;
}

router.get("/admin/scraper/status", async (_req, res) => {
  try {
    // Pull the most recent runs per source (window-limited) so we can compute
    // health — last successful run and how many failures in a row — in one query.
    const windowed = await db.execute<RecentRunRow>(
      sql`SELECT id, source, started_at, completed_at,
             records_fetched, records_inserted, records_updated, error_message, status
          FROM (
            SELECT *, row_number() OVER (
              PARTITION BY source ORDER BY completed_at DESC NULLS LAST
            ) AS rn
            FROM scraper_runs
          ) s
          WHERE rn <= 30
          ORDER BY source, completed_at DESC`,
    );

    const bySource = new Map<string, RecentRunRow[]>();
    for (const row of windowed.rows) {
      const list = bySource.get(row.source) ?? [];
      list.push(row);
      bySource.set(row.source, list);
    }

    const perSource = ALL_SOURCES.map((source: string) => {
      const runs = bySource.get(source) ?? [];
      if (runs.length === 0) {
        return {
          source,
          status: "never_run",
          lastRunAt: null,
          lastSuccessfulRunAt: null,
          recordsFetched: 0,
          recordsInserted: 0,
          consecutiveFailures: 0,
          errorMessage: null,
        };
      }

      const latest = runs[0];
      const lastSuccessful = runs.find((r) => r.status === "success");

      // Count consecutive degraded runs (error/empty) from the most recent
      // backwards, stopping at the first healthy or intentionally-disabled run.
      let consecutiveFailures = 0;
      for (const r of runs) {
        if (r.status === "error" || r.status === "empty") consecutiveFailures++;
        else break;
      }

      return {
        source,
        status: latest.status,
        lastRunAt: latest.completed_at,
        lastSuccessfulRunAt: lastSuccessful?.completed_at ?? null,
        recordsFetched: latest.records_fetched,
        recordsInserted: latest.records_inserted,
        consecutiveFailures,
        errorMessage: latest.error_message ?? null,
      };
    });

    // Also fetch recent 20 runs (across all sources) for a timeline view
    const recentRuns = await db
      .select()
      .from(scraperRunsTable)
      .orderBy(desc(scraperRunsTable.completedAt))
      .limit(20);

    const lastSuccessful = recentRuns.find((r) => r.status === "success");
    const lastRunAt =
      lastSuccessful?.completedAt ?? recentRuns[0]?.completedAt ?? null;

    const [{ tenderCount }] = await db
      .select({ tenderCount: count() })
      .from(tendersTable);

    res.json({
      isRunning: isScraperRunning(),
      lastRunAt,
      tenderCount: Number(tenderCount),
      perSource,
      recentRuns: recentRuns.map((r) => ({
        source: r.source,
        status: r.status,
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
          logger.error({ err }, "Notification dispatch failed"),
        );
      }
      return res.json({ source: "ekap", result });
    }

    if (source === "ilan_gov") {
      const result = await runIlanScraper();
      if (result.newTenderIds && result.newTenderIds.length > 0) {
        scoreAndNotify(result.newTenderIds).catch((err) =>
          logger.error({ err }, "Notification dispatch failed"),
        );
      }
      return res.json({ source: "ilan_gov", result });
    }

    if (source === "awards") {
      const result = await runAwardScraper();
      return res.json({ source: "awards", result });
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
        logger.error({ err }, "Notification dispatch failed"),
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
    return res
      .status(500)
      .json({ error: "Scraper failed", detail: String(err) });
  }
});

export default router;
