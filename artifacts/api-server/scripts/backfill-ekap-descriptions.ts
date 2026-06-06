import { db, tendersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { enrichEkapTender } from "../src/scrapers/ekap-client.js";
import { analyzeTender } from "../src/services/document-analyzer.js";

/**
 * Backfill EKAP `description` (notice/spec text) and the official `documents`
 * URL from the EKAP v2 detail endpoint, keyed by the tender's TOP-LEVEL hash id
 * (raw_data.id). Then re-run AI analysis so the stored summary reflects the
 * richer notice text instead of the old metadata-only grounding.
 *
 * The most recent EKAP rows are targeted (they have live, resolvable detail).
 * Each step degrades silently: a tender that can't be enriched keeps its
 * existing description/analysis.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/backfill-ekap-descriptions.ts [limit] [--reanalyze]
 */
async function main() {
  const limit = Number(process.argv[2] ?? 50);
  const reanalyze = process.argv.includes("--reanalyze");

  const rows = await db
    .select()
    .from(tendersTable)
    .where(eq(tendersTable.sourceSystem, "ekap"))
    .orderBy(desc(tendersTable.lastFetchedAt))
    .limit(limit);

  let enriched = 0;
  let docsResolved = 0;
  let unavailable = 0;
  let reanalyzed = 0;
  const sourceCounts: Record<string, number> = {};

  for (const row of rows) {
    const raw = (row.rawData as Record<string, unknown> | null) ?? {};
    const hashId = typeof raw.id === "string" ? raw.id : null;
    if (!hashId) {
      unavailable++;
      continue;
    }

    let description = row.description ?? "";
    let documents = row.documents;
    try {
      const enrichment = await enrichEkapTender(hashId);
      const patch: Partial<typeof row> = {};
      if (enrichment.detailText.length >= 200) {
        description = enrichment.detailText;
        patch.description = enrichment.detailText;
      }
      if (enrichment.documents.length > 0) {
        documents = enrichment.documents;
        patch.documents = enrichment.documents;
        docsResolved++;
      }
      if (Object.keys(patch).length > 0) {
        await db
          .update(tendersTable)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(tendersTable.id, row.id));
        enriched++;
      } else {
        unavailable++;
      }
    } catch (err) {
      unavailable++;
      console.warn(`  enrich failed id=${row.id}: ${String(err)}`);
      continue;
    }

    if (reanalyze) {
      try {
        const { analysis, groundingSource } = await analyzeTender({
          title: row.title,
          type: row.type,
          method: row.method,
          agencyName: row.agencyName,
          il: row.il,
          category: row.category,
          cpvCodes: row.cpvCodes,
          estimatedValue: row.estimatedValue,
          deadline: row.deadline,
          sourceUrl: row.sourceUrl,
          description,
          documents: documents as Array<{ name: string; url: string; type: string }> | null,
          rawData: row.rawData,
        });
        await db
          .update(tendersTable)
          .set({ aiSummary: analysis, updatedAt: new Date() })
          .where(eq(tendersTable.id, row.id));
        sourceCounts[groundingSource] = (sourceCounts[groundingSource] ?? 0) + 1;
        reanalyzed++;
      } catch (err) {
        console.warn(`  reanalyze failed id=${row.id}: ${String(err)}`);
      }
    }
  }

  const [{ count: withDesc }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tendersTable)
    .where(
      and(
        eq(tendersTable.sourceSystem, "ekap"),
        sql`coalesce(btrim(${tendersTable.description}), '') <> ''`,
      ),
    );

  console.log(
    `ekap backfill: ${enriched} enriched, ${docsResolved} doc-urls resolved, ` +
      `${unavailable} unavailable (of ${rows.length} candidates), now ${withDesc} with description`,
  );
  if (reanalyze) {
    console.log(`re-analyzed ${reanalyzed}; grounding sources:`, sourceCounts);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
