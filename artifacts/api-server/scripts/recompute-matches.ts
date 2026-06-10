import { db, tendersTable, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scoreNewTenders } from "../src/lib/tenderScorer.js";

/**
 * Recompute the demo business's matches ("Fırsatlarım") against REAL tenders
 * using the existing AI / rule-based scorer (scoreNewTenders).
 *
 * By default it targets only tenders that have NO match for the demo business
 * yet, so the thousands of already-scored matches aren't needlessly re-billed.
 * Pass --all to rescore every tender.
 *
 * It calls scoreNewTenders DIRECTLY (not scoreAndNotify), so no notification
 * flood is dispatched for backfilled matches. Ids are chunked because
 * scoreNewTenders loads full tender rows for the batch.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/recompute-matches.ts [--all]
 */
const DEMO = "demo-business";
const CHUNK = 200;

async function main() {
  const all = process.argv.includes("--all");

  const [tenderRows, matchedRows] = await Promise.all([
    db.select({ id: tendersTable.id }).from(tendersTable),
    db
      .selectDistinct({ tenderId: matchesTable.tenderId })
      .from(matchesTable)
      .where(eq(matchesTable.businessId, DEMO)),
  ]);

  const matched = new Set(matchedRows.map((r) => r.tenderId));
  const ids = all
    ? tenderRows.map((r) => r.id)
    : tenderRows.map((r) => r.id).filter((id) => !matched.has(id));

  console.log(
    `recompute-matches: scoring ${ids.length} tenders (${all ? "all" : "unmatched only"}); ` +
      `${tenderRows.length} total tenders, ${matched.size} already matched`,
  );

  let scored = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await scoreNewTenders(chunk);
    scored += res.length;
    console.log(
      `  ${Math.min(i + CHUNK, ids.length)}/${ids.length} processed, ${scored} matches upserted`,
    );
  }

  console.log(`recompute-matches: done, ${scored} matches upserted`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
