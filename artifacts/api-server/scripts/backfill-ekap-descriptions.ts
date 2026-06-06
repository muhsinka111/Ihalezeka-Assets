import { db, tendersTable } from "@workspace/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { fetchEkapDetailText } from "../src/scrapers/ekap-client.js";

/**
 * Backfill EKAP `description` from the EKAP detail/announcement endpoint, using
 * `dokumanListe[].ihaleId` (falling back to raw_data.id). Targets the most
 * recent EKAP rows that have no stored description.
 *
 * NOTE: EKAP's public v2 detail routes are currently unreachable from outside
 * the portal (the detail endpoint 404s, the announcement service 406s — see
 * fetchEkapDetailText), so this will update 0 rows today. It is committed as the
 * required mechanism: once EKAP exposes a usable detail endpoint, re-running
 * this script upgrades EKAP grounding from metadata to notice quality. Until
 * then EKAP tenders are grounded on metadata, which already yields real,
 * non-refusal summaries.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/backfill-ekap-descriptions.ts [limit]
 */
async function main() {
  const limit = Number(process.argv[2] ?? 200);

  const rows = await db
    .select({ id: tendersTable.id, rawData: tendersTable.rawData })
    .from(tendersTable)
    .where(
      and(
        eq(tendersTable.sourceSystem, "ekap"),
        or(isNull(tendersTable.description), eq(tendersTable.description, "")),
      ),
    )
    .orderBy(desc(tendersTable.lastFetchedAt))
    .limit(limit);

  let updated = 0;
  let unavailable = 0;
  for (const row of rows) {
    const raw = (row.rawData as Record<string, unknown> | null) ?? {};
    const docList = (raw.dokumanListe as Array<{ ihaleId?: string | number }> | undefined) ?? [];
    const ihaleId =
      docList.find((d) => d?.ihaleId != null)?.ihaleId ??
      (raw.id as string | number | undefined);
    if (ihaleId == null) {
      unavailable++;
      continue;
    }
    const text = await fetchEkapDetailText(ihaleId);
    if (!text) {
      unavailable++;
      continue;
    }
    await db
      .update(tendersTable)
      .set({ description: text })
      .where(eq(tendersTable.id, row.id));
    updated++;
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
    `ekap backfill: ${updated} updated, ${unavailable} detail-unavailable (out of ${rows.length} candidates), now ${withDesc} with description`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
