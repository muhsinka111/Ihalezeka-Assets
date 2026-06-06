import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BASE_URL = "https://www.tubitak.gov.tr";

/**
 * TÜBİTAK support program categories. The main /liste page is a category
 * index; actual programs live on the sub-pages listed here.
 */
const TUBITAK_TARGETS = [
  { label: "Akademik - Ulusal", url: `${BASE_URL}/tr/destekler/akademik/ulusal-destek-programlari` },
  { label: "Akademik - Uluslararası", url: `${BASE_URL}/tr/destekler/akademik/uluslararasi-destek-programlari` },
  { label: "Sanayi - Ulusal", url: `${BASE_URL}/tr/destekler/sanayi/ulusal-destek-programlari` },
  { label: "Sanayi - Uluslararası", url: `${BASE_URL}/tr/destekler/sanayi/uluslararasi-programlar` },
  { label: "Bilim ve Toplum", url: `${BASE_URL}/tr/destekler/bilim-toplum/ulusal-programlar` },
  { label: "Açık Çağrılar", url: `${BASE_URL}/tr/duyurular/acik-cagrilar` },
  { label: "Girişimcilik", url: `${BASE_URL}/tr/destekler/girisimcilik` },
];

function slugify(text: string): string {
  return `tubitak-${text
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)}`;
}

function parseTubitatDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T23:59:00+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

const SKIP_TITLES = new Set([
  "ana sayfa", "hakkında", "iletişim", "gizlilik", "site haritası",
  "english", "cookie", "anasayfa", "arama", "login", "giriş",
]);

function isNavTitle(t: string): boolean {
  const lower = t.toLocaleLowerCase("tr");
  return SKIP_TITLES.has(lower) || lower.length < 6;
}

async function scrapeTubitakTarget(label: string, url: string): Promise<InsertTender[]> {
  let html: string;
  try {
    const res = await axios.get<string>(url, {
      timeout: 30000,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    html = res.data;
  } catch (err) {
    logger.warn({ label, url, err }, "TÜBİTAK target unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  // Strategy 1: Drupal views-row items (used on listing pages)
  const viewsRows = $(".views-row, .view-content .field-item, .item-list li");
  if (viewsRows.length > 0) {
    viewsRows.each((_i, el) => {
      const row = $(el);
      const linkEl = row.find("a").first();
      const title =
        linkEl.text().trim() ||
        row.find("h2, h3, h4, .field-title").first().text().trim();
      if (!title || isNavTitle(title)) return;
      if (seen.has(title)) return;
      seen.add(title);

      let href = linkEl.attr("href") ?? "";
      if (href && !href.startsWith("http")) href = `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
      const sourceUrl = href || url;

      const rowText = row.text();
      let deadline: Date | null = null;
      const kwMatch = rowText.match(/(?:son\s+başvuru|son\s+tarih|bitiş|deadline)[:\s]*([^\n]+)/i);
      if (kwMatch) deadline = parseTubitatDate(kwMatch[1]);
      if (!deadline) deadline = parseTubitatDate(rowText);

      tenders.push(makeTender(title, sourceUrl, deadline, label));
    });
  }

  // Strategy 2: Anchor links on sub-category pages — each <a> with a /tr/destekler/ path
  // pointing to a program detail page is a separate support program
  if (tenders.length === 0) {
    $("a[href]").each((_i, el) => {
      const linkEl = $(el);
      const href = linkEl.attr("href") ?? "";
      if (!href.includes("/destekler/") && !href.includes("/destek-") && !href.includes("1001") && !href.includes("1002")) return;

      const title = linkEl.text().trim();
      if (!title || isNavTitle(title)) return;
      if (seen.has(title)) return;
      seen.add(title);

      let fullHref = href;
      if (!fullHref.startsWith("http")) fullHref = `${BASE_URL}${fullHref.startsWith("/") ? "" : "/"}${fullHref}`;

      tenders.push(makeTender(title, fullHref, null, label));
    });
  }

  // Strategy 3: Headings (h2/h3) that look like program names
  if (tenders.length === 0) {
    $("h2, h3").each((_i, el) => {
      const heading = $(el);
      const title = heading.text().trim();
      if (!title || isNavTitle(title)) return;
      if (seen.has(title)) return;
      seen.add(title);
      const linkEl = heading.find("a").first();
      let href = linkEl.attr("href") ?? "";
      if (href && !href.startsWith("http")) href = `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
      tenders.push(makeTender(title, href || url, null, label));
    });
  }

  return tenders;
}

function makeTender(
  title: string,
  sourceUrl: string,
  deadline: Date | null,
  label: string,
): InsertTender {
  return {
    ikn: slugify(title),
    title,
    agencyName: "TÜBİTAK",
    type: "TÜBİTAK Desteği",
    method: "Hibe / Ar-Ge Destek Programı",
    estimatedValue: null,
    deadline,
    cpvCodes: [],
    il: "",
    status: "active",
    category: "hibe",
    description: [title, label ? `Kategori: ${label}` : "", "TÜBİTAK Ar-Ge / Destek Programı"]
      .filter(Boolean)
      .join("\n"),
    sourceSystem: "tubitak",
    sourceUrl,
    procurementMethod: null,
    documents: null,
    rawData: { label, url: sourceUrl } as Record<string, unknown>,
    lastFetchedAt: new Date(),
  };
}

export async function runTubitakScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const result: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  try {
    logger.info("TÜBİTAK scraper starting");
    const allTenders: InsertTender[] = [];
    const seenIkn = new Set<string>();

    for (const target of TUBITAK_TARGETS) {
      try {
        const pageTenders = await retry(
          () => scrapeTubitakTarget(target.label, target.url),
          2,
          3000,
        );
        logger.info({ label: target.label, count: pageTenders.length }, "TÜBİTAK target scraped");

        for (const t of pageTenders) {
          if (!seenIkn.has(t.ikn)) {
            seenIkn.add(t.ikn);
            allTenders.push(t);
          }
        }
      } catch (err) {
        logger.warn({ label: target.label, err }, "TÜBİTAK target scrape failed");
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    result.fetched = allTenders.length;

    for (const tender of allTenders) {
      try {
        const { inserted, tenderId } = await upsertTender(tender);
        if (inserted) {
          result.inserted++;
          result.newTenderIds!.push(tenderId);
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.warn({ ikn: tender.ikn, err }, "Failed to upsert TÜBİTAK tender");
      }
    }

    logger.info(result, "TÜBİTAK scraper completed");
  } catch (err) {
    result.error = String(err);
    logger.error({ err }, "TÜBİTAK scraper failed");
  }

  await finalizeScraperRun({ source: "tubitak", startedAt, result });
  return result;
}
