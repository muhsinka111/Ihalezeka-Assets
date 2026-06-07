import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

// IsDB (Islamic Development Bank) public tenders.
// The site is a Drupal CMS that server-renders the tender listing page —
// confirmed to return 107 KB of HTML with actual tender titles visible.
// Node detail pages are at /project-procurement/node/{id}.
const ISDB_BASE = "https://www.isdb.org";
const ISDB_TENDERS_URL = `${ISDB_BASE}/project-procurement/tenders`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function slugify(id: string): string {
  return `isdb-${id.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80)}`;
}

function parseDate(text: string): Date | null {
  if (!text) return null;
  const clean = text.trim();
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;
  const m = clean.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const [, d1, d2, y] = m;
    const a = new Date(`${y}-${d2.padStart(2, "0")}-${d1.padStart(2, "0")}`);
    if (!isNaN(a.getTime())) return a;
  }
  return null;
}

async function fetchIsdbTenders(): Promise<InsertTender[]> {
  const res = await axios.get<string>(ISDB_TENDERS_URL, {
    timeout: 35000,
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 3,
  });

  const $ = load(res.data);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // Primary strategy: Drupal views-row items with node links
  // Confirmed: the page has 100 content rows with actual tender data
  $(".views-row, .view-content article, .node-teaser, .tender-item").each((_i, el) => {
    const row = $(el);
    const linkEl = row.find("a[href]").first();
    let title = linkEl.text().trim();
    if (!title) title = row.find("h2,h3,h4,.node-title,.title").first().text().trim();
    if (!title || title.length < 8) return;
    if (seen.has(title)) return;
    seen.add(title);

    let href = linkEl.attr("href") ?? "";
    if (href && !href.startsWith("http")) href = `${ISDB_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
    const sourceUrl = href || ISDB_TENDERS_URL;

    const rowText = row.text();
    const dateText = row.find("time, .date, [class*='date'], [class*='deadline']").first().text().trim();
    const deadline = parseDate(dateText) || null;

    // Extract reference number (often prefixed with BCC, IRDP, RFP, etc.)
    const refMatch = title.match(/^([A-Z0-9-]{3,30})\s*[:\-]/);
    const ref = refMatch ? refMatch[1] : null;

    const nodeIdMatch = href.match(/\/node\/(\d+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : slugify(title).slice(5);

    tenders.push({
      ikn: slugify(nodeId),
      title: title.slice(0, 400),
      agencyName: "Islamic Development Bank (IsDB)",
      type: "Uluslararası İhale",
      method: "Uluslararası Tedarik",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: "",
      status: "active",
      category: "uluslararasi",
      description: [title, ref ? `Ref: ${ref}` : "", "Islamic Development Bank (IsDB)"].filter(Boolean).join("\n"),
      sourceSystem: "isdb",
      sourceUrl,
      procurementMethod: null,
      documents: null,
      rawData: { title, url: sourceUrl, ref } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  // Fallback: anchor links pointing to /project-procurement/node/... paths
  if (tenders.length === 0) {
    $("a[href*='/project-procurement/node/']").each((_i, el) => {
      const linkEl = $(el);
      const title = linkEl.text().trim();
      if (!title || title.length < 8) return;
      if (seen.has(title)) return;
      seen.add(title);

      let href = linkEl.attr("href") ?? "";
      if (!href.startsWith("http")) href = `${ISDB_BASE}${href}`;
      const nodeIdMatch = href.match(/\/node\/(\d+)/);
      const nodeId = nodeIdMatch ? nodeIdMatch[1] : slugify(title).slice(5);

      tenders.push({
        ikn: slugify(nodeId),
        title,
        agencyName: "Islamic Development Bank (IsDB)",
        type: "Uluslararası İhale",
        method: "Uluslararası Tedarik",
        estimatedValue: null,
        deadline: null,
        cpvCodes: [],
        il: "",
        status: "active",
        category: "uluslararasi",
        description: [title, "Islamic Development Bank (IsDB)"].join("\n"),
        sourceSystem: "isdb",
        sourceUrl: href,
        procurementMethod: null,
        documents: null,
        rawData: { title, url: href } as Record<string, unknown>,
        lastFetchedAt: new Date(),
      });
    });
  }

  return tenders;
}

export async function runIsdbScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("IsDB scraper starting");
    const tenders = await retry(() => fetchIsdbTenders(), 2, 3000);
    result.fetched = tenders.length;
    logger.info({ count: tenders.length }, "IsDB tenders fetched");

    for (const t of tenders) {
      try {
        const { inserted, tenderId } = await upsertTender(t);
        if (inserted) { result.inserted++; result.newTenderIds!.push(tenderId); }
        else result.updated++;
      } catch (err) {
        logger.warn({ ikn: t.ikn, err }, "Failed to upsert IsDB tender");
      }
    }

    logger.info(result, "IsDB scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "IsDB scraper failed");
  }

  await finalizeScraperRun({ source: "isdb", startedAt, result });
  return result;
}
