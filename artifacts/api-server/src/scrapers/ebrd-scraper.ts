import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const EBRD_API = "https://www.ebrd.com/cs/Satellite";

interface EbrdNotice {
  title: string;
  agency: string;
  deadline: Date;
  url: string;
  value: number;
  id: string;
}

function slugify(text: string, prefix: string): string {
  return `${prefix}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70)}`;
}

async function fetchEbrdNotices(): Promise<EbrdNotice[]> {
  const res = await axios.get(EBRD_API, {
    params: {
      c: "Page",
      cid: "1395238512522",
      pagename: "EBRD/Page/ProcurementNoticesSummary",
      selectedCountries: "Turkey",
    },
    timeout: 30000,
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; İhaleZeka/1.0)",
    },
  });

  const $ = load(res.data as string);
  const notices: EbrdNotice[] = [];

  $("table tr, .procurement-notice, .notice-item").each((_i, el) => {
    const cells = $(el).find("td");
    if (cells.length < 2) return;

    const titleEl = cells.eq(0).find("a").first();
    const title = titleEl.text().trim() || cells.eq(0).text().trim();
    if (!title || title.length < 5) return;

    const href = titleEl.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `https://www.ebrd.com${href}`;
    const dateText = cells.eq(cells.length - 1).text().trim();
    const deadline = dateText ? new Date(dateText) : new Date(Date.now() + 60 * 86400_000);
    const validDeadline = isNaN(deadline.getTime()) ? new Date(Date.now() + 60 * 86400_000) : deadline;

    notices.push({
      title,
      agency: "EBRD",
      deadline: validDeadline,
      url,
      value: 0,
      id: slugify(title, "ebrd"),
    });
  });

  return notices;
}

function mapEbrdToTender(notice: EbrdNotice): InsertTender {
  return {
    ikn: notice.id,
    title: notice.title,
    agencyName: "EBRD (Avrupa İmar ve Kalkınma Bankası)",
    type: "Uluslararası İhale",
    method: "Uluslararası Rekabetçi İhale",
    estimatedValue: notice.value,
    deadline: notice.deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "uluslararasi",
    sourceSystem: "ebrd",
    sourceUrl: notice.url,
    procurementMethod: null,
    documents: null,
    rawData: { title: notice.title, url: notice.url } as Record<string, unknown>,
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
        logger.warn({ noticeId: notice.id, err }, "Failed to upsert EBRD notice");
      }
    }

    logger.info(result, "EBRD scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "EBRD scraper failed");
  }

  await logScraperRun({
    source: "ebrd",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
