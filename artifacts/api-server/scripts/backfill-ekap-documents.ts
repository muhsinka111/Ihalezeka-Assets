import { db, tendersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Backfill the official EKAP document link for EKAP tenders that have no
 * documents yet. Mirrors the IKN path of enrichEkapTender: stores a single
 * { name, url = ekapv2 detay page, type: "ekap-belge" } entry — the public
 * official document / announcement page.
 *
 * We do NOT fetch the binary şartname: EKAP's document download is F5/anti-bot
 * gated and not headlessly downloadable, so the link (identical to what ingest
 * stores for new tenders, and to GetDokumanUrl's equally-gated target) is the
 * honest best we can offer. NO network calls; `description` is never touched.
 *
 * Divergence from ingest: ingest only attaches this link after fetching MCP
 * announcement text (>=100 chars); this backfill attaches it unconditionally
 * for any EKAP tender whose IKN is a real EKAP IKN (yyyy/n).
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/backfill-ekap-documents.ts
 */
const IKN_RE = /^\d{4}\/\d+$/;

async function main() {
  const rows = await db
    .select({
      id: tendersTable.id,
      ikn: tendersTable.ikn,
      documents: tendersTable.documents,
    })
    .from(tendersTable)
    .where(eq(tendersTable.sourceSystem, "ekap"));

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const hasDocs = Array.isArray(row.documents) && row.documents.length > 0;
    if (hasDocs || !IKN_RE.test(row.ikn)) {
      skipped++;
      continue;
    }
    const documents = [
      {
        name: "İhale Dokümanı (EKAP)",
        url: `https://ekapv2.kik.gov.tr/ekap/detay/${row.ikn}`,
        type: "ekap-belge",
      },
    ];
    await db
      .update(tendersTable)
      .set({ documents, updatedAt: new Date() })
      .where(eq(tendersTable.id, row.id));
    updated++;
  }

  console.log(
    `backfill-ekap-documents: ${updated} updated, ${skipped} skipped ` +
      `(already had docs or non-IKN), of ${rows.length} EKAP tenders`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
