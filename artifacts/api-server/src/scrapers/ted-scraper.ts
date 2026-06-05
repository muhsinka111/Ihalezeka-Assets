import axios from "axios";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const TED_API = "https://api.ted.europa.eu/v3/notices/search";

interface TedNotice {
  "publication-number"?: string;
  title?: { eng?: string; tur?: string; [lang: string]: string | undefined };
  "buyer-name"?: string[];
  "deadline-receipt-request"?: string;
  "value-estimated"?: { amount?: number; currency?: string };
  "place-of-performance"?: { country?: string };
}

interface TedSearchResponse {
  notices?: TedNotice[];
  totalNoticeCount?: number;
}

function mapTedToTender(notice: TedNotice): InsertTender | null {
  const pubNum = notice["publication-number"];
  if (!pubNum) return null;

  const titleObj = notice.title ?? {};
  const title = titleObj.tur ?? titleObj.eng ?? Object.values(titleObj)[0] ?? "TED İhalesi";
  const buyer = (notice["buyer-name"] ?? [])[0] ?? "Bilinmiyor";
  const deadlineStr = notice["deadline-receipt-request"];
  const parsedDeadline = deadlineStr ? new Date(deadlineStr) : null;
  const deadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline : null;
  const rawEstimated = notice["value-estimated"]?.amount;
  const estimated = typeof rawEstimated === "number" && rawEstimated > 0 ? rawEstimated : null;

  return {
    ikn: `ted-${pubNum}`,
    title,
    agencyName: buyer,
    type: "Uluslararası İhale",
    method: "Açık İhale",
    estimatedValue: estimated,
    deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "uluslararasi",
    sourceSystem: "ted",
    sourceUrl: `https://ted.europa.eu/udl?uri=TED:NOTICE:${pubNum}`,
    procurementMethod: null,
    documents: null,
    rawData: notice as unknown as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function runTedScraper(daysBack = 7): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  const apiKey = process.env.TED_API_KEY;
  if (!apiKey) {
    logger.warn("TED_API_KEY not set — skipping TED scraper. Register at api.ted.europa.eu to enable.");
    await logScraperRun({
      source: "ted",
      startedAt,
      completedAt: new Date(),
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errorMessage: "TED_API_KEY not configured",
    });
    return result;
  }

  try {
    const from = new Date(Date.now() - daysBack * 86400_000).toISOString().split("T")[0];
    const body = {
      query: `BT-1-Procedure IN ('TUR') AND publication-date >= ${from}`,
      fields: ["publication-number", "title", "buyer-name", "deadline-receipt-request", "value-estimated", "place-of-performance"],
      scope: "ACTIVE",
      paginationParameters: { page: 1, limit: 50 },
    };

    logger.info({ daysBack }, "TED scraper starting");

    const response = await retry(async () => {
      const res = await axios.post<TedSearchResponse>(TED_API, body, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 30000,
      });
      return res.data;
    });

    const notices = response.notices ?? [];
    result.fetched = notices.length;

    for (const notice of notices) {
      try {
        const mapped = mapTedToTender(notice);
        if (!mapped) continue;
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ notice, err }, "Failed to upsert TED notice");
      }
    }

    logger.info(result, "TED scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "TED scraper failed");
  }

  await logScraperRun({
    source: "ted",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
