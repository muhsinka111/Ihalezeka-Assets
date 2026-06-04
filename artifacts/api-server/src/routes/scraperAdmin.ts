import { Router } from "express";
import { getAuth } from "@clerk/express";
import { desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { scraperRunsTable } from "@workspace/db";
import { runEkapScraper } from "../scrapers/ekap-scraper.js";
import { runIlanScraper } from "../scrapers/ilan-scraper.js";
import { scoreAndNotify } from "../lib/notificationDispatcher.js";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

function isAdmin(req: Parameters<typeof getAuth>[0]): boolean {
  if (!ADMIN_USER_ID) return false;
  const { userId } = getAuth(req);
  return userId === ADMIN_USER_ID;
}

router.get("/admin/scraper/status", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(scraperRunsTable)
      .orderBy(desc(scraperRunsTable.completedAt))
      .limit(10);

    const lastSuccessful = rows.find((r) => !r.errorMessage);
    const lastRunAt = lastSuccessful?.completedAt ?? rows[0]?.completedAt ?? null;
    const totalInserted = rows.reduce((sum, r) => sum + r.recordsInserted, 0);
    const totalFetched = rows.reduce((sum, r) => sum + r.recordsFetched, 0);

    res.json({
      lastRunAt,
      recentRuns: rows.slice(0, 5).map((r) => ({
        source: r.source,
        completedAt: r.completedAt,
        recordsFetched: r.recordsFetched,
        recordsInserted: r.recordsInserted,
        errorMessage: r.errorMessage,
      })),
      totalInserted,
      totalFetched,
    });
  } catch (err) {
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
