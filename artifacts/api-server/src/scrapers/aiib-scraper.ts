import axios from "axios";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * AIIB (Asian Infrastructure Investment Bank) procurement notices.
 *
 * Data source: AIIB publishes ALL project procurement notices as a static
 * JavaScript data file embedded in their procurement list page:
 *   https://www.aiib.org/en/opportunities/business/project-procurement/list.html
 *
 * The page loads two JS files:
 *   ppo-data-all.js  — full historical dataset (all years)
 *   ppo-YYYY.js      — current year index page code
 *
 * We fetch `ppo-data-all.js` and parse the `var ppoData = [...]` JavaScript
 * array. Each record has:
 *   id  — issue date  (e.g. "June 5, 2026")
 *   cd  — close/deadline date (e.g. "June 23,2026")
 *   mb  — member country
 *   pj  — project name (tender title)
 *   ds  — description / scope of work
 *   cr  — contract awardee (for Contract Award Notices)
 *   sd  — signed date
 *   pc  — price / contract value
 *   st  — sector
 *   ct  — category: "Notices" | "Contract Awards" | "Procurement Plan"
 *   tp  — notice type (Specific Procurement Notice, Request for EoI, etc.)
 *   dc  — document link (relative path to PDF/XLSX)
 *
 * We filter to records issued within `daysBack` days of today, and skip
 * Procurement Plan rows (they are internal plans, not open solicitations).
 *
 * No authentication required. No Cloudflare protection. Full public access.
 */

const AIIB_BASE = "https://www.aiib.org";
const PPO_DATA_URL =
  `${AIIB_BASE}/en/opportunities/business/project-procurement/_common/ppo-data-all.js`;
const PPO_LIST_PAGE =
  `${AIIB_BASE}/en/opportunities/business/project-procurement/list.html`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SKIP_TYPES = new Set([
  "Procurement Plan",
  "Contract Award Notice",
  "Addendum to Tender Document",
  "Addendum to Tender Documents",
  "Addenda",
  "Corrigendum to Tender Documents",
  "Amendment To Request for Expressions of Interest",
  "Extension for the Submission of Tenders",
  "Cancellation Notice",
]);

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, Jun: 6, Jul: 7, Aug: 8,
  Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/**
 * Parse AIIB date strings like "June 5, 2026", "June 23,2026", "May29,2026".
 * Returns null if unparseable.
 */
function parseAiibDate(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const cleaned = s.trim().replace(/\s+/g, " ");
  const m = cleaned.match(/^([A-Za-z]+)\s*(\d{1,2})[,\s]\s*(\d{4})$/);
  if (!m) return null;
  const [, monthStr, dayStr, yearStr] = m;
  const month = MONTH_NAMES[monthStr!];
  if (!month) return null;
  const day = parseInt(dayStr!, 10);
  const year = parseInt(yearStr!, 10);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Raw record type from ppoData
// ---------------------------------------------------------------------------

interface PpoRecord {
  id: string;   // issue date
  cd: string;   // close date
  mb: string;   // member country
  pj: string;   // project name
  ds: string;   // description
  cr: string;   // contractor/awardee
  sd: string;   // signed date
  pc: string;   // price/value
  st: string;   // sector
  ct: string;   // category
  tp: string;   // notice type
  dc: string;   // document link
}

// ---------------------------------------------------------------------------
// Fetch and parse ppo-data-all.js
// ---------------------------------------------------------------------------

async function fetchPpoData(): Promise<PpoRecord[]> {
  const res = await axios.get<string>(PPO_DATA_URL, {
    timeout: 30_000,
    headers: {
      "User-Agent": BROWSER_UA,
      "Referer": PPO_LIST_PAGE,
      "Accept": "*/*",
    },
  });

  const js = res.data;
  if (typeof js !== "string" || js.length < 1000) {
    throw new Error(`ppo-data-all.js is unexpectedly small (${typeof js === "string" ? js.length : -1} bytes)`);
  }

  // Extract the ppoData array content from:  var ppoData = [ ... ];
  const arrMatch = /var\s+ppoData\s*=\s*\[([\s\S]*)\]\s*;/.exec(js);
  if (!arrMatch) {
    throw new Error("Could not locate 'var ppoData = [...]' in ppo-data-all.js");
  }
  const arrContent = arrMatch[1]!;

  const records: PpoRecord[] = [];
  // Each item is a brace-delimited object with key:"value" pairs
  const itemRegex = /\{([^}]+)\}/g;
  const fieldRegex = /(\w+):"([^"]*?)"/g;
  let item: RegExpExecArray | null;
  while ((item = itemRegex.exec(arrContent)) !== null) {
    const fields: Record<string, string> = {};
    let field: RegExpExecArray | null;
    const fieldScanner = new RegExp(fieldRegex.source, "g");
    while ((field = fieldScanner.exec(item[1]!)) !== null) {
      fields[field[1]!] = field[2]!;
    }
    if (fields["pj"] && fields["id"]) {
      records.push(fields as unknown as PpoRecord);
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Map PpoRecord → InsertTender
// ---------------------------------------------------------------------------

function mapRecord(rec: PpoRecord): InsertTender | null {
  const title = rec.pj.trim();
  if (!title || title.length < 5) return null;

  const issueDate = parseAiibDate(rec.id);
  const deadline = parseAiibDate(rec.cd);

  const docUrl = rec.dc
    ? rec.dc.startsWith("http") ? rec.dc : `${AIIB_BASE}${rec.dc}`
    : PPO_LIST_PAGE;

  // Stable IKN from project name + type + issue date
  const iknBase = `aiib-${(title + rec.tp + rec.id)
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .slice(0, 80)}`;

  const descParts = [
    title,
    rec.ds ? `Kapsam: ${rec.ds}` : "",
    rec.mb ? `Üye Ülke: ${rec.mb}` : "",
    rec.st ? `Sektör: ${rec.st}` : "",
    rec.tp ? `Bildirim Türü: ${rec.tp}` : "",
    rec.pc ? `Sözleşme Bedeli: ${rec.pc}` : "",
    rec.cr ? `Yüklenici: ${rec.cr}` : "",
    "Kaynak: AIIB (Asya Altyapı Yatırım Bankası)",
  ].filter(Boolean);

  return {
    ikn: iknBase,
    title,
    agencyName: `AIIB${rec.mb ? ` — ${rec.mb}` : ""}`,
    type: rec.tp || "AIIB Procurement Notice",
    method: rec.tp || "Bilinmiyor",
    estimatedValue: null,
    deadline,
    cpvCodes: [],
    il: "Uluslararası",
    status: "active",
    category: "uluslararasi",
    description: descParts.join("\n"),
    sourceSystem: "aiib",
    sourceUrl: docUrl,
    procurementMethod: rec.tp || null,
    documents: null,
    rawData: {
      issueDate: rec.id,
      closeDate: rec.cd,
      memberCountry: rec.mb,
      sector: rec.st,
      category: rec.ct,
      noticeType: rec.tp,
      docLink: rec.dc,
      issueDateParsed: issueDate?.toISOString() ?? null,
    } as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runAiibScraper(daysBack = 30): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  logger.info({ daysBack, cutoff: cutoff.toISOString() }, "AIIB scraper starting");

  try {
    const rawRecords = await retry(() => fetchPpoData(), 2, 3000);
    logger.info({ total: rawRecords.length }, "AIIB ppo-data-all.js fetched");

    // Filter: within date window, skip Procurement Plans and Contract Awards
    const relevant = rawRecords.filter((r) => {
      if (SKIP_TYPES.has(r.tp)) return false;
      const issueDate = parseAiibDate(r.id);
      if (!issueDate) return false;
      return issueDate >= cutoff;
    });

    logger.info(
      { relevant: relevant.length, total: rawRecords.length },
      "AIIB notices after date/type filter",
    );

    const tenders = relevant
      .map(mapRecord)
      .filter((t): t is InsertTender => t !== null);

    result.fetched = tenders.length;

    for (const tender of tenders) {
      try {
        const { inserted, tenderId } = await upsertTender(tender);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert AIIB notice");
      }
    }

    logger.info(result, "AIIB scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "AIIB scraper failed");
  }

  await finalizeScraperRun({ source: "aiib", startedAt, result });
  return result;
}
