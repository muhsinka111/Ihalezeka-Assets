import { Router } from "express";
import { db } from "@workspace/db";
import { awardResultsTable, tendersTable, companyProfilesTable } from "@workspace/db";
import { eq, sql, and, isNotNull, ne } from "drizzle-orm";
import { requirePro } from "../lib/authHelpers.js";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger.js";

const router = Router();

router.use("/competitors", requirePro);

/** Load company profile for the authenticated user. Returns null when none exists. */
async function loadProfile(req: Parameters<typeof getAuth>[0]) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return null;
    const [profile] = await db
      .select()
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.businessId, userId))
      .limit(1);
    return profile ?? null;
  } catch {
    return null;
  }
}

// ── GET /competitors ─────────────────────────────────────────────────────────
// Returns competitors ranked by win count with avg discount rate and encounter count.
// Scoped to categories/regions matching the user's profile when available.
router.get("/competitors", async (req, res) => {
  try {
    const profile = await loadProfile(req);
    const userCompany = profile?.companyName?.trim().toLowerCase() ?? null;

    // Build category/region filter conditions based on user profile
    const conditions: string[] = [
      `ar.awarded_company IS NOT NULL`,
      `ar.awarded_company <> ''`,
    ];
    if (userCompany) {
      conditions.push(`LOWER(ar.awarded_company) <> '${userCompany.replace(/'/g, "''")}'`);
    }
    if (profile?.preferredProvinces?.length) {
      const ils = profile.preferredProvinces.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
      conditions.push(`(ar.il IS NULL OR ar.il = '' OR ar.il IN (${ils}))`);
    }

    const whereClause = conditions.join(" AND ");

    const rows = await db.execute<{
      company: string;
      won_tenders: string;
      avg_discount: string | null;
      il_list: string | null;
      category_list: string | null;
    }>(
      sql.raw(`
        SELECT
          ar.awarded_company AS company,
          COUNT(*) AS won_tenders,
          AVG(
            CASE
              WHEN ar.awarded_price > 0 AND ar.estimated_value > 0
              THEN (1.0 - ar.awarded_price / ar.estimated_value) * 100
            END
          ) AS avg_discount,
          STRING_AGG(DISTINCT ar.il, ', ' ORDER BY ar.il) FILTER (WHERE ar.il IS NOT NULL AND ar.il <> '') AS il_list,
          STRING_AGG(DISTINCT ar.category, ', ' ORDER BY ar.category) FILTER (WHERE ar.category IS NOT NULL AND ar.category <> '') AS category_list
        FROM award_results ar
        WHERE ${whereClause}
        GROUP BY ar.awarded_company
        ORDER BY COUNT(*) DESC
        LIMIT 30
      `),
    );

    const competitors = rows.rows.map((r, idx) => ({
      id: idx + 1,
      name: r.company,
      wonTenders: parseInt(r.won_tenders, 10),
      avgDiscountRate: r.avg_discount != null ? Math.max(0, parseFloat(r.avg_discount)) : 0,
      encounters: parseInt(r.won_tenders, 10),
    }));

    res.json(competitors);
  } catch (err) {
    logger.error({ err }, "GET /competitors failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /competitors/insights ────────────────────────────────────────────────
// AI-generated insight paragraph + category win-rate chart data.
router.get("/competitors/insights", async (req, res) => {
  try {
    // Category win rate data: average discount per category from award_results
    const catRows = await db.execute<{
      category: string;
      total: string;
      with_price: string;
      avg_discount: string | null;
    }>(
      sql`
        SELECT
          ar.category,
          COUNT(*) AS total,
          COUNT(ar.awarded_price) FILTER (WHERE ar.awarded_price IS NOT NULL AND ar.estimated_value IS NOT NULL AND ar.estimated_value > 0) AS with_price,
          AVG(
            CASE
              WHEN ar.awarded_price > 0 AND ar.estimated_value > 0
              THEN (1.0 - ar.awarded_price / ar.estimated_value) * 100
            END
          ) AS avg_discount
        FROM award_results ar
        WHERE ar.category IS NOT NULL AND ar.category <> ''
        GROUP BY ar.category
        ORDER BY COUNT(*) DESC
        LIMIT 8
      `,
    );

    const categoryWinRates = catRows.rows.map((r) => ({
      category: r.category,
      applications: parseInt(r.total, 10),
      wins: parseInt(r.with_price, 10),
      winRate: r.avg_discount != null ? Math.max(0, Math.min(100, parseFloat(r.avg_discount))) : 0,
    }));

    // Top competitors for AI insight
    const topRows = await db.execute<{ company: string; wins: string; avg_discount: string | null }>(
      sql`
        SELECT
          awarded_company AS company,
          COUNT(*) AS wins,
          AVG(
            CASE
              WHEN awarded_price > 0 AND estimated_value > 0
              THEN (1.0 - awarded_price / estimated_value) * 100
            END
          ) AS avg_discount
        FROM award_results
        WHERE awarded_company IS NOT NULL AND awarded_company <> ''
        GROUP BY awarded_company
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `,
    );

    const totalAwards = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM award_results`,
    );
    const total = parseInt(totalAwards.rows[0]?.cnt ?? "0", 10);

    let aiInsight: string;

    if (total === 0) {
      aiInsight =
        "İhale sonuç verileri henüz toplanıyor. İlk veri işlendikten sonra rakip analizi ve kategori kırım oranları burada görünecektir.";
    } else if (topRows.rows.length === 0) {
      aiInsight =
        `${total} ihale sonuç kaydı analiz edildi. Profil kategorilerinizde rakip firma bulunamadı. Profil bilgilerinizi güncelleyerek sektör odaklı analiz yapabilirsiniz.`;
    } else {
      // Generate AI insight from real data
      const topList = topRows.rows
        .map((r) => {
          const disc = r.avg_discount != null ? `%${parseFloat(r.avg_discount).toFixed(1)} kırım oranıyla` : "";
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
// Tenders where this competitor won, optionally filtered to the user's sectors.
router.get("/competitors/:company/head-to-head", async (req, res) => {
  try {
    const company = decodeURIComponent(req.params.company);
    const profile = await loadProfile(req);

    const conditions: string[] = [
      `LOWER(ar.awarded_company) = LOWER('${company.replace(/'/g, "''")}')`,
    ];
    if (profile?.preferredProvinces?.length) {
      const ils = profile.preferredProvinces.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
      conditions.push(`(ar.il IS NULL OR ar.il = '' OR ar.il IN (${ils}))`);
    }

    const rows = await db.execute<{
      ikn: string;
      agency_name: string | null;
      category: string | null;
      il: string | null;
      awarded_price: number | null;
      estimated_value: number | null;
      award_date: string | null;
    }>(
      sql.raw(`
        SELECT
          ar.ikn,
          ar.agency_name,
          ar.category,
          ar.il,
          ar.awarded_price,
          ar.estimated_value,
          ar.award_date
        FROM award_results ar
        WHERE ${conditions.join(" AND ")}
        ORDER BY ar.award_date DESC NULLS LAST
        LIMIT 25
      `),
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
    }));

    res.json({ company, items, total: items.length });
  } catch (err) {
    logger.error({ err }, "GET /competitors/:company/head-to-head failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
