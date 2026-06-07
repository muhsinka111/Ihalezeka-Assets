import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

/**
 * UN Procurement Notices scraper.
 *
 * Stage 1 — UNGM API (Primary):
 *   POST https://www.ungm.org/Public/Notice/Search
 *   with JSON body: { PageIndex, PageSize, PublishedFrom, PublishedTo,
 *                     Title (keywords), Countries, Agencies, IsActive, ... }
 *   Date range is derived from `daysBack`.
 *
 *   UNGM's /Public/Notice page is an ASP.NET MVC SPA; the actual notice list
 *   is fetched by the client-side `UNGM.Notice.NoticeSearch` widget via this
 *   endpoint.  Without a full authenticated browser session (login + CSRF token
 *   baked into the cookie jar) the server returns an HTML error page instead of
 *   a JSON notice list.  The scraper attempts the API on every run so it
 *   self-heals if UNGM ever relaxes authentication for public notices.
 *
 * Stage 2 — UNDP Fallback (when UNGM fails):
 *   https://procurement-notices.undp.org/index.cfm?cur_lang=en
 *   A fully server-rendered ColdFusion page that exposes notice title,
 *   reference number, UNDP office/country, process type, and deadline inline —
 *   no JavaScript required.  Results are filtered to notices published within
 *   `daysBack` of today (based on parsed deadline date).
 *
 * All records are stored under sourceSystem: "ungm".
 */

const UNGM_BASE = "https://www.ungm.org";
const UNGM_NOTICE_PAGE = `${UNGM_BASE}/Public/Notice`;
const UNGM_SEARCH_API = `${UNGM_BASE}/Public/Notice/Search`;
const UNDP_URL = "https://procurement-notices.undp.org/index.cfm?cur_lang=en";
const UNDP_BASE = "https://procurement-notices.undp.org";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatIsoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseUndpDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const [, day, mon, yr] = m;
  const month = MONTH_MAP[mon!] ?? null;
  if (!month) return null;
  const year = parseInt(yr!, 10) + 2000;
  const parsed = new Date(`${year}-${month}-${day!.padStart(2, "0")}T12:00:00+03:00`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Stage 1: UNGM API
// ---------------------------------------------------------------------------

/**
 * Attempt the UNGM Public Notice Search API.
 *
 * The endpoint is `POST /Public/Notice/Search` discovered from the
 * UNGM.Notice.NoticeSearch widget source (ungmcommon bundle).
 * Parameters match the widget's BuildOptions() object:
 *   PageIndex, PageSize, Title (keyword search), PublishedFrom, PublishedTo,
 *   Countries, Agencies, UNSPSCs, NoticeTypes, SortField, SortAscending,
 *   isPicker, IsSustainable, IsActive, TypeOfCompetitions.
 *
 * Without a fully authenticated session the server returns an HTML error page.
 * We detect this and return an empty array so the fallback is triggered.
 */
async function tryUngmApi(params: {
  keywords: string;
  publishedFrom: string;
  publishedTo: string;
  pageIndex: number;
}): Promise<InsertTender[]> {
  // Step 1: GET the notice page to collect any session cookie the server sets.
  let sessionCookie = "";
  try {
    const sessionRes = await axios.get<string>(UNGM_NOTICE_PAGE, {
      timeout: 20_000,
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      maxRedirects: 5,
    });
    const setCookie = (sessionRes.headers["set-cookie"] ?? []) as string[];
    sessionCookie = setCookie
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
  } catch (err) {
    logger.warn({ err }, "UNGM: session GET failed; proceeding without cookie");
  }

  // Step 2: POST to the search API with the UNGM.Notice.NoticeSearch parameters.
  const body = {
    PageIndex: params.pageIndex,
    PageSize: 15,
    Title: params.keywords,
    Description: "",
    Reference: "",
    PublishedFrom: params.publishedFrom,
    PublishedTo: params.publishedTo,
    DeadlineFrom: "",
    DeadlineTo: "",
    Countries: [],
    Agencies: [],
    UNSPSCs: [],
    NoticeTypes: [],
    SortField: "",
    SortAscending: false,  // descending = most recent first
    isPicker: false,
    IsSustainable: false,
    IsActive: true,
    TypeOfCompetitions: [],
  };

  let responseData: string;
  try {
    const res = await axios.post<string>(UNGM_SEARCH_API, body, {
      timeout: 30_000,
      headers: {
        "User-Agent": BROWSER_UA,
        "Content-Type": "application/json",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": UNGM_NOTICE_PAGE,
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
    });
    responseData = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  } catch (err) {
    logger.warn({ err }, "UNGM API: POST /Public/Notice/Search failed");
    return [];
  }

  // Detect HTML error page (server requires authenticated session)
  const trimmed = responseData.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    logger.info(
      { len: responseData.length },
      "UNGM API: returned HTML instead of JSON — authentication required; will use UNDP fallback",
    );
    return [];
  }

  // Parse JSON response (expected when auth is not required)
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(responseData);
  } catch {
    logger.warn({ snippet: responseData.slice(0, 80) }, "UNGM API: non-JSON response; will use UNDP fallback");
    return [];
  }

  const noticeList =
    (json["noticeList"] ?? json["NoticeList"] ?? json["data"] ?? []) as Record<string, unknown>[];

  if (!Array.isArray(noticeList) || noticeList.length === 0) {
    logger.info("UNGM API: returned 0 notices; will use UNDP fallback");
    return [];
  }

  logger.info({ count: noticeList.length, total: json["totalCount"] ?? json["TotalCount"] }, "UNGM API: notices received");

  return noticeList
    .map((n): InsertTender | null => {
      const title = String(n["Title"] ?? n["title"] ?? "").trim();
      if (!title || title.length < 5) return null;

      const ref = String(n["Reference"] ?? n["reference"] ?? n["id"] ?? "");
      const country = String(n["Country"] ?? n["country"] ?? "");
      const agency = String(n["Agency"] ?? n["agency"] ?? "United Nations");
      const deadlineRaw = String(n["Deadline"] ?? n["deadline"] ?? "");
      const deadline = deadlineRaw ? (new Date(deadlineRaw).getTime() ? new Date(deadlineRaw) : null) : null;
      const noticeUrl = String(n["Url"] ?? n["url"] ?? n["noticeUrl"] ?? "");
      const sourceUrl = noticeUrl.startsWith("http") ? noticeUrl : noticeUrl ? `${UNGM_BASE}${noticeUrl}` : UNGM_NOTICE_PAGE;

      const ikn = `ungm-${(ref || title).replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 70)}`;

      return {
        ikn,
        title,
        agencyName: agency || "United Nations",
        type: "UN Procurement Notice",
        method: "Bilinmiyor",
        estimatedValue: null,
        deadline,
        cpvCodes: [],
        il: "Uluslararası",
        status: "active",
        category: "uluslararasi",
        description: [
          title,
          country ? `Ülke/Ofis: ${country}` : "",
          ref ? `Ref No: ${ref}` : "",
          "Kaynak: UNGM (UN Global Marketplace)",
        ].filter(Boolean).join("\n"),
        sourceSystem: "ungm",
        sourceUrl,
        procurementMethod: null,
        documents: null,
        rawData: { ref, country, agency, url: sourceUrl, dataSource: "ungm-api" } as Record<string, unknown>,
        lastFetchedAt: new Date(),
      };
    })
    .filter((t): t is InsertTender => t !== null);
}

// ---------------------------------------------------------------------------
// Stage 2: UNDP fallback
// ---------------------------------------------------------------------------

async function fetchFromUndpFallback(publishedFrom: Date): Promise<InsertTender[]> {
  logger.info("UNGM API unavailable — switching to UNDP public procurement notices portal");

  const res = await axios.get<string>(UNDP_URL, {
    timeout: 30_000,
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = res.data;
  if (typeof html !== "string" || html.length < 5_000) {
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
    // Capture raw strings inside the closure; parse after the loop so
    // TypeScript control-flow analysis can correctly infer `deadline` as
    // `Date | null` rather than narrowing it to `never`.
    let deadlineRaw = "";

    row.find(".vacanciesTable__cell").each((_j, cellEl) => {
      const cell = $(cellEl);
      const label = cell.find(".vacanciesTable__cell__label").text().trim().toLowerCase();
      const value = cell.find("span").not(".vacanciesTable__cell__label span").text().trim().replace(/\s+/g, " ");

      if (label.includes("title")) title = value;
      else if (label.includes("ref")) refNo = value;
      else if (label.includes("country") || label.includes("office")) country = value;
      else if (label.includes("process")) process = value;
      else if (label.includes("deadline")) deadlineRaw = cell.find("nobr").text().trim();
    });

    const deadline: Date | null = parseUndpDate(deadlineRaw);

    if (!title || title.length < 5) return;
    if (seen.has(title)) return;
    seen.add(title);

    // Filter by publish window: keep notices whose deadline is within daysBack window
    // (UNDP page only shows open/active notices, so deadline approximates freshness)
    if (deadline && deadline < publishedFrom) return;

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
        "Kaynak: UNDP Tedarik Bildirimleri (fallback — UNGM API authentication required)",
      ].filter(Boolean).join("\n"),
      sourceSystem: "ungm",
      sourceUrl,
      procurementMethod: process || null,
      documents: null,
      rawData: { refNo, country, process, url: sourceUrl, dataSource: "undp-fallback" } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  logger.info({ count: notices.length }, "UN procurement notices fetched (UNDP fallback)");
  return notices;
}

// ---------------------------------------------------------------------------
// Main scraper entry point
// ---------------------------------------------------------------------------

export async function runUngmScraper(daysBack = 14): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  const publishedFrom = daysAgo(daysBack);
  const publishedTo = new Date();
  const fromStr = formatIsoDate(publishedFrom);
  const toStr = formatIsoDate(publishedTo);

  logger.info({ daysBack, publishedFrom: fromStr, publishedTo: toStr }, "UNGM scraper starting");

  try {
    // Stage 1: Try UNGM API with date-filtered parameters
    let notices = await retry(
      () => tryUngmApi({ keywords: "", publishedFrom: fromStr, publishedTo: toStr, pageIndex: 0 }),
      2,
      3000,
    );

    // Stage 2: UNDP fallback when UNGM API is unavailable
    if (notices.length === 0) {
      notices = await retry(() => fetchFromUndpFallback(publishedFrom), 2, 3000);
    }

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

    logger.info(result, "UNGM scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "UNGM scraper failed");
  }

  await finalizeScraperRun({ source: "ungm", startedAt, result });
  return result;
}
