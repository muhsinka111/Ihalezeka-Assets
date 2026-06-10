import {
  db,
  tendersTable,
  matchesTable,
  pipelineItemsTable,
  proposalsTable,
  notificationsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

/**
 * Idempotently delete the 8 fabricated demo tenders (IKN 2025/123456 .. 890123)
 * and all dependent rows. Real records (e.g. IKN 2025/1575024) are never touched
 * because we match strictly on the fixed fake-IKN set, not on id ranges.
 *
 * FKs to tenders are NON-cascading (matches, pipeline_items, proposals), and
 * notifications.match_id -> matches.id is also non-cascading, so delete order
 * matters:
 *   notifications (by match_id / tender_id) -> matches -> pipeline_items
 *   -> proposals -> tenders
 * saved_searches alert refs to tenders DO cascade, so they need no explicit
 * delete. Runs in a single transaction; re-running is a safe no-op.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/delete-fake-tenders.ts
 */
const FAKE_IKNS = [
  "2025/123456",
  "2025/234567",
  "2025/345678",
  "2025/456789",
  "2025/567890",
  "2025/678901",
  "2025/789012",
  "2025/890123",
];

async function main() {
  const result = await db.transaction(async (tx) => {
    const fakes = await tx
      .select({ id: tendersTable.id })
      .from(tendersTable)
      .where(inArray(tendersTable.ikn, FAKE_IKNS));
    const tenderIds = fakes.map((t) => t.id);

    if (tenderIds.length === 0) {
      return { tenders: 0, matches: 0, pipeline: 0, proposals: 0, notifications: 0 };
    }

    const fakeMatches = await tx
      .select({ id: matchesTable.id })
      .from(matchesTable)
      .where(inArray(matchesTable.tenderId, tenderIds));
    const matchIds = fakeMatches.map((m) => m.id);

    let notifications = 0;
    if (matchIds.length > 0) {
      notifications += (
        await tx
          .delete(notificationsTable)
          .where(inArray(notificationsTable.matchId, matchIds))
          .returning({ id: notificationsTable.id })
      ).length;
    }
    // notifications also carry a (non-FK) tender_id; clean those too.
    notifications += (
      await tx
        .delete(notificationsTable)
        .where(inArray(notificationsTable.tenderId, tenderIds))
        .returning({ id: notificationsTable.id })
    ).length;

    const matches = (
      await tx
        .delete(matchesTable)
        .where(inArray(matchesTable.tenderId, tenderIds))
        .returning({ id: matchesTable.id })
    ).length;
    const pipeline = (
      await tx
        .delete(pipelineItemsTable)
        .where(inArray(pipelineItemsTable.tenderId, tenderIds))
        .returning({ id: pipelineItemsTable.id })
    ).length;
    const proposals = (
      await tx
        .delete(proposalsTable)
        .where(inArray(proposalsTable.tenderId, tenderIds))
        .returning({ id: proposalsTable.id })
    ).length;
    const tenders = (
      await tx
        .delete(tendersTable)
        .where(inArray(tendersTable.id, tenderIds))
        .returning({ id: tendersTable.id })
    ).length;

    return { tenders, matches, pipeline, proposals, notifications };
  });

  console.log(
    `delete-fake-tenders: removed ${result.tenders} fake tenders + dependents`,
    result,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
