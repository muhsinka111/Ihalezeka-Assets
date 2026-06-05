import axios from "axios";
import { logger } from "../lib/logger.js";
import { upsertTender, logScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const WB_API = "https://search.worldbank.org/api/v2/procnotices";

interface WbNotice {
  id?: string;
  project_name?: string;
  prd_name?: string;
  borrower_name?: string;
  notice_type?: string;
  deadline?: string;
  bdgt?: string | number;
  currency?: string;
  url?: string;
  status?: string;
  country?: string;
}

interface WbResponse {
  procnotices?: WbNotice[];
  total?: number;
}

function parseBudget(val: string | number | undefined): number | null {
  if (!val) return null;
  const n = typeof val === "string" ? parseFloat(val.replace(/[^0-9.]/g, "")) : val;
  return isNaN(n) || n <= 0 ? null : n;
}

function mapWbToTender(notice: WbNotice): InsertTender | null {
  const id = notice.id ?? notice.prd_name;
  if (!id) return null;

  const title = notice.project_name ?? notice.prd_name ?? "World Bank İhalesi";
  const agency = notice.borrower_name ?? "World Bank";
  const deadlineStr = notice.deadline;
  const parsedDeadline = deadlineStr ? new Date(deadlineStr) : null;
  const deadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline : null;
  const estimated = parseBudget(notice.bdgt);

  return {
    ikn: `wb-${String(id).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80)}`,
    title,
    agencyName: agency,
    type: notice.notice_type ?? "Uluslararası İhale",
    method: "Uluslararası Rekabetçi İhale",
    estimatedValue: estimated,
    deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "uluslararasi",
    sourceSystem: "worldbank",
    sourceUrl: notice.url ?? `https://projects.worldbank.org/`,
    procurementMethod: null,
    documents: null,
    rawData: notice as unknown as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function runWorldBankScraper(daysBack = 7): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info({ daysBack }, "World Bank scraper starting");

    const response = await retry(async () => {
      const res = await axios.get<WbResponse>(WB_API, {
        params: {
          format: "json",
          os: 0,
          rows: 100,
          countryshortname: "Turkey",
          status: 1,
          order: "desc",
          srt: "deadline",
        },
        timeout: 30000,
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; İhaleZeka/1.0)",
        },
      });
      return res.data;
    });

    const notices = response.procnotices ?? [];
    result.fetched = notices.length;

    for (const notice of notices) {
      try {
        const mapped = mapWbToTender(notice);
        if (!mapped) continue;
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ noticeId: notice.id, err }, "Failed to upsert World Bank notice");
      }
    }

    logger.info(result, "World Bank scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "World Bank scraper failed");
  }

  await logScraperRun({
    source: "worldbank",
    startedAt,
    completedAt: new Date(),
    recordsFetched: result.fetched,
    recordsInserted: result.inserted,
    recordsUpdated: result.updated,
    errorMessage: result.error ?? null,
  });

  return result;
}
