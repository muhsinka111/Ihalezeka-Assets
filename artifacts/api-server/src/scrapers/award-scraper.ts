/**
 * Award result scraper — builds the `award_results` table by:
 *
 *  1. Directly searching EKAP/ihale-mcp for İhale Sonuç İlanı (ISI) notices
 *     using Turkish award-text keywords ("ihale üzerinde kalan istekli" etc.)
 *     for the last N days.
 *  2. Also pulling any tenders already in our DB with status='awarded' that
 *     haven't been processed yet.
 *  3. For each candidate IKN, fetching the full announcement text and parsing
 *     winner company, contract price, and bidder count.
 *  4. Upserting results into `award_results`.
 *
 * Never throws — all failures are logged; 0-result runs are treated as success.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { awardResultsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import {
  searchTendersViaMcp,
  getTenderAnnouncementsViaMcp,
} from "./ihalemcp-client.js";
import { searchEkapAwardedTenders, type EkapTender } from "./ekap-client.js";
import { finalizeScraperRun } from "./utils.js";
import type { ScraperResult } from "./utils.js";

// ── Turkish award-notice regex patterns ─────────────────────────────────────

const WINNER_RE = [
  /(?:İhale\s+(?:üzerinde\s+(?:bırakılan|kalan)|yapılan|uhdesinde\s+kalan)\s+istekli(?:nin|n|ler)?\s+(?:adı|unvanı|Adı|Unvanı))\s*[:\s]+([^\n,;]{3,100})/i,
  /(?:sözleşme\s+imzalanan\s+istekli(?:nin|n)?\s+(?:adı|unvanı))\s*[:\s]+([^\n,;]{3,100})/i,
  /(?:kazanan\s+(?:firma|istekli|şirket))\s*[:\s]+([^\n,;]{3,100})/i,
];

const PRICE_RE = [
  /(?:İhale\s+bedeli|Teklif\s+bedeli|Sözleşme\s+(?:bedeli|tutarı)|Toplam\s+(?:ihale\s+)?bedel|teklifin\s+toplam\s+bedeli)\s*[:\s]+(?:₺|TL\s*)?([\d.,]+)/i,
  /(?:sözleşme\s+imzalanmıştır)\s*[^₺\d]*([\d.,]+)\s*(?:TL|₺)/i,
];

const BIDDER_RE = [
  /(?:İhaleye\s+(?:teklif\s+veren|katılan)\s+(?:istekli\s+)?sayısı|Teklif\s+(?:sayısı|veren\s+sayısı)|İstekli\s+sayısı)\s*[:\s]+(\d+)/i,
  /(\d+)\s+(?:istekli|firma)\s+teklif\s+vermiş/i,
];

const AGENCY_RE = [
  /(?:İhaleyi\s+(?:yapan\s+)?idarenin\s+(?:adı|unvanı)|İdare\s+(?:adı|unvanı))\s*[:\s]+([^\n,;]{3,120})/i,
];

const CATEGORY_RE = [
  /(?:İhale\s+konusu\s+(?:iş|hizmet|mal|yapım))\s*[:\s]+([^\n,;]{3,100})/i,
  /(?:İşin\s+(?:adı|niteliği))\s*[:\s]+([^\n,;]{3,100})/i,
];

/** Parse a Turkish price string like "1.234.567,89" → 1234567.89 */
function parseTrPrice(s: string): number | null {
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

interface ParsedAward {
  awardedCompany: string | null;
  awardedPrice: number | null;
  bidderCount: number | null;
  agencyName: string | null;
  category: string | null;
}

function parseAwardText(text: string): ParsedAward {
  const priceStr = firstMatch(text, PRICE_RE);
  const bidderStr = firstMatch(text, BIDDER_RE);
  return {
    awardedCompany: firstMatch(text, WINNER_RE),
    awardedPrice: priceStr ? parseTrPrice(priceStr) : null,
    bidderCount: bidderStr ? parseInt(bidderStr, 10) : null,
    agencyName: firstMatch(text, AGENCY_RE),
    category: firstMatch(text, CATEGORY_RE),
  };
}

/**
 * Check if an IKN has already been successfully enriched (awarded_company is known).
 * Stubs (no awarded_company) are NOT considered processed — they can be retried.
 */
async function alreadyProcessed(ikn: string): Promise<boolean> {
  const rows = await db.execute<{ cnt: string }>(
    sql`
      SELECT COUNT(*) AS cnt
      FROM award_results
      WHERE (ikn = ${ikn} OR original_ikn = ${ikn})
        AND awarded_company IS NOT NULL
    `,
  );
  return parseInt(rows.rows[0]?.cnt ?? "0", 10) > 0;
}

// ── Search strategies ────────────────────────────────────────────────────────

/**
 * Find award candidates via two paths:
 *  1. Direct EKAP API with ihaleDurumlar concluded-status codes (primary).
 *  2. ihale-mcp keyword search for ISI text as a fallback.
 * Returns deduplicated EkapTender candidates.
 */
async function searchForAwardCandidates(daysBack = 120): Promise<EkapTender[]> {
  const seen = new Map<string, EkapTender>();

  // Primary: direct EKAP concluded-tender search
  try {
    const direct = await searchEkapAwardedTenders(daysBack);
    for (const t of direct) {
      if (t.ikn && !seen.has(t.ikn)) seen.set(t.ikn, t);
    }
    if (seen.size > 0) {
      logger.info({ count: seen.size }, "Award scraper: candidates from direct EKAP search");
      return Array.from(seen.values());
    }
  } catch (err) {
    logger.debug({ err }, "Award scraper: direct EKAP search failed");
  }

  // Fallback: ihale-mcp keyword search for ISI text patterns
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
  const SEARCH_QUERIES = [
    "ihale üzerinde kalan istekli",
    "sözleşme imzalandı ihale sonuç",
    "ihale sonuç ilanı teklif bedeli",
  ];

  for (const searchText of SEARCH_QUERIES) {
    try {
      const res = await searchTendersViaMcp({
        searchText,
        announcementDateStart: startDate,
        announcementDateEnd: endDate,
        take: 50,
      });
      for (const t of res.list) {
        if (t.ikn && !seen.has(t.ikn)) seen.set(t.ikn, t);
      }
    } catch (err) {
      logger.debug({ searchText, err }, "Award scraper: ihale-mcp keyword search failed");
    }
  }

  return Array.from(seen.values());
}

/**
 * Fetch any concluded tenders already in our DB that haven't been processed.
 * Returns their IKNs so we can attempt enrichment.
 */
async function getPendingFromDb(): Promise<{ ikn: string; estimated_value: number | null; category: string; il: string; agency_name: string }[]> {
  const rows = await db.execute<{ ikn: string; estimated_value: number | null; category: string; il: string; agency_name: string }>(
    sql`
      SELECT t.ikn, t.estimated_value, t.category, t.il, t.agency_name
      FROM tenders t
      WHERE t.status = 'awarded'
        AND t.source_system = 'ekap'
        AND NOT EXISTS (
          SELECT 1 FROM award_results ar WHERE ar.ikn = t.ikn OR ar.original_ikn = t.ikn
        )
      ORDER BY t.created_at DESC
      LIMIT 40
    `,
  );
  return rows.rows;
}

// ── Upsert helper ────────────────────────────────────────────────────────────

async function upsertAwardResult(
  ikn: string,
  parsed: ParsedAward,
  meta: {
    originalIkn?: string;
    estimatedValue?: number | null;
    category?: string | null;
    il?: string | null;
    agencyName?: string | null;
    rawText?: string;
  },
): Promise<void> {
  await db
    .insert(awardResultsTable)
    .values({
      ikn,
      originalIkn: meta.originalIkn ?? ikn,
      awardedCompany: parsed.awardedCompany ?? undefined,
      awardedPrice: parsed.awardedPrice ?? undefined,
      bidderCount: parsed.bidderCount ?? undefined,
      estimatedValue: meta.estimatedValue ?? undefined,
      awardDate: new Date(),
      category: parsed.category ?? meta.category ?? undefined,
      il: meta.il ?? undefined,
      agencyName: parsed.agencyName ?? meta.agencyName ?? undefined,
      rawText: meta.rawText?.slice(0, 2000),
      sourceSystem: "ekap",
    })
    .onConflictDoUpdate({
      target: awardResultsTable.ikn,
      set: {
        awardedCompany: parsed.awardedCompany ?? undefined,
        awardedPrice: parsed.awardedPrice ?? undefined,
        bidderCount: parsed.bidderCount ?? undefined,
        agencyName: parsed.agencyName ?? meta.agencyName ?? undefined,
        category: parsed.category ?? meta.category ?? undefined,
        updatedAt: new Date(),
      },
    });
}

// ── Main scraper ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 30;

export async function runAwardScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    analyzed: 0,
    newTenderIds: [],
  };

  try {
    // --- Source 1: Direct ihale-mcp keyword search for recent ISIs ---
    const candidates = await searchForAwardCandidates(45);
    logger.info({ count: candidates.length }, "Award scraper: ISI candidates from keyword search");

    const toProcess = candidates.slice(0, BATCH_SIZE);
    result.fetched = toProcess.length;

    for (const tender of toProcess) {
      try {
        if (await alreadyProcessed(tender.ikn)) continue;

        const text = await getTenderAnnouncementsViaMcp(tender.ikn);
        if (!text || text.length < 30) {
          // Insert stub so we don't retry this IKN
          await db
            .insert(awardResultsTable)
            .values({
              ikn: tender.ikn,
              originalIkn: tender.ikn,
              agencyName: tender.idareAdi || undefined,
              il: tender.ihaleIlAdi || undefined,
              awardDate: tender.ihaleTarihSaat ? new Date(tender.ihaleTarihSaat) : new Date(),
              sourceSystem: "ekap",
            })
            .onConflictDoNothing();
          result.updated++;
          continue;
        }

        const parsed = parseAwardText(text);
        await upsertAwardResult(tender.ikn, parsed, {
          estimatedValue: null,
          il: tender.ihaleIlAdi || null,
          rawText: text,
        });

        if (parsed.awardedCompany) result.inserted++;
        else result.updated++;

        logger.debug(
          { ikn: tender.ikn, company: parsed.awardedCompany, price: parsed.awardedPrice },
          "Award result parsed from ISI",
        );
      } catch (err) {
        logger.debug({ ikn: tender.ikn, err }, "Award scraper: failed to process ISI candidate");
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    // --- Source 2: Already-concluded DB tenders (opportunistic enrichment) ---
    const dbPending = await getPendingFromDb();
    if (dbPending.length > 0) {
      logger.info({ count: dbPending.length }, "Award scraper: enriching concluded DB tenders");
      for (const row of dbPending.slice(0, 20)) {
        try {
          if (await alreadyProcessed(row.ikn)) continue;
          const text = await getTenderAnnouncementsViaMcp(row.ikn);
          const parsed = parseAwardText(text ?? "");
          await upsertAwardResult(row.ikn, parsed, {
            estimatedValue: row.estimated_value,
            category: row.category,
            il: row.il,
            agencyName: row.agency_name,
            rawText: text?.slice(0, 2000),
          });
          if (parsed.awardedCompany) result.inserted++;
          else result.updated++;
        } catch (err) {
          logger.debug({ ikn: row.ikn, err }, "Award scraper: DB tender enrichment failed");
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    logger.info(result, "Award scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "Award scraper top-level failure");
  }

  await finalizeScraperRun({ source: "award_results", startedAt, result });
  return result;
}
