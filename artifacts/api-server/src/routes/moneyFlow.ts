import { Router } from "express";
import { requirePro } from "../lib/authHelpers.js";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { sql, isNotNull, desc } from "drizzle-orm";

const router = Router();

router.use("/money-flow", requirePro);

router.get("/money-flow/monthly", async (_req, res) => {
  try {
    const rows = await db
      .select({
        month: sql<string>`to_char(${tendersTable.createdAt}, 'Mon')`,
        yearMonth: sql<string>`to_char(${tendersTable.createdAt}, 'YYYY-MM')`,
        amount: sql<number>`COALESCE(SUM(${tendersTable.estimatedValue}), 0)`,
      })
      .from(tendersTable)
      .where(isNotNull(tendersTable.estimatedValue))
      .groupBy(
        sql`to_char(${tendersTable.createdAt}, 'YYYY-MM')`,
        sql`to_char(${tendersTable.createdAt}, 'Mon')`,
      )
      .orderBy(sql`to_char(${tendersTable.createdAt}, 'YYYY-MM')`)
      .limit(12);

    res.json(rows.map((r) => ({ month: r.month, amount: Number(r.amount) })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/money-flow/categories", async (_req, res) => {
  try {
    const rows = await db
      .select({
        category: tendersTable.type,
        amount: sql<number>`COALESCE(SUM(${tendersTable.estimatedValue}), 0)`,
      })
      .from(tendersTable)
      .where(isNotNull(tendersTable.estimatedValue))
      .groupBy(tendersTable.type)
      .orderBy(sql`SUM(${tendersTable.estimatedValue}) DESC`)
      .limit(8);

    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    res.json(
      rows.map((r) => ({
        category: r.category,
        amount: Number(r.amount),
        percentage:
          total > 0 ? Math.round((Number(r.amount) / total) * 1000) / 10 : 0,
      })),
    );
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/money-flow/top-agencies", async (_req, res) => {
  try {
    const rows = await db
      .select({
        agencyName: tendersTable.agencyName,
        agencyLogoUrl: sql<string | null>`MAX(${tendersTable.agencyLogoUrl})`,
        totalSpend: sql<number>`COALESCE(SUM(${tendersTable.estimatedValue}), 0)`,
        tenderCount: sql<number>`COUNT(*)`,
        il: sql<string>`MAX(${tendersTable.il})`,
      })
      .from(tendersTable)
      .where(isNotNull(tendersTable.estimatedValue))
      .groupBy(tendersTable.agencyName)
      .orderBy(sql`SUM(${tendersTable.estimatedValue}) DESC`)
      .limit(10);

    res.json(
      rows.map((r) => ({
        agencyName: r.agencyName,
        agencyLogoUrl: r.agencyLogoUrl ?? null,
        totalSpend: Number(r.totalSpend),
        tenderCount: Number(r.tenderCount),
        il: r.il,
      })),
    );
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/money-flow/recent-ticker", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: tendersTable.id,
        title: tendersTable.title,
        agencyName: tendersTable.agencyName,
        estimatedValue: tendersTable.estimatedValue,
        type: tendersTable.type,
      })
      .from(tendersTable)
      .where(isNotNull(tendersTable.estimatedValue))
      .orderBy(desc(tendersTable.createdAt))
      .limit(30);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
