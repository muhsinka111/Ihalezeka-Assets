import axios from "axios";
import { load } from "cheerio";
import { logger } from "../lib/logger.js";
import { upsertTender, finalizeScraperRun, retry, ScraperResult } from "./utils.js";
import { searchEkapByKeyword } from "./ekap-client.js";
import type { InsertTender } from "@workspace/db";

/**
 * KİT (Kamu İktisadi Teşebbüsleri) scraper.
 *
 * Each state enterprise has its own sourceSystem key and scraper_runs row.
 * An aggregate "kit" row is also written at the end.
 *
 * Two-stage strategy per agency:
 *   1. Direct portal HTML scraping (fast, native).
 *   2. EKAP keyword search fallback (when portal is SPA/Cloudflare/redirect shell
 *      and returns 0 records). The fallback queries the EKAP v2 API with the
 *      institution's procurement keyword, then filters results by idareAdi to
 *      confirm institutional origin.  Results are stored with the agency's own
 *      sourceSystem key and an "ekap-fallback" IKN prefix so they are distinct
 *      from the main EKAP scraper's records.
 *
 * BOTAŞ, TOKİ  — direct portal works (returns records)
 * TCDD, TPAO, DHMİ, DSİ — portal is SPA/blocked; EKAP fallback provides records
 */

interface KitTarget {
  agency: string;
  /** sourceSystem key — also used for scraper_runs rows */
  sourceKey: string;
  il: string;
  url: string;
  rowSelector: string;
  titleSelector: string;
  dateSelector: string;
  linkSelector: string;
  /** EKAP keyword to search when direct portal returns 0 results */
  ekapKeyword?: string;
  /**
   * Substring to check in idareAdi to confirm this is the correct institution.
   * Case-insensitive ASCII match after Turkish character normalisation.
   */
  ekapIdareContains?: string;
}

const KIT_TARGETS: KitTarget[] = [
  {
    agency: "TCDD",
    sourceKey: "tcdd",
    il: "Ankara",
    url: "https://www.tcdd.gov.tr/ihale-ilanlar",
    rowSelector: "table tbody tr, .ihale-item, .ihale-row, article, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a.ihale-baslik",
    dateSelector: "td:nth-child(3), td:last-child, .date, time",
    linkSelector: "a",
    ekapKeyword: "TCDD",
    ekapIdareContains: "demiryollari",
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
    ekapKeyword: "BOTAŞ",
    ekapIdareContains: "boru hatlari",
  },
  {
    agency: "TPAO",
    sourceKey: "tpao",
    il: "Ankara",
    url: "https://www.tpao.gov.tr/ihale-ve-tedarik",
    rowSelector: "table tbody tr, .ihale-item, article, li, .tender-row",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
    ekapKeyword: "TPAO",
    ekapIdareContains: "petrolleri",
  },
  {
    agency: "DHMİ",
    sourceKey: "dhmi",
    il: "Ankara",
    url: "https://www.dhmi.gov.tr/ihale-ve-satin-almalar/ihaleler",
    rowSelector: "table tbody tr, .ihale-item, article, li, .tender-row",
    titleSelector: "td:first-child a, h3, h4, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
    ekapKeyword: "DHMİ",
    ekapIdareContains: "hava meydanlari",
  },
  {
    agency: "TOKİ",
    sourceKey: "toki",
    il: "Ankara",
    url: "https://www.toki.gov.tr/haberler",
    rowSelector: "table tbody tr, .news-item, article, li, .haber-item, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a",
    dateSelector: "td:last-child, .date, time, .tarih",
    linkSelector: "a",
    ekapKeyword: "TOKİ",
    ekapIdareContains: "toplu konut",
  },
  {
    agency: "DSİ",
    sourceKey: "dsi",
    il: "Ankara",
    url: "https://www.dsi.gov.tr/ihaleler",
    rowSelector: "table tbody tr, .ihale-item, article, li, .card",
    titleSelector: "td:first-child a, h2 a, h3 a, h4 a, .title a, a",
    dateSelector: "td:last-child, .date, time",
    linkSelector: "a",
    ekapKeyword: "DSİ",
    ekapIdareContains: "su isleri",
  },
];

/**
 * Normalise Turkish characters for simple ASCII contains-check.
 * İ (U+0130, uppercase dotted I) must be replaced BEFORE toLowerCase()
 * because V8 converts it to "i" + U+0307 (combining dot above), which
 * breaks substring matching.  Replace it with plain "I" first so
 * toLowerCase() produces a plain "i".
 */
function normalizeTr(s: string): string {
  return s
    .replace(/İ/g, "I")  // U+0130 → plain I before case-fold
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
}

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

/**
 * EKAP keyword-search fallback for KIT agencies whose direct portals are
 * SPA/Cloudflare/blocked and return 0 records.
 *
 * Searches EKAP v2 with the agency keyword, takes the first 30 results
 * (most recent, per EKAP's default descending-date ordering), and filters by
 * idareAdi to confirm the tender belongs to this institution.  IKNs are
 * prefixed with the agency's sourceKey to remain distinct from the main EKAP
 * scraper's records (which use "ekap-" prefix).
 */
async function fetchEkapFallback(target: KitTarget): Promise<InsertTender[]> {
  if (!target.ekapKeyword) return [];

  logger.info(
    { agency: target.agency, keyword: target.ekapKeyword },
    "KİT direct portal returned 0 — trying EKAP keyword fallback",
  );

  let searchResult;
  try {
    searchResult = await searchEkapByKeyword(target.ekapKeyword, 0, 30);
  } catch (err) {
    logger.warn({ agency: target.agency, err }, "EKAP fallback search failed");
    return [];
  }

  const idareFilter = target.ekapIdareContains ? normalizeTr(target.ekapIdareContains) : "";
  const tenders: InsertTender[] = [];

  for (const t of searchResult.list) {
    // Filter to confirm institutional origin
    if (idareFilter && !normalizeTr(t.idareAdi ?? "").includes(idareFilter)) continue;

    const title = (t.ihaleAdi ?? "").trim();
    if (!title || title.length < 5) continue;

    // Use a non-colliding agency-prefixed IKN so these rows never overwrite the
    // main EKAP scraper's records (which key on t.ikn without a prefix).
    // Running EKAP and KİT concurrently with the same IKN causes nondeterministic
    // sourceSystem / sourceUrl overwrites; prefixed IKNs avoid that race.
    const ekapIkn = (t.ikn ?? t.id ?? title).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    const ikn = `${target.sourceKey}-ekap-${ekapIkn}`;

    let deadline: Date | null = null;
    if (t.ihaleTarihSaat) {
      const d = new Date(t.ihaleTarihSaat);
      if (!isNaN(d.getTime())) deadline = d;
    }

    const sourceUrl = `https://ekap.kik.gov.tr/EKAP/ortak/ihaleArama/ihaleArama.jsp?ikn=${t.ikn ?? ""}`;

    tenders.push({
      ikn,
      title,
      agencyName: t.idareAdi?.trim() || target.agency,
      type: t.ihaleTipAciklama?.trim() || "İhale",
      method: t.ihaleUsulAciklama?.trim() || "Bilinmiyor",
      estimatedValue: null,
      deadline,
      cpvCodes: [],
      il: t.ihaleIlAdi?.trim() || target.il,
      status: "active",
      category: "ihale",
      description: [
        title,
        `Kurum: ${t.idareAdi?.trim() || target.agency}`,
        `Kaynak: EKAP v2 (${target.agency} ihale arama fallback)`,
        t.ikn ? `EKAP İKN: ${t.ikn}` : "",
      ].filter(Boolean).join("\n"),
      sourceSystem: target.sourceKey,
      sourceUrl,
      procurementMethod: t.ihaleUsulAciklama?.trim() || null,
      documents: null,
      rawData: { ekapId: t.id, ekapIkn: t.ikn, idareAdi: t.idareAdi, fallback: "ekap-keyword" } as Record<string, unknown>,
      lastFetchedAt: new Date(),
    });
  }

  logger.info({ agency: target.agency, count: tenders.length }, "EKAP fallback records mapped");
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
      // Stage 1: Direct portal scraping
      let tenders = await retry(() => scrapeKitTarget(target), 2, 2000);
      logger.info({ agency: target.agency, count: tenders.length }, "KİT target scraped");

      // Stage 2: EKAP keyword fallback when portal yields nothing
      if (tenders.length === 0 && target.ekapKeyword) {
        tenders = await retry(() => fetchEkapFallback(target), 2, 3000);
      }

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

  await finalizeScraperRun({ source: "kit", startedAt, result: aggregate });

  return aggregate;
}
