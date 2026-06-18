import { Router } from "express";
import { requirePro, getBusinessId } from "../lib/authHelpers.js";
import { db } from "@workspace/db";
import { pipelineItemsTable, matchesTable, tendersTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

const router = Router();

// Premium-only: reports & exports (Raporlar) are a Pro power tool.
router.use("/reports", requirePro);

router.get("/reports/summary", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const [wonRow] = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.businessId, businessId), eq(pipelineItemsTable.stage, "won")));

    const [lostRow] = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(and(eq(pipelineItemsTable.businessId, businessId), eq(pipelineItemsTable.stage, "lost")));

    const [totalRow] = await db
      .select({ count: count() })
      .from(pipelineItemsTable)
      .where(eq(pipelineItemsTable.businessId, businessId));

    const wonCount = Number(wonRow.count);
    const lostCount = Number(lostRow.count);
    const totalApplications = Number(totalRow.count);
    const pendingCount = totalApplications - wonCount - lostCount;
    const successRate =
      totalApplications > 0
        ? Math.round((wonCount / totalApplications) * 1000) / 10
        : 0;

    const wonItems = await db
      .select({ estimatedValue: tendersTable.estimatedValue })
      .from(pipelineItemsTable)
      .innerJoin(tendersTable, eq(pipelineItemsTable.tenderId, tendersTable.id))
      .where(and(eq(pipelineItemsTable.businessId, businessId), eq(pipelineItemsTable.stage, "won")));

    const totalWonValue = wonItems.reduce((s, r) => s + (r.estimatedValue ?? 0), 0);

    const [matchRow] = await db
      .select({ count: count() })
      .from(matchesTable)
      .where(eq(matchesTable.businessId, businessId));
    const matchCount = Number(matchRow.count);

    const aiSummary =
      totalApplications === 0
        ? "Henüz boru hattı aktivitesi yok. İhale fırsatlarını takip etmeye başlamak için Fırsatlarım sayfasını kullanın."
        : `Toplam ${totalApplications} ihale takibinde bulunuyorsunuz. Kazanılan: ${wonCount}, kaybedilen: ${lostCount}, devam eden: ${pendingCount}. Başarı oranınız %${successRate}.`;

    res.json({
      totalApplications,
      wonCount,
      lostCount,
      pendingCount: Math.max(0, pendingCount),
      successRate,
      totalWonValue,
      matchCount,
      aiSummary,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/applications-chart", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

    const rows = await db.execute<{ ym: string; applications: string; wins: string }>(
      sql`
        SELECT
          to_char(pi.created_at, 'YYYY-MM') AS ym,
          COUNT(*)::text AS applications,
          COUNT(*) FILTER (WHERE pi.stage = 'won')::text AS wins
        FROM pipeline_items pi
        WHERE pi.business_id = ${businessId}
        GROUP BY to_char(pi.created_at, 'YYYY-MM')
        ORDER BY ym
        LIMIT 12
      `,
    );

    const byKey = new Map(rows.rows.map((r) => [r.ym, { applications: parseInt(r.applications, 10), wins: parseInt(r.wins, 10) }]));

    const now = new Date();
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = byKey.get(key) ?? { applications: 0, wins: 0 };
      data.push({ month: monthNames[d.getMonth()], ...entry });
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/category-performance", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const rows = await db.execute<{ category: string; applications: string; wins: string }>(
      sql`
        SELECT
          t.category,
          COUNT(*)::text AS applications,
          COUNT(*) FILTER (WHERE pi.stage = 'won')::text AS wins
        FROM pipeline_items pi
        JOIN tenders t ON t.id = pi.tender_id
        WHERE pi.business_id = ${businessId}
          AND t.category IS NOT NULL
          AND t.category <> ''
        GROUP BY t.category
        ORDER BY COUNT(*) DESC
        LIMIT 8
      `,
    );

    res.json(
      rows.rows.map((r) => {
        const applications = parseInt(r.applications, 10);
        const wins = parseInt(r.wins, 10);
        return {
          category: r.category,
          applications,
          wins,
          winRate:
            applications > 0
              ? Math.round((wins / applications) * 1000) / 10
              : 0,
        };
      }),
    );
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
