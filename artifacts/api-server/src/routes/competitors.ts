import { Router } from "express";
import { db } from "@workspace/db";
import { awardResultsTable, companyProfilesTable, matchesTable, tendersTable } from "@workspace/db";
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
function ilFilter(provinces: string[], alias = "ar") {
  const arr = sql.join(
    provinces.map((p) => sql`${p}`),
    sql`, `,
  );
  return sql`(${sql.raw(alias)}.il IS NULL OR ${sql.raw(alias)}.il = '' OR ${sql.raw(alias)}.il = ANY(ARRAY[${arr}]))`;
}

/**
 * Build a parameterized category filter fragment:
 *   ar.category = ANY(ARRAY[$1, $2, ...])
 */
function categoryFilter(categories: string[], alias = "ar") {
  const arr = sql.join(
    categories.map((c) => sql`${c}`),
    sql`, `,
  );
  return sql`${sql.raw(alias)}.category = ANY(ARRAY[${arr}])`;
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

/**
 * Derive the active tender categories for a business scope.
 *
 * Priority:
 * 1. Categories in award_results where this company has historically won
 *    (strongest signal — categories they actually compete in).
 * 2. Categories from tenders in the user's match feed
 *    (what the platform surfaced as relevant).
 * 3. null → no category filter (profile has no usable history yet).
 */
async function deriveUserCategories(businessId: string, userCompany: string | null): Promise<string[] | null> {
  if (userCompany) {
    const wonCats = await db.execute<{ category: string }>(
      sql`
        SELECT DISTINCT category
        FROM award_results
        WHERE awarded_company ILIKE ${userCompany}
          AND category IS NOT NULL
          AND category <> ''
        LIMIT 20
      `,
    );
    if (wonCats.rows.length > 0) {
      return wonCats.rows.map((r) => r.category);
    }
  }

  // Fallback: categories from the user's matched tenders
  const matchCats = await db.execute<{ category: string }>(
    sql`
      SELECT DISTINCT t.category
      FROM matches m
      JOIN tenders t ON t.id = m.tender_id
      WHERE m.business_id = ${businessId}
        AND t.category IS NOT NULL
        AND t.category <> ''
        AND t.category <> 'ihale'
      LIMIT 20
    `,
  );
  if (matchCats.rows.length > 0) {
    return matchCats.rows.map((r) => r.category);
  }

  return null;
}

// ── GET /competitors ─────────────────────────────────────────────────────────
// Returns competitors ranked by win count, scoped to the user's active provinces
// AND categories (derived from their own win/match history). Includes sectors
// (unique categories) and regions (unique provinces) per competitor.
//
// encounters = tenders this competitor won that are also in the current
// business's match feed (matched via matches.business_id). This is the proxy
// for "tenders where user could have competed," since EKAP only exposes the
// winner — individual participant data is not available.
router.get("/competitors", async (req, res) => {
  try {
    const profile = await loadProfile(req);
    const businessId = getBusinessId(req);
    const userCompany = profile?.companyName?.trim().toLowerCase() ?? null;
    const userCategories = await deriveUserCategories(businessId, userCompany);

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
    if (userCategories && userCategories.length > 0) {
      filters.push(categoryFilter(userCategories));
    }

    const whereClause = filters.reduce((acc, f) => sql`${acc} AND ${f}`);

    const rows = await db.execute<{
      company: string;
      won_tenders: string;
      encounters: string;
      avg_discount: string | null;
      sectors: string[] | null;
      regions: string[] | null;
    }>(
      sql`
        SELECT
          ar.awarded_company AS company,
          COUNT(*)::text AS won_tenders,
          SUM(
            CASE WHEN EXISTS (
              SELECT 1 FROM tenders t
              JOIN matches m ON m.tender_id = t.id
              WHERE t.ikn = ar.ikn AND m.business_id = ${businessId}
            ) THEN 1 ELSE 0 END
          )::text AS encounters,
          AVG(
            CASE
              WHEN ar.awarded_price > 0 AND ar.estimated_value > 0
              THEN (1.0 - ar.awarded_price / ar.estimated_value) * 100
            END
          )::text AS avg_discount,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT ar.category), NULL) AS sectors,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT ar.il), NULL) AS regions
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
      sectors: (r.sectors ?? []).filter(Boolean),
      regions: (r.regions ?? []).filter(Boolean),
    }));

    res.json(competitors);
  } catch (err) {
    logger.error({ err }, "GET /competitors failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /competitors/insights ────────────────────────────────────────────────
// AI-generated insight paragraph + category performance data.
// Both the category win rates and the top-3 competitor query are scoped to the
// same profile overlap (category + province) as GET /competitors.
router.get("/competitors/insights", async (req, res) => {
  try {
    const profile = await loadProfile(req);
    const businessId = getBusinessId(req);
    const userCompany = profile?.companyName?.trim() ?? null;
    const userCompanyLower = userCompany?.toLowerCase() ?? null;
    const userCategories = await deriveUserCategories(businessId, userCompanyLower);

    // Shared scope filters (category + province) — same as /competitors
    const scopeFilters: ReturnType<typeof sql>[] = [
      sql`ar.awarded_company IS NOT NULL`,
      sql`ar.awarded_company <> ''`,
    ];
    if (userCompanyLower) {
      scopeFilters.push(sql`LOWER(ar.awarded_company) <> ${userCompanyLower}`);
    }
    if (profile?.preferredProvinces?.length) {
      scopeFilters.push(ilFilter(profile.preferredProvinces));
    }
    if (userCategories && userCategories.length > 0) {
      scopeFilters.push(categoryFilter(userCategories));
    }
    const scopeWhere = scopeFilters.reduce((acc, f) => sql`${acc} AND ${f}`);

    // Category performance: user win rate per category (scoped to same filters)
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
              ${userCategories?.length ? sql`AND ${categoryFilter(userCategories)}` : sql``}
              ${profile?.preferredProvinces?.length ? sql`AND ${ilFilter(profile.preferredProvinces)}` : sql``}
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

    // Top 3 competitors — scoped to same profile overlap, user company excluded
    const topRows = await db.execute<{ company: string; wins: string; avg_discount: string | null }>(
      sql`
        SELECT
          ar.awarded_company AS company,
          COUNT(*)::text AS wins,
          AVG(
            CASE
              WHEN ar.awarded_price > 0 AND ar.estimated_value > 0
              THEN (1.0 - ar.awarded_price / ar.estimated_value) * 100
            END
          )::text AS avg_discount
        FROM award_results ar
        WHERE ${scopeWhere}
        GROUP BY ar.awarded_company
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `,
    );

    const scopedTotal = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*)::text AS cnt FROM award_results ar WHERE ${scopeWhere}`,
    );
    const total = parseInt(scopedTotal.rows[0]?.cnt ?? "0", 10);

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
        const { anthropic } = await import("@workspace/integrations-anthropic-ai");
        const completion = await anthropic.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 250,
          system: "Sen Türkiye kamu ihalesi danışmanısın. Rakip analizi verilerini inceleyerek kullanıcıya kısa, pratik Türkçe tavsiye ver. 2-3 cümle, sade dil.",
          messages: [
            {
              role: "user",
              content: `Profil kapsamında ${total} ihale sonucuna göre öne çıkan rakipler: ${topList}. Bu verilere dayanarak stratejik tavsiye ver.`,
            },
          ],
        });
        const firstBlock = completion.content[0];
        aiInsight = firstBlock?.type === "text" ? firstBlock.text.trim() : topList;
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
// Returns tenders where this competitor won AND the tender is in the current
// business's match feed (matches.business_id). This is the closest proxy for
// "tenders where the user competed and lost to this company" — EKAP only
// exposes the winner, so exact participant lists are unavailable.
router.get("/competitors/:company/head-to-head", async (req, res) => {
  try {
    const company = decodeURIComponent(req.params.company);
    const businessId = getBusinessId(req);
    const profile = await loadProfile(req);

    const baseFilters: ReturnType<typeof sql>[] = [
      sql`LOWER(ar.awarded_company) = LOWER(${company})`,
    ];
    if (profile?.preferredProvinces?.length) {
      baseFilters.push(ilFilter(profile.preferredProvinces));
    }
    const whereClause = baseFilters.reduce((acc, f) => sql`${acc} AND ${f}`);

    // INNER JOIN through matches scopes results to this business's feed.
    // Only tenders surfaced to this user (m.business_id) where competitor won.
    const rows = await db.execute<{
      ikn: string;
      agency_name: string | null;
      category: string | null;
      il: string | null;
      awarded_price: number | null;
      estimated_value: number | null;
      award_date: string | null;
      bidder_count: number | null;
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
          ar.bidder_count
        FROM award_results ar
        INNER JOIN tenders t ON t.ikn = ar.ikn
        INNER JOIN matches m ON m.tender_id = t.id AND m.business_id = ${businessId}
        WHERE ${whereClause}
        ORDER BY ar.award_date DESC NULLS LAST
        LIMIT 25
      `,
    );

    const items = rows.rows.map((r) => ({
      ikn: r.ikn,
      agencyName: r.agency_name ?? null,
      category: r.category ?? null,
      il: r.il ?? null,
      awardedPrice: r.awarded_price ?? null,
      estimatedValue: r.estimated_value ?? null,
      discountRate:
        r.awarded_price != null && r.estimated_value != null && r.estimated_value > 0
          ? (1 - r.awarded_price / r.estimated_value) * 100
          : null,
      awardDate: r.award_date ?? null,
      bidderCount: r.bidder_count ?? null,
    }));

    res.json({
      company,
      items,
      total: items.length,
      proxyBasis:
        "EKAP'ta yalnızca ihaleyi kazanan firma yayımlanır; bireysel katılımcı listesi alınamaz. " +
        "Listelenen ihaleler, bu hesabın fırsatlar akışında yer alan (matches.business_id ile eşleşen) " +
        "ve bu rakip firma tarafından kazanılmış ihalelerdir — kullanıcı karşılaşması için en yakın vekil.",
    });
  } catch (err) {
    logger.error({ err }, "GET /competitors/:company/head-to-head failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
