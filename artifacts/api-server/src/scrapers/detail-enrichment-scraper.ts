/**
 * Detail enrichment scraper — backfills EKAP tenders that were saved without
 * announcement text or document links.
 *
 * Each run picks up to BATCH_SIZE tenders whose `description` is empty and
 * whose `source_system` is 'ekap', fetches the full ilan text via ihale-mcp,
 * and writes `description` + `documents` back to the DB.
 *
 * This scraper runs sequentially AFTER the main batch so it never competes
 * for ihale-mcp quota. It degrades silently — a failed enrich is skipped and
 * will be retried in the next scheduled run.
 */

import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { sql, isNull, eq, or } from "drizzle-orm";
import { enrichEkapTender } from "./ekap-client.js";
import { logger } from "../lib/logger.js";
import type { ScraperResult } from "./utils.js";

const BATCH_SIZE = 80;
const INTER_CALL_MS = 250; // throttle so we don't hammer ihale-mcp

/**
 * Fetch unenriched EKAP tenders — those with a blank description
 * and no stored documents.
 */
async function getUnenrichedBatch(): Promise<Array<{ id: number; ikn: string }>> {
  const rows = await db
    .select({ id: tendersTable.id, ikn: tendersTable.ikn })
    .from(tendersTable)
    .where(
      sql`
        ${tendersTable.sourceSystem} = 'ekap'
        AND (
          ${tendersTable.description} IS NULL
          OR ${tendersTable.description} = ''
        )
        AND (
          ${tendersTable.documents} IS NULL
          OR ${tendersTable.documents}::text = 'null'
          OR ${tendersTable.documents}::text = '[]'
        )
      `,
    )
    .orderBy(tendersTable.createdAt)
    .limit(BATCH_SIZE);
  return rows;
}

export async function runDetailEnrichmentScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    analyzed: 0,
    newTenderIds: [],
  };

  try {
    const batch = await getUnenrichedBatch();
    result.fetched = batch.length;

    if (batch.length === 0) {
      logger.info("Detail enrichment scraper: all EKAP tenders already enriched");
      return result;
    }

    logger.info({ count: batch.length }, "Detail enrichment scraper: enriching tenders");

    for (const row of batch) {
      try {
        // IKN path: enrichEkapTender tries ihale-mcp announcements first.
        // Pass empty string for ihaleIdHash — we don't store the EKAP hash id,
        // but IKN is sufficient for the primary (ihale-mcp) path.
        const { detailText, documents } = await enrichEkapTender("", row.ikn);

        const patch: Record<string, unknown> = { updatedAt: new Date() };

        if (detailText && detailText.length >= 100) {
          patch.description = detailText;
        }

        // Always store at least the portal URL so the documents card is never blank
        const portalUrl = `https://ekapv2.kik.gov.tr/ekap/detay/${row.ikn}`;
        const finalDocs =
          documents.length > 0
            ? documents
            : [{ name: "İhale Dokümanı (EKAP Portal)", url: portalUrl, type: "ekap-portal" }];
        patch.documents = finalDocs;

        await db.update(tendersTable).set(patch).where(eq(tendersTable.id, row.id));

        if (detailText && detailText.length >= 100) {
          result.inserted++;
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.debug({ ikn: row.ikn, err }, "Detail enrichment: single tender failed, skipping");
        result.updated++;
      }

      await new Promise((r) => setTimeout(r, INTER_CALL_MS));
    }

    logger.info(result, "Detail enrichment scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "Detail enrichment scraper top-level failure");
  }

  return result;
}
