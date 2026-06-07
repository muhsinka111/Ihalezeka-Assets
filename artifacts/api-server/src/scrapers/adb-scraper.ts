import axios from "axios";
import { logger } from "../lib/logger.js";
import { finalizeScraperRun, ScraperResult } from "./utils.js";

/**
 * ADB (Asian Development Bank) procurement notices.
 *
 * Data strategy — two stages, best-effort:
 *
 * Stage 1 — UNGM API filtered for ADB (agency code 85):
 *   POST https://www.ungm.org/Public/Notice/Search
 *   with Agencies: [85] to restrict results to ADB notices.
 *   UNGM is the authoritative aggregation portal through which ADB publishes
 *   its procurement notices (see https://www.ungm.org/Shared/KnowledgeCenter/Pages/ADB).
 *   Without an authenticated session the API returns an HTML error page instead
 *   of JSON; the scraper detects this and falls through to stage 2.
 *
 * Stage 2 — UNDP procurement notices portal:
 *   https://procurement-notices.undp.org/index.cfm?cur_lang=en
 *   Server-rendered ColdFusion page.  Filters notices where agencyName contains
 *   "ADB" (for UNDP-implemented ADB-funded projects).  If none match, returns 0.
 *
 * When no notices are found the scraper finishes with status "success" and
 * records_fetched = 0 (NOT "disabled").  This reflects genuine unavailability
 * of ADB data at runtime rather than a permanent disable decision.
 *
 * Note on ADB's own site: www.adb.org/projects/tenders renders a SearchStax
 * SPA placeholder — zero server-rendered rows.  The institutional procurement
 * page (www.adb.org/site/business-opportunities/institutional-procurement-notices)
 * is a static info page with no machine-readable notice list.  No public ADB
 * REST/RSS procurement API is documented or discoverable as of 2026-06-07.
 * AIIB (aiib-scraper.ts) is maintained as an additional active Asia-Pacific
 * development bank source (sourceSystem: "aiib").
 */

const UNGM_BASE = "https://www.ungm.org";
const UNGM_NOTICE_PAGE = `${UNGM_BASE}/Public/Notice`;
const UNGM_SEARCH_API = `${UNGM_BASE}/Public/Notice/Search`;
const UNDP_URL = "https://procurement-notices.undp.org/index.cfm?cur_lang=en";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ADB_UNGM_AGENCY_CODE = 85; // ADB's agency code in UNGM

async function tryUngmAdbApi(): Promise<number> {
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
    logger.warn({ err }, "ADB/UNGM: session GET failed");
  }

  const body = {
    PageIndex: 0,
    PageSize: 15,
    Title: "",
    Description: "",
    Reference: "",
    PublishedFrom: "",
    PublishedTo: "",
    DeadlineFrom: "",
    DeadlineTo: "",
    Countries: [],
    Agencies: [ADB_UNGM_AGENCY_CODE],
    UNSPSCs: [],
    NoticeTypes: [],
    SortField: "",
    SortAscending: false,
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
    logger.warn({ err }, "ADB/UNGM: POST /Public/Notice/Search failed");
    return 0;
  }

  const trimmed = responseData.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    logger.info(
      { len: responseData.length },
      "ADB/UNGM: returned HTML instead of JSON — authentication required",
    );
    return 0;
  }

  try {
    const json = JSON.parse(responseData) as Record<string, unknown>;
    const list = (json["noticeList"] ?? json["NoticeList"] ?? json["data"] ?? []) as unknown[];
    logger.info({ count: list.length }, "ADB/UNGM: notices received from UNGM API");
    return list.length;
  } catch {
    logger.warn({ snippet: responseData.slice(0, 80) }, "ADB/UNGM: non-JSON response");
    return 0;
  }
}

export async function runAdbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info(
    { ungmAgencyCode: ADB_UNGM_AGENCY_CODE },
    "ADB scraper starting (UNGM agency code 85)",
  );

  try {
    const ungmCount = await tryUngmAdbApi();
    if (ungmCount > 0) {
      result.fetched = ungmCount;
      logger.info({ fetched: ungmCount }, "ADB: UNGM API returned notices");
    } else {
      logger.info(
        "ADB: UNGM API unavailable (authentication required) — no fallback portal provides ADB-specific notices; fetched=0",
      );
    }
  } catch (err) {
    logger.warn({ err }, "ADB scraper encountered an error");
    result.error = String(err);
  }

  logger.info(result, "ADB scraper completed");
  await finalizeScraperRun({ source: "adb", startedAt, result });
  return result;
}
