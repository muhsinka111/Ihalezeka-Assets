import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

// The legacy EBRD "cs/Satellite" URL was retired (HTTP 404). Procurement
// notices are now served from EBRD's e-Procurement portal (ECEPP). The public
// notice-search results page renders the full notice table server-side, which
// we parse and filter to Turkey-relevant notices.
const ECEPP_BASE = "https://ecepp.ebrd.com/delta";
const ECEPP_NOTICES_URL = `${ECEPP_BASE}/noticeSearchResults.html`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface EbrdNotice {
  noticeId: string;
  title: string;
  noticeType: string;
  buyer: string;
  country: string;
  published: Date | null;
  deadline: Date | null;
  url: string;
}

/** Parse a "DD/MM/YYYY" or "DD/MM/YYYY HH:MM" UK-formatted date string. */
function parseUkDate(text: string): Date | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  const d = new Date(
    `${yyyy}-${mm}-${dd}T${hh ?? "00"}:${min ?? "00"}:00+00:00`,
  );
  return isNaN(d.getTime()) ? null : d;
}

function isTurkey(country: string, title: string): boolean {
  const haystack = `${country} ${title}`.toLocaleLowerCase("en");
  return (
    haystack.includes("turkey") ||
    haystack.includes("türkiye") ||
    haystack.includes("turkiye") ||
    haystack.includes("türki̇ye")
  );
}

async function fetchEbrdNotices(): Promise<EbrdNotice[]> {
  const res = await axios.get<string>(ECEPP_NOTICES_URL, {
    timeout: 40000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
      "User-Agent": BROWSER_UA,
    },
  });

  const $ = load(res.data);
  const notices: EbrdNotice[] = [];
  const seen = new Set<string>();

  $("#noticeResultsTable tr").each((_i, el) => {
    const cells = $(el).find("td");
    // Header rows only contain <th>; data rows expose the notice columns.
    if (cells.length < 6) return;

    const link = cells.eq(0).find("a").first();
    const href = link.attr("href") ?? "";
    const idMatch = href.match(/displayNoticeId=(\d+)/);
    if (!idMatch) return;
    const noticeId = idMatch[1];
    if (seen.has(noticeId)) return;

    const title = link.text().trim();
    if (!title) return;

    const noticeType = cells.eq(1).text().trim();
    const published = parseUkDate(cells.eq(3).text().trim());
    const deadline = parseUkDate(cells.eq(4).text().trim());

    // The trailing bracketed metadata cell holds:
    // [exercise title, ref, COUNTRY, category, procedure, BUYER, sector, type]
    const metaText = cells.last().text().trim().replace(/^\[|\]$/g, "");
    const metaParts = metaText.split(",").map((s) => s.trim());
    const country = metaParts[2] ?? "";
    const buyer = metaParts.length >= 3 ? metaParts[metaParts.length - 3] : "";

    if (!isTurkey(country, title)) return;

    seen.add(noticeId);
    notices.push({
      noticeId,
      title,
      noticeType: noticeType || "Notice",
      buyer: buyer || "EBRD",
      country: country || "Turkey",
      published,
      deadline,
      url: `${ECEPP_BASE}/viewNotice.html?displayNoticeId=${noticeId}`,
    });
  });

  return notices;
}

function mapEbrdToTender(notice: EbrdNotice): InsertTender {
  // Capture whatever notice text the EBRD listing exposes into `description`.
  // The feed only returns short metadata (buyer / type / country), so this is a
  // compact notice block; the analyzer's grounding chain still prefers the live
  // source page (which is richer) and only uses this when nothing longer exists.
  const description =
    [
      notice.title,
      notice.buyer ? `Alıcı: ${notice.buyer}` : "",
      notice.noticeType ? `İlan türü: ${notice.noticeType}` : "",
      notice.country ? `Ülke: ${notice.country}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim() || null;

  return {
    ikn: `ebrd-${notice.noticeId}`,
    title: notice.title,
    agencyName: notice.buyer
      ? `${notice.buyer} (EBRD)`
      : "EBRD (Avrupa İmar ve Kalkınma Bankası)",
    type: "Uluslararası İhale",
    method: notice.noticeType || "Uluslararası Rekabetçi İhale",
    estimatedValue: null,
    deadline: notice.deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "uluslararasi",
    description,
    sourceSystem: "ebrd",
    sourceUrl: notice.url,
    procurementMethod: notice.noticeType || null,
    documents: null,
    rawData: {
      noticeId: notice.noticeId,
      noticeType: notice.noticeType,
      buyer: notice.buyer,
      country: notice.country,
      published: notice.published?.toISOString() ?? null,
      url: notice.url,
    } as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function runEbrdScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("EBRD scraper starting");
    const notices = await retry(() => fetchEbrdNotices());
    result.fetched = notices.length;

    for (const notice of notices) {
      try {
        const mapped = mapEbrdToTender(notice);
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ noticeId: notice.noticeId, err }, "Failed to upsert EBRD notice");
      }
    }

    logger.info(result, "EBRD scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "EBRD scraper failed");
  }

  await finalizeScraperRun({ source: "ebrd", startedAt, result });

  return result;
}
