import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable, matchesTable, pipelineItemsTable } from "@workspace/db";
import { eq, desc, count, sql, gte, and } from "drizzle-orm";

const router = Router();

const DEFAULT_BIZ = "demo-business";

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [activeMatchesRes] = await db
      .select({ count: count() })
      .from(matchesTable)
      .where(eq(matchesTable.businessId, DEFAULT_BIZ));

    const [pipelineRes] = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ));

    const pipelineItems = await db
      .select({ tender: tendersTable })
      .from(pipelineItemsTable)
      .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ));

    const totalValue = pipelineItems.reduce((sum, p) => sum + (p.tender.estimatedValue || 0), 0);

    const matches = await db
      .select({ fitScore: matchesTable.fitScore })
      .from(matchesTable)
      .where(eq(matchesTable.businessId, DEFAULT_BIZ));

    const avgFitScore = matches.length > 0
      ? matches.reduce((s, m) => s + m.fitScore, 0) / matches.length
      : 0;

    const wonItems = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.businessId, DEFAULT_BIZ), eq(pipelineItemsTable.stage, "won")));

    const totalApplied = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ));

    const winRate = totalApplied[0].count > 0
      ? (wonItems[0].count / totalApplied[0].count) * 100
      : 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [newTodayRes] = await db
      .select({ count: count() })
      .from(tendersTable)
      .where(gte(tendersTable.createdAt, startOfToday));

    res.json({
      activeMatches: activeMatchesRes.count,
      pipelineCount: pipelineRes.count,
      totalValue,
      winRate: Math.round(winRate * 10) / 10,
      newTendersToday: newTodayRes.count,
      avgFitScore: Math.round(avgFitScore),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/top-matches", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(matchesTable)
      .innerJoin(tendersTable, eq(matchesTable.tenderId, tendersTable.id))
      .where(eq(matchesTable.businessId, DEFAULT_BIZ))
      .orderBy(desc(matchesTable.fitScore))
      .limit(8);

    const result = rows.map((r) => ({
      id: r.matches.id,
      tender: r.tenders,
      fitScore: r.matches.fitScore,
      reasoning: r.matches.reasoning,
      pros: r.matches.pros,
      risks: r.matches.risks,
      status: r.matches.status,
      createdAt: r.matches.createdAt.toISOString(),
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/money-flow-sparkline", async (req, res) => {
  const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  try {
    // Sum estimated value of tenders grouped by deadline month for the last 7 months.
    const rows = await db
      .select({
        ym: sql<string>`to_char(${tendersTable.deadline}, 'YYYY-MM')`,
        amount: sql<number>`coalesce(sum(${tendersTable.estimatedValue}), 0)`,
      })
      .from(tendersTable)
      .where(sql`${tendersTable.deadline} is not null`)
      .groupBy(sql`to_char(${tendersTable.deadline}, 'YYYY-MM')`);

    const byKey = new Map(rows.map((r) => [r.ym, Number(r.amount)]));
    const now = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      data.push({ month: monthNames[d.getMonth()], amount: byKey.get(key) ?? 0 });
    }
    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/pipeline-summary", async (req, res) => {
  try {
    const stages = ["discovery", "preparation", "applied", "evaluation", "won", "lost"];
    const results = await Promise.all(
      stages.map(async (stage) => {
        const [{ count: cnt }] = await db
          .select({ count: count() })
          .from(pipelineItemsTable)
          .where(and(eq(pipelineItemsTable.businessId, DEFAULT_BIZ), eq(pipelineItemsTable.stage, stage)));
        const items = await db
          .select({ tender: tendersTable })
          .from(pipelineItemsTable)
          .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
          .where(and(eq(pipelineItemsTable.businessId, DEFAULT_BIZ), eq(pipelineItemsTable.stage, stage)));
        const totalValue = items.reduce((s, i) => s + (i.tender.estimatedValue || 0), 0);
        return { stage, count: Number(cnt), totalValue };
      })
    );
    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

const STAGE_WEIGHT: Record<string, number> = {
  discovery: 0,
  preparation: 8,
  applied: 15,
  evaluation: 25,
  won: 100,
  lost: 0,
};

router.get("/dashboard/win-predictions", async (req, res) => {
  try {
    const rows = await db
      .select({
        tenderId: tendersTable.id,
        tenderTitle: tendersTable.title,
        agencyName: tendersTable.agencyName,
        stage: pipelineItemsTable.stage,
        fitScore: matchesTable.fitScore,
      })
      .from(pipelineItemsTable)
      .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
      .leftJoin(
        matchesTable,
        and(
          eq(matchesTable.tenderId, tendersTable.id),
          eq(matchesTable.businessId, DEFAULT_BIZ)
        )
      )
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ))
      .limit(8);

    const result = rows.map((r) => {
      const stageBoost = STAGE_WEIGHT[r.stage] ?? 0;
      // Base probability on AI fit score, nudged by how far along the pipeline stage is.
      const base = r.fitScore ?? 50;
      const probability =
        r.stage === "won" ? 100 : r.stage === "lost" ? 0 : Math.min(95, Math.round(base * 0.7 + stageBoost));
      return {
        tenderId: r.tenderId,
        tenderTitle: r.tenderTitle,
        agencyName: r.agencyName,
        probability,
      };
    });

    result.sort((a, b) => b.probability - a.probability);
    res.json(result.slice(0, 5));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
