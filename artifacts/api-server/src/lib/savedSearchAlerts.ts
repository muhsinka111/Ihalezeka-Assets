import { db } from "@workspace/db";
import {
  savedSearchesTable,
  savedSearchAlertsTable,
  tendersTable,
  notificationPreferencesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendEmail, buildSavedSearchEmailHtml } from "./emailService.js";
import { buildTenderConditions, type ListQuery } from "../routes/tenders.js";

export interface SavedSearchDispatchResult {
  searchesMatched: number;
  alertsRecorded: number;
  emailsSent: number;
}

interface MatchedTender {
  id: number;
  title: string;
  agencyName: string;
  deadline: Date | null;
  sourceUrl: string | null;
}

/**
 * For each alert-enabled saved search, find which of the freshly-ingested
 * tenders match its criteria, record them in the dedup ledger (so a tender is
 * emailed at most once per saved search), and send a per-business email digest
 * grouped by saved search.
 *
 * Called from the scraper scheduler right after AI match notifications, using
 * the same list of newly-inserted tender ids.
 */
export async function dispatchSavedSearchAlerts(
  newTenderIds: number[],
): Promise<SavedSearchDispatchResult> {
  const result: SavedSearchDispatchResult = {
    searchesMatched: 0,
    alertsRecorded: 0,
    emailsSent: 0,
  };

  if (newTenderIds.length === 0) return result;

  try {
    const searches = await db
      .select()
      .from(savedSearchesTable)
      .where(eq(savedSearchesTable.alertsEnabled, true));

    if (searches.length === 0) return result;

    // businessId -> [{ search, tenders }]. We compute fresh matches first but
    // DEFER writing the dedup ledger until the digest email is actually sent,
    // so a transient email failure does not permanently suppress these alerts.
    const perBusiness = new Map<
      string,
      Array<{ search: (typeof searches)[number]; tenders: MatchedTender[] }>
    >();

    for (const search of searches) {
      // Isolate each search: a single malformed criteria (e.g. a bad date that
      // throws at query execution) must not abort the entire dispatch run.
      try {
        const query = (search.criteria ?? {}) as ListQuery;
        const { conditions } = buildTenderConditions(query);
        conditions.push(inArray(tendersTable.id, newTenderIds));

        const rows: MatchedTender[] = await db
          .select({
            id: tendersTable.id,
            title: tendersTable.title,
            agencyName: tendersTable.agencyName,
            deadline: tendersTable.deadline,
            sourceUrl: tendersTable.sourceUrl,
          })
          .from(tendersTable)
          .where(and(...conditions));

        if (rows.length === 0) continue;

        // Freshness against prior runs: filter out tenders already recorded in
        // the dedup ledger for this saved search (without writing anything yet).
        const matchedIds = rows.map((r) => r.id);
        const already = await db
          .select({ tenderId: savedSearchAlertsTable.tenderId })
          .from(savedSearchAlertsTable)
          .where(
            and(
              eq(savedSearchAlertsTable.savedSearchId, search.id),
              inArray(savedSearchAlertsTable.tenderId, matchedIds),
            ),
          );
        const alertedIds = new Set(already.map((a) => a.tenderId));
        const freshTenders = rows.filter((r) => !alertedIds.has(r.id));
        if (freshTenders.length === 0) continue;

        result.searchesMatched++;

        const groups = perBusiness.get(search.businessId) ?? [];
        groups.push({ search, tenders: freshTenders });
        perBusiness.set(search.businessId, groups);
      } catch (err) {
        logger.warn(
          { err, searchId: search.id },
          "Skipping saved search with invalid criteria",
        );
        continue;
      }
    }

    if (perBusiness.size === 0) return result;

    // One digest per business, to the address configured in notification prefs.
    const prefs = await db.select().from(notificationPreferencesTable);
    const emailByBusiness = new Map(
      prefs.map((p) => [p.businessId, p.emailAddress]),
    );

    for (const [businessId, groups] of perBusiness) {
      const to = emailByBusiness.get(businessId);
      if (!to) {
        logger.info(
          { businessId },
          "Saved-search matches found but no destination email configured — skipping digest (alerts not recorded, will retry once email is set)",
        );
        continue;
      }

      const totalCount = groups.reduce((n, g) => n + g.tenders.length, 0);
      const html = buildSavedSearchEmailHtml(
        groups.map((g) => ({ searchName: g.search.name, tenders: g.tenders })),
      );
      const sent = await sendEmail({
        to,
        subject: `İhaleZeka: Kayıtlı aramalarınıza uyan ${totalCount} yeni ihale`,
        html,
      });
      if (!sent) {
        // Leave the ledger untouched so the next run retries these tenders.
        logger.warn(
          { businessId },
          "Saved-search digest email failed — alerts not recorded, will retry next run",
        );
        continue;
      }
      result.emailsSent++;

      // Email delivered: now commit the dedup ledger and bump lastAlertedAt.
      for (const { search, tenders } of groups) {
        await db
          .insert(savedSearchAlertsTable)
          .values(tenders.map((t) => ({ savedSearchId: search.id, tenderId: t.id })))
          .onConflictDoNothing();
        await db
          .update(savedSearchesTable)
          .set({ lastAlertedAt: new Date() })
          .where(eq(savedSearchesTable.id, search.id));
        result.alertsRecorded += tenders.length;
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in dispatchSavedSearchAlerts");
  }

  logger.info(result, "Saved-search alert dispatch complete");
  return result;
}
