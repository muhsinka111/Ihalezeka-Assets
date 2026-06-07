import axios from "axios";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

// UNGM (UN Global Marketplace) public procurement opportunities.
// The website is a JavaScript SPA that loads results via internal API calls.
// We query the notice endpoint and parse whatever structured data is returned.
// If the response is HTML (i.e. the endpoint has changed), we log and return 0.
const UNGM_API = "https://www.ungm.org/Public/Notice";
const UNGM_BASE = "https://www.ungm.org";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface UngmNotice {
  noticeId?: number;
  title?: string;
  description?: string;
  deadlineDate?: string;
  publishedDate?: string;
  reference?: string;
  agencyName?: string;
  countries?: string[];
  url?: string;
}

interface UngmResponse {
  noticeList?: UngmNotice[];
  total?: number;
  [key: string]: unknown;
}

function slugify(id: string | number): string {
  return `ungm-${String(id).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80)}`;
}

function parseUngmDate(str: string | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function mapUngmToTender(notice: UngmNotice, index: number): InsertTender | null {
  const id = notice.noticeId ?? notice.reference ?? String(index);
  if (!id) return null;
  const title = notice.title?.trim() || notice.description?.trim();
  if (!title || title.length < 5) return null;

  const deadline = parseUngmDate(notice.deadlineDate);
  const agency = notice.agencyName?.trim() || "UNGM / UN Agency";

  const sourceUrl = notice.url
    ? notice.url.startsWith("http") ? notice.url : `${UNGM_BASE}${notice.url}`
    : notice.noticeId
    ? `${UNGM_BASE}/Public/Notice/Details/${notice.noticeId}`
    : UNGM_API;

  return {
    ikn: slugify(id),
    title,
    agencyName: agency,
    type: "Uluslararası İhale",
    method: "UN Tedarik",
    estimatedValue: null,
    deadline,
    cpvCodes: [],
    il: (notice.countries ?? []).join(", ") || "",
    status: "active",
    category: "uluslararasi",
    description: [title, agency, notice.reference ? `Ref: ${notice.reference}` : ""].filter(Boolean).join("\n"),
    sourceSystem: "ungm",
    sourceUrl,
    procurementMethod: null,
    documents: null,
    rawData: notice as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

async function fetchUngmNotices(daysBack: number): Promise<UngmNotice[]> {
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 86400000);
  const fmtDate = (d: Date) => d.toISOString().split("T")[0];

  // Try GET with query params as documented in task spec; many .NET MVC sites
  // content-negotiate to JSON when the request has specific params.
  const res = await axios.get<unknown>(UNGM_API, {
    params: {
      keywords: "",
      publishedFrom: fmtDate(from),
      publishedTo: fmtDate(now),
      pageIndex: 1,
    },
    timeout: 30000,
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: UNGM_API,
    },
  });

  const data = res.data;

  // If response is an object/array (JSON), extract notice list
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as UngmResponse;
    if (Array.isArray(obj.noticeList)) return obj.noticeList;
    if (Array.isArray((obj as any).notices)) return (obj as any).notices;
  }
  if (Array.isArray(data)) return data as UngmNotice[];

  // If HTML was returned, the endpoint is not a JSON API — log and bail
  const str = String(data).slice(0, 50);
  if (str.trimStart().startsWith("<!") || str.trimStart().startsWith("<html")) {
    logger.warn("UNGM returned HTML (SPA page — no JSON API exposed at this endpoint)");
    return [];
  }

  return [];
}

export async function runUngmScraper(daysBack = 14): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info({ daysBack }, "UNGM scraper starting");
    const notices = await retry(() => fetchUngmNotices(daysBack), 2, 3000);
    result.fetched = notices.length;
    logger.info({ count: notices.length }, "UNGM notices fetched");

    for (let i = 0; i < notices.length; i++) {
      const mapped = mapUngmToTender(notices[i], i);
      if (!mapped) continue;
      try {
        const { inserted, tenderId } = await upsertTender(mapped);
        if (inserted) { result.inserted++; result.newTenderIds!.push(tenderId); }
        else result.updated++;
      } catch (err) {
        logger.warn({ id: notices[i].noticeId, err }, "Failed to upsert UNGM notice");
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
