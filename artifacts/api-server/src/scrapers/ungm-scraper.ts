import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * UN Procurement Notices scraper.
 *
 * Primary target: UNGM (UN Global Marketplace, www.ungm.org/Public/Notice).
 * UNGM's public notice board is a JavaScript SPA — the endpoint returns HTML
 * regardless of Accept headers or XHR flags, so no structured data is available
 * without a headless browser.
 *
 * Fallback: When UNGM SPA is detected (HTML response), this scraper automatically
 * falls back to the UNDP public procurement notices portal at
 *   https://procurement-notices.undp.org/index.cfm?cur_lang=en
 * which is fully server-rendered (ColdFusion .cfm) and exposes notice title,
 * reference number, UNDP office/country, process type, and deadline in-line in
 * <a class="vacanciesTableLink"> rows — no JavaScript required.
 *
 * All records are stored under sourceSystem: "ungm" to represent the UN
 * procurement notices category. The actual data source (UNGM vs. UNDP fallback)
 * is logged and stored in rawData.dataSource.
 */

const UNGM_URL = "https://www.ungm.org/Public/Notice";
const UNDP_URL = "https://procurement-notices.undp.org/index.cfm?cur_lang=en";
const UNDP_BASE = "https://procurement-notices.undp.org";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseUndpDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const [, day, mon, yr] = m;
  const month = MONTH_MAP[mon] ?? null;
  if (!month) return null;
  const year = parseInt(yr!, 10) + 2000;
  const parsed = new Date(`${year}-${month}-${day!.padStart(2, "0")}T12:00:00+03:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchFromUndpFallback(): Promise<InsertTender[]> {
  logger.info("UNGM SPA detected — switching to UNDP public procurement notices portal (server-rendered ColdFusion)");

  const res = await axios.get<string>(UNDP_URL, {
    timeout: 30000,
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = res.data;
  if (typeof html !== "string" || html.length < 5000) {
    logger.warn({ len: typeof html === "string" ? html.length : -1 }, "UNDP fallback page too small — no notices");
    return [];
  }

  const $ = load(html);
  const notices: InsertTender[] = [];
  const seen = new Set<string>();

  $("a.vacanciesTableLink[href*='view_notice.cfm']").each((_i, el) => {
    const row = $(el);
    const href = row.attr("href") ?? "";
    if (!href) return;

    const sourceUrl = href.startsWith("http") ? href : `${UNDP_BASE}/${href.replace(/^\//, "")}`;

    let title = "";
    let refNo = "";
    let country = "";
    let process = "";
    let deadline: Date | null = null;

    row.find(".vacanciesTable__cell").each((_j, cellEl) => {
      const cell = $(cellEl);
      const label = cell.find(".vacanciesTable__cell__label").text().trim().toLowerCase();
      const value = cell.find("span").not(".vacanciesTable__cell__label span").text().trim().replace(/\s+/g, " ");

      if (label.includes("title")) title = value;
      else if (label.includes("ref")) refNo = value;
      else if (label.includes("country") || label.includes("office")) country = value;
      else if (label.includes("process")) process = value;
      else if (label.includes("deadline")) deadline = parseUndpDate(cell.find("nobr").text().trim());
    });

    if (!title || title.length < 5) return;
    if (seen.has(title)) return;
    seen.add(title);

    // IKN uses "ungm-" prefix; sourceSystem is "ungm"
    const ikn = `ungm-${(refNo || title).replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 70)}`;

    notices.push({
      ikn,
      title,
      agencyName: `UNDP${country ? ` (${country.split("/")[0]?.trim()})` : ""}`,
      type: process || "UN Procurement Notice",
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
        "Kaynak: UNDP Tedarik Bildirimleri (procurement-notices.undp.org) — UNGM SPA fallback",
      ].filter(Boolean).join("\n"),
      sourceSystem: "ungm",
      sourceUrl,
      procurementMethod: process || null,
      documents: null,
      rawData: { refNo, country, process, url: sourceUrl, dataSource: "undp-fallback" } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return notices;
}

export async function runUngmScraper(_daysBack = 14): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("UNGM scraper starting (primary: UNGM.org, fallback: UNDP portal)");

    // Try UNGM first
    let ungmIsHtml = false;
    try {
      const res = await axios.get<unknown>(UNGM_URL, {
        timeout: 20000,
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": UNGM_URL,
        },
      });
      const data = res.data;
      const str = String(data).trimStart();
      if (str.startsWith("<!") || str.startsWith("<html")) {
        ungmIsHtml = true;
      }
    } catch {
      ungmIsHtml = true;
    }

    if (ungmIsHtml) {
      // UNGM is SPA — use UNDP fallback
      const notices = await retry(() => fetchFromUndpFallback(), 2, 3000);
      logger.info({ count: notices.length }, "UN procurement notices fetched (UNDP fallback)");
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
          logger.warn({ ikn: notice.ikn, err }, "Failed to upsert UN procurement notice");
        }
      }
    }

    logger.info(result, "UNGM scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "UNGM scraper failed");
  }

  await finalizeScraperRun({ source: "ungm", startedAt, result });
  return result;
}
