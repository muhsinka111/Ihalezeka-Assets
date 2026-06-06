import { db, tendersTable } from "@workspace/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { stripHtml } from "../src/services/document-analyzer.js";

/**
 * One-time backfill: derive a plain-text `description` for ilan_gov tenders from
 * the notice HTML stored in raw_data.content, reusing the exact stripHtml the
 * grounding chain uses (the SQL approximation mangled <style> blocks).
 */
async function main() {
  const rows = await db
    .select({ id: tendersTable.id, rawData: tendersTable.rawData })
    .from(tendersTable)
    .where(
      and(
        eq(tendersTable.sourceSystem, "ilan_gov"),
        or(isNull(tendersTable.description), eq(tendersTable.description, "")),
      ),
    );

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const raw = (row.rawData as Record<string, unknown> | null) ?? {};
    const content = typeof raw.content === "string" ? raw.content : "";
    const text = content ? stripHtml(content).slice(0, 20_000) : "";
    if (text.length < 20) {
      skipped++;
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
        eq(tendersTable.sourceSystem, "ilan_gov"),
        sql`coalesce(btrim(${tendersTable.description}), '') <> ''`,
      ),
    );

  console.log(
    `ilan_gov backfill: ${updated} updated, ${skipped} skipped (no usable text), now ${withDesc} with description`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
