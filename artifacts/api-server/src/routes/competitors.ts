import { Router } from "express";
import { requirePro, getBusinessId } from "../lib/authHelpers.js";
import { db } from "@workspace/db";
import { competitorsTable, awardResultsTable } from "@workspace/db";
import { eq, desc, sql, ilike, and } from "drizzle-orm";

const router = Router();

router.use("/competitors", requirePro);

router.get("/competitors", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const rows = await db
      .select()
      .from(competitorsTable)
      .where(
        q
          ? sql`${competitorsTable.businessId} = ${businessId} AND ${competitorsTable.name} ILIKE ${"%" + q + "%"}`
          : eq(competitorsTable.businessId, businessId),
      )
      .orderBy(desc(competitorsTable.encounters))
      .limit(100);

    if (rows.length === 0) {
      res.json([]);
      return;
    }

    const enriched = await Promise.all(
      rows.map(async (c) => {
        const awardsAgg = await db
          .select({
            count: sql<number>`COUNT(*)::int`,
            categories: sql<string[]>`ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL)`,
            provinces: sql<string[]>`ARRAY_AGG(DISTINCT il) FILTER (WHERE il IS NOT NULL)`,
            agencies: sql<string[]>`ARRAY_AGG(DISTINCT agency_name) FILTER (WHERE agency_name IS NOT NULL)`,
            avgPrice: sql<number>`AVG(awarded_price)`,
            totalValue: sql<number>`COALESCE(SUM(awarded_price), 0)`,
          })
          .from(awardResultsTable)
          .where(ilike(awardResultsTable.awardedCompany, c.name));

        const agg = awardsAgg[0];
        return {
          ...c,
          categories: agg?.categories?.filter(Boolean)?.slice(0, 10) ?? [],
          provinces: agg?.provinces?.filter(Boolean)?.slice(0, 10) ?? [],
          agencies: agg?.agencies?.filter(Boolean)?.slice(0, 10) ?? [],
          totalAwards: agg?.count ?? 0,
          avgAwardPrice: agg?.avgPrice ?? 0,
          totalValue: agg?.totalValue ?? 0,
        };
      }),
    );

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/competitors/discover", async (req, res) => {
  try {
    const businessId = getBusinessId(req);

    const topCompanies = await db
      .select({
        company: awardResultsTable.awardedCompany,
        wins: sql<number>`COUNT(*)::int`,
        avgDiscount: sql<number>`AVG(CASE WHEN estimated_value > 0 AND awarded_price > 0 THEN ((estimated_value - awarded_price) / estimated_value) * 100 ELSE NULL END)`,
      })
      .from(awardResultsTable)
      .where(sql`awarded_company IS NOT NULL AND awarded_company != ''`)
      .groupBy(awardResultsTable.awardedCompany)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);

    let added = 0;
    for (const c of topCompanies) {
      if (!c.company) continue;
      const existing = await db
        .select({ id: competitorsTable.id })
        .from(competitorsTable)
        .where(and(eq(competitorsTable.businessId, businessId), ilike(competitorsTable.name, c.company)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(competitorsTable).values({
          businessId,
          name: c.company,
          wonTenders: c.wins,
          avgDiscountRate: c.avgDiscount ?? 0,
          encounters: c.wins,
        });
        added++;
      }
    }

    res.json({ added, total: topCompanies.length });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/competitors/:id/awards", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const competitorId = parseInt(req.params.id, 10);
    if (isNaN(competitorId)) {
      res.status(400).json({ error: "Invalid competitor id" });
      return;
    }

    const [competitor] = await db
      .select()
      .from(competitorsTable)
      .where(
        sql`${competitorsTable.id} = ${competitorId} AND ${competitorsTable.businessId} = ${businessId}`,
      )
      .limit(1);

    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }

    const awards = await db
      .select({
        id: awardResultsTable.id,
        ikn: awardResultsTable.ikn,
        awardedCompany: awardResultsTable.awardedCompany,
        awardedPrice: awardResultsTable.awardedPrice,
        estimatedValue: awardResultsTable.estimatedValue,
        bidderCount: awardResultsTable.bidderCount,
        awardDate: awardResultsTable.awardDate,
        category: awardResultsTable.category,
        il: awardResultsTable.il,
        agencyName: awardResultsTable.agencyName,
      })
      .from(awardResultsTable)
      .where(ilike(awardResultsTable.awardedCompany, competitor.name))
      .orderBy(desc(awardResultsTable.awardDate))
      .limit(200);

    const enrichedAwards = awards.map((a) => ({
      ...a,
      discountRate:
        a.estimatedValue && a.awardedPrice && a.estimatedValue > 0
          ? Math.round(((a.estimatedValue - a.awardedPrice) / a.estimatedValue) * 1000) / 10
          : null,
    }));

    res.json({ competitor, awards: enrichedAwards });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/competitors/market-overview", async (req, res) => {
  try {
    const topWinners = await db
      .select({
        company: awardResultsTable.awardedCompany,
        wins: sql<number>`COUNT(*)::int`,
        avgDiscount: sql<number>`AVG(CASE WHEN estimated_value > 0 AND awarded_price > 0 THEN ((estimated_value - awarded_price) / estimated_value) * 100 ELSE NULL END)`,
        totalValue: sql<number>`COALESCE(SUM(awarded_price), 0)`,
        avgBidders: sql<number>`AVG(bidder_count)`,
      })
      .from(awardResultsTable)
      .where(sql`awarded_company IS NOT NULL AND awarded_company != ''`)
      .groupBy(awardResultsTable.awardedCompany)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);

    const categoryStats = await db
      .select({
        category: awardResultsTable.category,
        count: sql<number>`COUNT(*)::int`,
        avgDiscount: sql<number>`AVG(CASE WHEN estimated_value > 0 AND awarded_price > 0 THEN ((estimated_value - awarded_price) / estimated_value) * 100 ELSE NULL END)`,
        avgBidders: sql<number>`AVG(bidder_count)`,
        avgPrice: sql<number>`AVG(awarded_price)`,
      })
      .from(awardResultsTable)
      .where(sql`category IS NOT NULL AND category != ''`)
      .groupBy(awardResultsTable.category)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    res.json({ topWinners, categoryStats });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
