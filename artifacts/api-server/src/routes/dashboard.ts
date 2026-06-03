import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable, matchesTable, pipelineItemsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";

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
      .where(eq(pipelineItemsTable.stage, "won"));

    const totalApplied = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ));

    const winRate = totalApplied[0].count > 0
      ? (wonItems[0].count / totalApplied[0].count) * 100
      : 0;

    res.json({
      activeMatches: activeMatchesRes.count,
      pipelineCount: pipelineRes.count,
      totalValue,
      winRate: Math.round(winRate * 10) / 10,
      newTendersToday: Math.floor(Math.random() * 8) + 3,
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
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const data = months.map((month) => ({
    month,
    amount: Math.floor(Math.random() * 5_000_000) + 1_000_000,
  }));
  res.json(data);
});

router.get("/dashboard/pipeline-summary", async (req, res) => {
  try {
    const stages = ["discovery", "preparation", "applied", "evaluation", "won", "lost"];
    const results = await Promise.all(
      stages.map(async (stage) => {
        const [{ count: cnt }] = await db
          .select({ count: count() })
          .from(pipelineItemsTable)
          .where(eq(pipelineItemsTable.stage, stage));
        const items = await db
          .select({ tender: tendersTable })
          .from(pipelineItemsTable)
          .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
          .where(eq(pipelineItemsTable.stage, stage));
        const totalValue = items.reduce((s, i) => s + (i.tender.estimatedValue || 0), 0);
        return { stage, count: Number(cnt), totalValue };
      })
    );
    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/win-predictions", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(pipelineItemsTable)
      .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
      .where(eq(pipelineItemsTable.businessId, DEFAULT_BIZ))
      .limit(5);

    const result = rows.map((r) => ({
      tenderId: r.tenders.id,
      tenderTitle: r.tenders.title,
      agencyName: r.tenders.agencyName,
      probability: Math.floor(Math.random() * 50) + 40,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
