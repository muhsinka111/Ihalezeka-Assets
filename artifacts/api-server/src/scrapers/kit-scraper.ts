import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import type { InsertTender } from "@workspace/db";

interface KitTarget {
  agency: string;
  sourceKey: string;
  il: string;
  url: string;
  rowSelector: string;
  titleSelector: string;
  dateSelector: string;
  linkSelector: string;
}

const KIT_TARGETS: KitTarget[] = [
  {
    agency: "TCDD",
    sourceKey: "tcdd",
    il: "Ankara",
    // TCDD's ihale page renders content server-side with PHP sessions;
    // many runs return 0 rows because the full HTML is a JS-bootstrap shell.
    // We keep the target and let the multi-strategy fallback try its best.
    url: "https://www.tcdd.gov.tr/ihale-ilanlar",
    rowSelector: "table tbody tr, .ihale-item, .ihale-row, article, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a.ihale-baslik",
    dateSelector: "td:nth-child(3), td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "BOTAŞ",
    sourceKey: "botas",
    il: "Ankara",
    url: "https://www.botas.gov.tr/index.php/tr/ihale-ilanlar",
    rowSelector: "table tbody tr, .ihale-item, article, li",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "TPAO",
    sourceKey: "tpao",
    il: "Ankara",
    // TPAO ihale sayfası JS ile yükleniyor; HTTP isteği çok az içerik döndürüyor.
    // SKIP: JS-rendered SPA — keeps running but typically fetches 0 rows.
    url: "https://www.tpao.gov.tr/ihale-ve-tedarik",
    rowSelector: "table tbody tr, .ihale-item, article, li, .tender-row",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "DHMİ",
    sourceKey: "dhmi",
    il: "Ankara",
    // SKIP: Returns <677 bytes (redirect shell). No scrapeable content.
    url: "https://www.dhmi.gov.tr/ihale-ve-satin-almalar/ihaleler",
    rowSelector: "table tbody tr, .ihale-item, article, li, .tender-row",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
  {
    agency: "TOKİ",
    sourceKey: "toki",
    il: "Ankara",
    // TOKİ (Toplu Konut İdaresi) publishes tenders on its main site.
    // The /ihale-ilanlar and /ihaleler paths 404 on this IIS host;
    // we use the news/announcements section which lists tenders.
    url: "https://www.toki.gov.tr/haberler",
    rowSelector: "table tbody tr, .news-item, article, li, .haber-item, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a",
    dateSelector: "td:last-child, .date, time, .tarih",
    linkSelector: "a",
  },
  {
    agency: "DSİ",
    sourceKey: "dsi",
    il: "Ankara",
    // DSİ (Devlet Su İşleri) portal is Cloudflare-protected.
    // SKIP: Returns Cloudflare challenge page — 0 records expected.
    url: "https://www.dsi.gov.tr/ihaleler",
    rowSelector: "table tbody tr, .ihale-item, article, li, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
  },
];

function slugify(sourceKey: string, agency: string, title: string): string {
  const slug = `${agency}-${title}`.trim().toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").slice(0, 70);
  return `${sourceKey}-${slug}`;
}

async function scrapeKitTarget(target: KitTarget): Promise<InsertTender[]> {
  let html: string;
  try {
    const res = await axios.get<string>(target.url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; İhaleZeka/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    html = res.data;
  } catch (err) {
    logger.warn({ agency: target.agency, url: target.url, err }, "KİT site unreachable, skipping");
    return [];
  }

  const $ = load(html);
  const tenders: InsertTender[] = [];
  const seen = new Set<string>();

  $(target.rowSelector).each((_i, el) => {
    const row = $(el);
    const titleEl = row.find(target.titleSelector).first();
    const title = titleEl.text().trim();
    if (!title || title.length < 8) return;
    if (seen.has(title)) return;
    seen.add(title);

    const linkEl = row.find(target.linkSelector).first();
    const href = linkEl.attr("href") ?? "";
    const baseUrl = new URL(target.url);
    let sourceUrl = href;
    if (href && !href.startsWith("http")) {
      sourceUrl = `${baseUrl.protocol}//${baseUrl.host}${href.startsWith("/") ? "" : "/"}${href}`;
    }
    if (!sourceUrl) sourceUrl = target.url;

    const dateText = row.find(target.dateSelector).first().text().trim();
    let deadline: Date | null = null;
    if (dateText) {
      const parsed = new Date(dateText.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));
      if (!isNaN(parsed.getTime())) deadline = parsed;
    }

    const ikn = slugify(target.sourceKey, target.agency, title);

    tenders.push({
      ikn,
      title,
      agencyName: target.agency,
      type: "İhale",
      method: "Bilinmiyor",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: target.il,
      status: "active",
      category: "ihale",
      description: [title, `Kurum: ${target.agency}`].filter(Boolean).join("\n"),
      sourceSystem: target.sourceKey,
      sourceUrl,
      procurementMethod: null,
      documents: null,
      rawData: { agency: target.agency, url: sourceUrl } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  });

  return tenders;
}

export async function runKitScraper(): Promise<ScraperResult> {
  const startedAt = new Date();
  const aggregate: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

  logger.info("KİT scraper starting");

  for (const target of KIT_TARGETS) {
    const agencyStartedAt = new Date();
    const agencyResult: ScraperResult = { fetched: 0, inserted: 0, updated: 0, newTenderIds: [] };

    try {
      const tenders = await retry(() => scrapeKitTarget(target), 2, 2000);
      logger.info({ agency: target.agency, count: tenders.length }, "KİT target scraped");
      agencyResult.fetched = tenders.length;

      for (const tender of tenders) {
        try {
          const { inserted, tenderId } = await upsertTender(tender);
          if (inserted) {
            agencyResult.inserted++;
            agencyResult.newTenderIds!.push(tenderId);
          } else {
            agencyResult.updated++;
          }
        } catch (err) {
          logger.warn({ ikn: tender.ikn, err }, "Failed to upsert KİT tender");
        }
      }
    } catch (err) {
      agencyResult.error = String(err);
      logger.warn({ agency: target.agency, err }, "KİT target scrape failed");
    }

    await finalizeScraperRun({ source: target.sourceKey, startedAt: agencyStartedAt, result: agencyResult });

    aggregate.fetched += agencyResult.fetched;
    aggregate.inserted += agencyResult.inserted;
    aggregate.updated += agencyResult.updated;
    aggregate.newTenderIds!.push(...(agencyResult.newTenderIds ?? []));
    if (agencyResult.error && !aggregate.error) aggregate.error = agencyResult.error;
  }

  logger.info(aggregate, "KİT scraper completed");

  // Write an aggregate "kit" run so the admin health view shows a consolidated
  // KİT status in addition to the per-agency rows written above.
  await finalizeScraperRun({ source: "kit", startedAt, result: aggregate });

  return aggregate;
}
