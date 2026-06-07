import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

// ADB (Asian Development Bank) procurement notices.
// The main site is a Drupal CMS with server-side rendering for the notice listing.
// We scrape the public notices page which lists active opportunities.
const ADB_NOTICES_URL = "https://www.adb.org/projects/procurement/notices";
const ADB_BASE = "https://www.adb.org";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function slugify(text: string): string {
  return `adb-${text.trim().toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}`;
}

function parseDate(text: string): Date | null {
  if (!text) return null;
  const d = new Date(text.trim());
  if (!isNaN(d.getTime())) return d;
  const m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const [, d1, d2, y] = m;
    const attempt = new Date(`${y}-${d2.padStart(2, "0")}-${d1.padStart(2, "0")}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  return null;
}

async function fetchAdbNotices(): Promise<InsertTender[]> {
  const res = await axios.get<string>(ADB_NOTICES_URL, {
    timeout: 35000,
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const $ = load(res.data);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // Strategy 1: Drupal views rows (standard ADB listing pattern)
  const rows = $(".views-row, .procurement-notice-row, .notice-row, article.node");
  if (rows.length > 0) {
    rows.each((_i, el) => {
      const row = $(el);
      const linkEl = row.find("a[href]").first();
      const title = linkEl.text().trim() || row.find("h2,h3,h4,.title").first().text().trim();
      if (!title || title.length < 8) return;
      if (seen.has(title)) return;
      seen.add(title);

      let href = linkEl.attr("href") ?? "";
      if (href && !href.startsWith("http")) href = `${ADB_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
      const sourceUrl = href || ADB_NOTICES_URL;

      const dateText = row.find(".date, time, .field-deadline, [class*='date']").first().text().trim();
      const deadline = parseDate(dateText);

      tenders.push(makeAdbTender(title, sourceUrl, deadline, row.text()));
    });
  }

  // Strategy 2: Generic table rows (if ADB uses a table layout)
  if (tenders.length === 0) {
    $("table tbody tr").each((_i, el) => {
      const cells = $(el).find("td");
      if (cells.length < 2) return;
      const linkEl = cells.eq(0).find("a").first();
      const title = linkEl.text().trim() || cells.eq(0).text().trim();
      if (!title || title.length < 8) return;
      if (seen.has(title)) return;
      seen.add(title);

      let href = linkEl.attr("href") ?? "";
      if (href && !href.startsWith("http")) href = `${ADB_BASE}${href.startsWith("/") ? "" : "/"}${href}`;

      const dateText = cells.last().text().trim();
      const deadline = parseDate(dateText);
      tenders.push(makeAdbTender(title, href || ADB_NOTICES_URL, deadline, $(el).text()));
    });
  }

  // Strategy 3: Scan all anchors with /projects path that look like notices
  if (tenders.length === 0) {
    $("a[href*='/projects/']").each((_i, el) => {
      const linkEl = $(el);
      const href = linkEl.attr("href") ?? "";
      if (!href.includes("procurement") && !href.includes("notice")) return;
      const title = linkEl.text().trim();
      if (!title || title.length < 8) return;
      if (seen.has(title)) return;
      seen.add(title);
      const fullHref = href.startsWith("http") ? href : `${ADB_BASE}${href}`;
      tenders.push(makeAdbTender(title, fullHref, null, title));
    });
  }

  return tenders;
}

function makeAdbTender(title: string, sourceUrl: string, deadline: Date | null, context: string): InsertTender {
  return {
    ikn: slugify(title),
    title,
    agencyName: "Asian Development Bank",
    type: "Uluslararası İhale",
    method: "Uluslararası Rekabetçi İhale",
    estimatedValue: null,
    deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "uluslararasi",
    description: [title, "Asian Development Bank (ADB)", context.trim().slice(0, 300)].filter(Boolean).join("\n"),
    sourceSystem: "adb",
    sourceUrl,
    procurementMethod: null,
    documents: null,
    rawData: { title, url: sourceUrl } as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function runAdbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("ADB scraper starting");
    const tenders = await retry(() => fetchAdbNotices(), 2, 3000);
    result.fetched = tenders.length;
    logger.info({ count: tenders.length }, "ADB notices fetched");

    for (const t of tenders) {
      try {
        const { inserted, tenderId } = await upsertTender(t);
        if (inserted) { result.inserted++; result.newTenderIds!.push(tenderId); }
        else result.updated++;
      } catch (err) {
        logger.warn({ ikn: t.ikn, err }, "Failed to upsert ADB notice");
      }
    }

    logger.info(result, "ADB scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "ADB scraper failed");
  }

  await finalizeScraperRun({ source: "adb", startedAt, result });
  return result;
}
