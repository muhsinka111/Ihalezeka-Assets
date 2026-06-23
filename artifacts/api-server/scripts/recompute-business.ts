import { db, tendersTable } from "@workspace/db";
import { scoreNewTenders } from "../src/lib/tenderScorer.js";

/**
 * Recompute matches for a SINGLE business against every tender, using the
 * current scorer. Scoped via the businessId option so other tenants are
 * untouched. Run synchronously (fits the tool timeout) instead of the
 * all-profile recompute-matches.ts.
 *
 * Usage: tsx scripts/recompute-business.ts <businessId>
 */
const businessId = process.argv[2];
const CHUNK = 400;

async function main() {
  if (!businessId) {
    console.error("usage: tsx scripts/recompute-business.ts <businessId>");
    process.exit(1);
  }

  const tenderRows = await db.select({ id: tendersTable.id }).from(tendersTable);
  const ids = tenderRows.map((r) => r.id);
  console.log(`recompute-business[${businessId}]: scoring ${ids.length} tenders`);

  let scored = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await scoreNewTenders(chunk, { businessId });
    scored += res.length;
    console.log(`  ${Math.min(i + CHUNK, ids.length)}/${ids.length} processed, ${scored} upserted`);
  }

  console.log(`recompute-business[${businessId}]: done, ${scored} matches upserted`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
