import { db, tendersTable } from "@workspace/db";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { deriveContact } from "../src/lib/contact.js";

/**
 * One-off, idempotent backfill of the structured `contact` column for tenders
 * that don't have one yet (WHERE contact IS NULL). Contact fields are derived
 * purely from already-harvested data — the agency name, the notice/description
 * text, and structured raw-data keys — with NO network calls (see
 * src/lib/contact.ts). Rows where nothing could be derived are left NULL.
 *
 * New tenders get `contact` populated at ingest by the scrapers, so re-running
 * this only touches rows scraped before the column existed. Paginates by id
 * cursor so it never loads all ~10k rows (with their large raw_data) at once.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/backfill-contacts.ts
 */
async function main() {
  const BATCH = 500;
  let lastId = 0;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const rows = await db
      .select({
        id: tendersTable.id,
        agencyName: tendersTable.agencyName,
        description: tendersTable.description,
        rawData: tendersTable.rawData,
      })
      .from(tendersTable)
      .where(and(isNull(tendersTable.contact), gt(tendersTable.id, lastId)))
      .orderBy(asc(tendersTable.id))
      .limit(BATCH);

    if (rows.length === 0) break;

    for (const row of rows) {
      lastId = row.id;
      scanned++;
      const contact = deriveContact({
        agencyName: row.agencyName,
        description: row.description,
        rawData: (row.rawData as Record<string, unknown> | null) ?? null,
      });
      if (!contact) {
        skipped++;
        continue;
      }
      await db
        .update(tendersTable)
        .set({ contact, updatedAt: new Date() })
        .where(eq(tendersTable.id, row.id));
      updated++;
    }

    console.log(`… scanned ${scanned}, updated ${updated}, skipped ${skipped} (cursor id=${lastId})`);
  }

  console.log(
    `Contact backfill done: scanned ${scanned}, updated ${updated} (contact set), ` +
      `skipped ${skipped} (no derivable fields).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Contact backfill failed:", err);
  process.exit(1);
});
