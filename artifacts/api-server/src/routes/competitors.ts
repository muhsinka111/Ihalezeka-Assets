import { Router } from "express";
import { db } from "@workspace/db";
import { awardResultsTable, companyProfilesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requirePro, getBusinessId } from "../lib/authHelpers.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * Build a parameterized province filter fragment:
 *   (ar.il IS NULL OR ar.il = '' OR ar.il = ANY(ARRAY[$1, $2, ...]))
 * Using ARRAY[] syntax avoids the Drizzle pitfall of expanding an array
 * into a row expression ANY(($1,$2)) which Postgres rejects.
 */
function ilFilter(provinces: string[]) {
  const arr = sql.join(
    provinces.map((p) => sql`${p}`),
    sql`, `,
  );
  return sql`(ar.il IS NULL OR ar.il = '' OR ar.il = ANY(ARRAY[${arr}]))`;
}

router.use("/competitors", requirePro);

/** Load company profile for the current business scope. */
async function loadProfile(req: Parameters<typeof getBusinessId>[0]) {
  try {
    const businessId = getBusinessId(req);
    const [profile] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, businessId))
      .limit(1);
    return profile ?? null;
  } catch {
    return null;
  }
}

// ── GET /competitors ─────────────────────────────────────────────────────────
// Returns competitors ranked by win count with avg discount rate and encounter count.
// Scoped to provinces matching the user's profile when available.
// encounters = tenders won by this competitor that also exist in user's tender feed.
router.get("/competitors", async (req, res) => {
  try {
    const profile = await loadProfile(req);
    const userCompany = profile?.companyName?.trim().toLowerCase() ?? null;

    // Build individual SQL filter fragments (parameterized)
    const filters: ReturnType<typeof sql>[] = [
      sql`ar.awarded_company IS NOT NULL`,
      sql`ar.awarded_company <> ''`,
    ];
    if (userCompany) {
      filters.push(sql`LOWER(ar.awarded_company) <> ${userCompany}`);
    }
    if (profile?.preferredProvinces?.length) {
      filters.push(ilFilter(profile.preferredProvinces));
    }

    // Combine filters with AND
    const whereClause = filters.reduce((acc, f) => sql`${acc} AND ${f}`);

    const rows = await db.execute<{
      company: string;
      won_tenders: string;
      encounters: string;
      avg_discount: string | null;
    }>(
      sql`
        SELECT
          ar.awarded_company AS company,
          COUNT(*)::text AS won_tenders,
          SUM(
            CASE WHEN EXISTS (SELECT 1 FROM tenders t WHERE t.ikn = ar.ikn) THEN 1 ELSE 0 END
          )::text AS encounters,
          AVG(
            CASE
              WHEN ar.awarded_price > 0 AND ar.estimated_value > 0
              THEN (1.0 - ar.awarded_price / ar.estimated_value) * 100
            END
          )::text AS avg_discount
        FROM award_results ar
        WHERE ${whereClause}
        GROUP BY ar.awarded_company
        ORDER BY COUNT(*) DESC
        LIMIT 30
      `,
    );

    const competitors = rows.rows.map((r, idx) => ({
      id: idx + 1,
      name: r.company,
      wonTenders: parseInt(r.won_tenders, 10),
      avgDiscountRate: r.avg_discount != null ? Math.max(0, parseFloat(r.avg_discount)) : 0,
      encounters: parseInt(r.encounters, 10),
    }));

    res.json(competitors);
  } catch (err) {
    logger.error({ err }, "GET /competitors failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /competitors/insights ────────────────────────────────────────────────
// AI-generated insight paragraph + category performance data.
// winRate = user's own win rate per category (wins where awarded_company = user's company).
router.get("/competitors/insights", async (req, res) => {
  try {
    const profile = await loadProfile(req);
    const userCompany = profile?.companyName?.trim() ?? null;

    // Category performance: user win rate per category
    // applications = total concluded tenders in this category
    // wins         = concluded tenders in this category that user's company won
    // winRate      = wins / applications * 100
    const catRows = await db.execute<{
      category: string;
      applications: string;
      wins: string;
      win_rate: string | null;
    }>(
      userCompany
        ? sql`
            SELECT
              ar.category,
              COUNT(*)::text AS applications,
              COUNT(*) FILTER (WHERE LOWER(ar.awarded_company) = LOWER(${userCompany}))::text AS wins,
              (
                COUNT(*) FILTER (WHERE LOWER(ar.awarded_company) = LOWER(${userCompany}))
                * 100.0
                / NULLIF(COUNT(*), 0)
              )::text AS win_rate
            FROM award_results ar
            WHERE ar.category IS NOT NULL AND ar.category <> ''
            GROUP BY ar.category
            ORDER BY COUNT(*) DESC
            LIMIT 8
          `
        : sql`
            SELECT
              ar.category,
              COUNT(*)::text AS applications,
              '0'::text AS wins,
              '0'::text AS win_rate
            FROM award_results ar
            WHERE ar.category IS NOT NULL AND ar.category <> ''
            GROUP BY ar.category
            ORDER BY COUNT(*) DESC
            LIMIT 8
          `,
    );

    const categoryWinRates = catRows.rows.map((r) => ({
      category: r.category,
      applications: parseInt(r.applications, 10),
      wins: parseInt(r.wins, 10),
      winRate: r.win_rate != null ? Math.max(0, Math.min(100, parseFloat(r.win_rate))) : 0,
    }));

    // Top competitors for AI insight
    const topRows = await db.execute<{ company: string; wins: string; avg_discount: string | null }>(
      sql`
        SELECT
          awarded_company AS company,
          COUNT(*)::text AS wins,
          AVG(
            CASE
              WHEN awarded_price > 0 AND estimated_value > 0
              THEN (1.0 - awarded_price / estimated_value) * 100
            END
          )::text AS avg_discount
        FROM award_results
        WHERE awarded_company IS NOT NULL AND awarded_company <> ''
        GROUP BY awarded_company
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `,
    );

    const totalAwards = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*)::text AS cnt FROM award_results`,
    );
    const total = parseInt(totalAwards.rows[0]?.cnt ?? "0", 10);

    let aiInsight: string;

    if (total === 0) {
      aiInsight =
        "İhale sonuç verileri henüz toplanıyor. İlk veri işlendikten sonra rakip analizi ve kategori kırım oranları burada görünecektir.";
    } else if (topRows.rows.length === 0) {
      aiInsight = `${total} ihale sonuç kaydı analiz edildi. Profil kategorilerinizde rakip firma bulunamadı. Profil bilgilerinizi güncelleyerek sektör odaklı analiz yapabilirsiniz.`;
    } else {
      const topList = topRows.rows
        .map((r) => {
          const disc =
            r.avg_discount != null ? `%${parseFloat(r.avg_discount).toFixed(1)} kırım oranıyla` : "";
          return `${r.company} (${r.wins} ihale kazandı${disc ? ", " + disc : ""})`;
        })
        .join("; ");

      try {
        const { openai } = await import("@workspace/integrations-openai-ai-server");
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Sen Türkiye kamu ihalesi danışmanısın. Rakip analizi verilerini inceleyerek kullanıcıya kısa, pratik Türkçe tavsiye ver. 2-3 cümle, sade dil.",
            },
            {
              role: "user",
              content: `Analiz edilen ${total} ihale sonucuna göre öne çıkan rakipler: ${topList}. Bu verilere dayanarak stratejik tavsiye ver.`,
            },
          ],
          max_tokens: 250,
          temperature: 0.6,
        } as any);
        aiInsight = completion.choices[0]?.message?.content?.trim() ?? topList;
      } catch (err) {
        logger.debug({ err }, "AI insight generation failed, using fallback");
        aiInsight = `${total} ihale sonucu analiz edildi. Sektörde öne çıkan rakipler: ${topList}.`;
      }
    }

    res.json({ aiInsight, categoryWinRates });
  } catch (err) {
    logger.error({ err }, "GET /competitors/insights failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /competitors/:company/head-to-head ───────────────────────────────────
// Tenders where this competitor won AND the tender also appeared in the user's feed.
// This gives the true "where you could have met this competitor" view.
router.get("/competitors/:company/head-to-head", async (req, res) => {
  try {
    const company = decodeURIComponent(req.params.company);
    const profile = await loadProfile(req);

    const baseFilters: ReturnType<typeof sql>[] = [
      sql`LOWER(ar.awarded_company) = LOWER(${company})`,
    ];
    if (profile?.preferredProvinces?.length) {
      baseFilters.push(ilFilter(profile.preferredProvinces));
    }
    const whereClause = baseFilters.reduce((acc, f) => sql`${acc} AND ${f}`);

    const rows = await db.execute<{
      ikn: string;
      agency_name: string | null;
      category: string | null;
      il: string | null;
      awarded_price: number | null;
      estimated_value: number | null;
      award_date: string | null;
      bidder_count: number | null;
      in_feed: boolean;
    }>(
      sql`
        SELECT
          ar.ikn,
          ar.agency_name,
          ar.category,
          ar.il,
          ar.awarded_price,
          ar.estimated_value,
          ar.award_date,
          ar.bidder_count,
          EXISTS(SELECT 1 FROM tenders t WHERE t.ikn = ar.ikn) AS in_feed
        FROM award_results ar
        WHERE ${whereClause}
        ORDER BY ar.award_date DESC NULLS LAST
        LIMIT 25
      `,
    );

    const items = rows.rows.map((r) => ({
      ikn: r.ikn,
      agencyName: r.agency_name,
      category: r.category,
      il: r.il,
      awardedPrice: r.awarded_price,
      estimatedValue: r.estimated_value,
      discountRate:
        r.awarded_price != null && r.estimated_value != null && r.estimated_value > 0
          ? (1 - r.awarded_price / r.estimated_value) * 100
          : null,
      awardDate: r.award_date,
      bidderCount: r.bidder_count,
      inFeed: r.in_feed,
    }));

    res.json({ company, items, total: items.length });
  } catch (err) {
    logger.error({ err }, "GET /competitors/:company/head-to-head failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
