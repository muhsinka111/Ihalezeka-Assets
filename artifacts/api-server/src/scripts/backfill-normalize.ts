import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";

/**
 * Re-normalize historical tender rows so they reflect the corrected, honest
 * data logic:
 *
 *  1. estimatedValue: every legacy row hardcoded a fake `0`. Convert those to
 *     NULL ("Belirtilmemiş / not disclosed") so the budget filter and cards no
 *     longer treat them as a real ₺0 value.
 *
 *  2. ilan.gov.tr deadlines: the old mapper fabricated `publishStartDate + 30
 *     days` for every ilan_gov record because the list API has no deadline.
 *     These are all invented, so we null them. Going-forward scrapes fetch the
 *     ad detail and populate a real deadline where one exists.
 */
async function backfill() {
  console.log("Backfill: normalizing tender values & fabricated deadlines…");

  const zeroValues = await db
    .update(tendersTable)
    .set({ estimatedValue: null })
    .where(eq(tendersTable.estimatedValue, 0))
    .returning({ id: tendersTable.id });
  console.log(`  • estimatedValue 0 → NULL: ${zeroValues.length} rows`);

  const ilanDeadlines = await db
    .update(tendersTable)
    .set({ deadline: null })
    .where(eq(tendersTable.sourceSystem, "ilan_gov"))
    .returning({ id: tendersTable.id });
  console.log(`  • ilan_gov fabricated deadline → NULL: ${ilanDeadlines.length} rows`);

  const remaining = await db
    .select({ c: sql<number>`count(*)` })
    .from(tendersTable)
    .where(eq(tendersTable.estimatedValue, 0));
  console.log(`  • remaining rows with value=0: ${Number(remaining[0]?.c ?? 0)}`);

  console.log("Backfill complete.");
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
