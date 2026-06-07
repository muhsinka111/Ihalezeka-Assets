import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * UNDP Public Procurement Notices scraper.
 *
 * Target: https://procurement-notices.undp.org/index.cfm?cur_lang=en
 * Technology: ColdFusion (.cfm) — fully server-rendered, no JavaScript required.
 *
 * The page lists notices as <a class="vacanciesTableLink vacanciesTable__row ...">
 * elements with title, ref number, country, process type, and deadline inline in
 * .vacanciesTable__cell divs.  No pagination needed for current listings.
 *
 * Note on UNGM: The UN Global Marketplace (www.ungm.org) is a JavaScript SPA
 * whose public notice board requires browser execution. UNDP's standalone notice
 * board is used here as the accessible UN procurement data source.
 */

const UNDP_URL = "https://procurement-notices.undp.org/index.cfm?cur_lang=en";
const BASE_URL = "https://procurement-notices.undp.org";

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseUndpDate(s: string): Date | null {
  // Format: "03-Jul-26" → 2026-07-03
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const [, day, mon, yr] = m;
  const month = MONTH_MAP[mon] ?? null;
  if (!month) return null;
  const year = parseInt(yr!, 10) + 2000;
  const parsed = new Date(`${year}-${month}-${day!.padStart(2, "0")}T12:00:00+03:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchUndpNotices(): Promise<InsertTender[]> {
  const res = await axios.get<string>(UNDP_URL, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = res.data;
  if (typeof html !== "string" || html.length < 5000) {
    logger.warn({ len: typeof html === "string" ? html.length : -1 }, "UNDP page too small — skipping");
    return [];
  }

  const $ = load(html);
  const notices: InsertTender[] = [];
  const seen = new Set<string>();

  $("a.vacanciesTableLink[href*='view_notice.cfm']").each((_i, el) => {
    const row = $(el);
    const href = row.attr("href") ?? "";
    if (!href) return;

    // Build full URL
    const sourceUrl = href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`;

    // Extract fields from labeled cells
    let title = "";
    let refNo = "";
    let country = "";
    let process = "";
    let deadline: Date | null = null;

    row.find(".vacanciesTable__cell").each((_j, cellEl) => {
      const cell = $(cellEl);
      const label = cell.find(".vacanciesTable__cell__label").text().trim().toLowerCase();
      const value = cell.find("span").not(".vacanciesTable__cell__label span").text().trim()
        .replace(/\s+/g, " ");

      if (label.includes("title")) title = value;
      else if (label.includes("ref")) refNo = value;
      else if (label.includes("country") || label.includes("office")) country = value;
      else if (label.includes("process")) process = value;
      else if (label.includes("deadline")) deadline = parseUndpDate(cell.find("nobr").text().trim());
    });

    if (!title || title.length < 5) return;
    if (seen.has(title)) return;
    seen.add(title);

    const ikn = `undp-${(refNo || title).replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 70)}`;

    notices.push({
      ikn,
      title,
      agencyName: `UNDP${country ? ` (${country.split("/")[0]?.trim()})` : ""}`,
      type: process || "Procurement Notice",
      method: process || "Bilinmiyor",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: "Uluslararası",
      status: "active",
      category: "uluslararasi",
      description: [
        title,
        country ? `Ülke/Ofis: ${country}` : "",
        process ? `Tür: ${process}` : "",
        refNo ? `Ref No: ${refNo}` : "",
      ].filter(Boolean).join("\n"),
      sourceSystem: "undp",
      sourceUrl,
      procurementMethod: process || null,
      documents: null,
      rawData: { refNo, country, process, url: sourceUrl } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return notices;
}

export async function runUndpScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("UNDP scraper starting");

    const notices = await retry(() => fetchUndpNotices(), 2, 3000);
    logger.info({ count: notices.length }, "UNDP procurement notices fetched");

    result.fetched = notices.length;

    for (const notice of notices) {
      try {
        const { inserted, tenderId } = await upsertTender(notice);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ ikn: notice.ikn, err }, "Failed to upsert UNDP notice");
      }
    }

    logger.info(result, "UNDP scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "UNDP scraper failed");
  }

  await finalizeScraperRun({ source: "undp", startedAt, result });
  return result;
}
