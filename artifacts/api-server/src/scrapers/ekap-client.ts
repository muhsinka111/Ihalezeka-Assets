import axios, { AxiosInstance } from "axios";
import https from "https";
import crypto from "crypto";

const EKAP_BASE = "https://ekapv2.kik.gov.tr";
const AES_KEY = Buffer.from("Qm2LtXR0aByP69vZNKef4wMJ");

export interface EkapTender {
  id: string;
  ihaleAdi: string;
  ikn: string;
  ihaleTip: string;
  ihaleTipAciklama: string;
  ihaleUsul: string | null;
  ihaleUsulAciklama: string;
  ihaleDurum: string;
  ihaleDurumAciklama: string;
  idareAdi: string;
  ihaleIlAdi: string;
  ihaleTarihSaat: string;
  dokumanSayisi: number;
  dokumanListe: EkapDocument[];
}

export interface EkapDocument {
  adi: string;
  url: string;
  tur: string;
}

export interface EkapSearchResponse {
  list: EkapTender[];
  totalCount: number;
}

function aesCbcEncrypt(plaintext: string, key: Buffer, iv: Buffer): string {
  const cipher = crypto.createCipheriv("aes-192-cbc", key, iv);
  return Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]).toString("base64");
}

function generateSecurityHeaders(): Record<string, string> {
  const guid = crypto.randomUUID();
  const iv = crypto.randomBytes(16);
  const tsMs = String(Date.now());
  return {
    "X-Custom-Request-Guid": guid,
    "X-Custom-Request-Siv": iv.toString("base64"),
    "X-Custom-Request-Ts": aesCbcEncrypt(tsMs, AES_KEY, iv),
    "X-Custom-Request-R8id": aesCbcEncrypt(guid, AES_KEY, iv),
  };
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function createEkapClient(): AxiosInstance {
  return axios.create({
    baseURL: EKAP_BASE,
    timeout: 30000,
    httpsAgent,
    headers: {
      "Accept": "application/json",
      "Accept-Language": "tr",
      "Content-Type": "application/json",
      "Origin": EKAP_BASE,
      "Referer": `${EKAP_BASE}/ekap/search`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "api-version": "v1",
    },
  });
}

const client = createEkapClient();

function secHeaders() {
  return generateSecurityHeaders();
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function searchEkapTenders(
  startDate: string,
  endDate: string,
  skip = 0,
  take = 50,
): Promise<EkapSearchResponse> {
  const body = {
    ilanTarihSaatBaslangic: startDate,
    ilanTarihSaatBitis: endDate,
    paginationSkip: skip,
    paginationTake: take,
    ihaleTipler: [],
    ihaleUsuller: [],
    ihaleDurumlar: [],
    iller: [],
  };

  const response = await client.post(
    "/b_ihalearama/api/Ihale/GetListByParameters",
    body,
    { headers: secHeaders() },
  );

  const data = response.data;
  return {
    list: data.list ?? [],
    totalCount: data.totalCount ?? 0,
  };
}

export async function getAllEkapTendersForDate(
  startDate: string,
  endDate: string,
): Promise<EkapTender[]> {
  const firstPage = await searchEkapTenders(startDate, endDate, 0, 50);
  const allTenders: EkapTender[] = [...firstPage.list];
  const total = firstPage.totalCount;

  let skip = 50;
  while (allTenders.length < total) {
    await delay(300);
    const page = await searchEkapTenders(startDate, endDate, skip, 50);
    if (page.list.length === 0) break;
    allTenders.push(...page.list);
    skip += 50;
  }

  return allTenders;
}

export function formatEkapDate(daysBack = 1): { start: string; end: string } {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { start: formatDate(past), end: formatDate(now) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Minimal strip of HTML to readable plain text (announcement `veriHtml`). */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface EkapResolvedDocument {
  name: string;
  url: string;
  type: string;
}

interface EkapDetailIlan {
  baslik?: string;
  veriHtml?: string;
}

interface EkapDetailItem {
  ihaleAdi?: string;
  ihaleBilgi?: Record<string, unknown>;
  ilanList?: EkapDetailIlan[];
  ihaleOzellikList?: Array<{ ihaleOzellik?: string }>;
}

/** Human-readable Turkish labels for the `ihaleOzellikList` enum codes. */
const EKAP_OZELLIK_LABELS: Record<string, string> = {
  "TENDER_DETAIL.E_IHALE": "E-ihale",
  "TENDER_DETAIL.EKONOMIK_MALI_YETERLIK": "Ekonomik ve mali yeterlik aranıyor",
  "TENDER_DETAIL.IS_DENEYIM_BELGE": "İş deneyim belgesi aranıyor",
  "TENDER_DETAIL.MESLEKI_TEKNIK_YETERLIK": "Mesleki ve teknik yeterlik aranıyor",
  "TENDER_DETAIL.YERLI_ISTEKLI_AVANTAJ": "Yerli istekli avantajı uygulanıyor",
  "TENDER_DETAIL.YABANCI_ISTEKLI_KATILIM": "Yabancı isteklilere açık",
};

/**
 * Fetch the EKAP v2 tender detail for a tender, keyed by its TOP-LEVEL hash id
 * (`EkapTender.id`, e.g. "f898c0c4…") — NOT the numeric `dokumanListe[].ihaleId`,
 * which the detail endpoint rejects with 500 "Kayıt Bulunamadı". Reuses the same
 * AES security headers + TLS-relaxed agent as the search API. Returns `null`
 * (quietly) on any error so callers degrade gracefully.
 */
export async function fetchEkapDetail(
  ihaleIdHash: string,
): Promise<EkapDetailItem | null> {
  const id = String(ihaleIdHash ?? "").trim();
  if (!id) return null;
  try {
    const res = await client.post(
      "/b_ihalearama/api/IhaleDetay/GetByIhaleIdIhaleDetay",
      { ihaleId: id },
      { headers: secHeaders() },
    );
    const data = res.data;
    return (data?.item ?? data) as EkapDetailItem;
  } catch {
    return null;
  }
}

/**
 * Build notice/spec-level plain text from an EKAP detail item. The
 * `ilanList[].veriHtml` blocks are the legally-mandated İhale İlanı (and any
 * Düzeltme İlanı), which carry the scope, dates and qualification (yeterlik)
 * criteria — i.e. the substance of the tender specification — so this is the
 * real grounding text the AI analysis needs.
 */
export function buildEkapDetailText(item: EkapDetailItem | null): string {
  if (!item) return "";
  const parts: string[] = [];
  for (const ilan of item.ilanList ?? []) {
    const t = stripHtml(ilan.veriHtml ?? "");
    if (t.length >= 40) parts.push(t);
  }
  const ozellik = (item.ihaleOzellikList ?? [])
    .map((o) => EKAP_OZELLIK_LABELS[o.ihaleOzellik ?? ""] ?? "")
    .filter(Boolean);
  if (ozellik.length > 0) parts.push(`İhale özellikleri: ${ozellik.join("; ")}`);
  // De-duplicate (the Düzeltme İlanı repeats the idare/header blocks verbatim).
  const seen = new Set<string>();
  return parts
    .filter((p) => (seen.has(p) ? false : (seen.add(p), true)))
    .join("\n\n")
    .trim()
    .slice(0, 30_000);
}

/**
 * Resolve the official EKAP tender-document URL for a tender (its hash id).
 * `islemId` must be "1" (the document-list redirect); passing a document id
 * returns "Kayıt Bulunamadı". Returns the absolute legacy `ekap.kik.gov.tr`
 * URL, or `null` on any error.
 *
 * NOTE: that URL points at EKAP's document-download page which is protected by
 * an F5/Shape anti-bot gate ("Doğrula İşleminiz Devam Ediyor"), so the binary
 * şartname itself is NOT downloadable headlessly. We still store the URL as a
 * real document entry so the user has a working link to the official documents,
 * and we ground the AI on the detail/announcement text instead.
 */
export async function fetchEkapDocumentUrl(
  ihaleIdHash: string,
  islemId = "1",
): Promise<string | null> {
  const id = String(ihaleIdHash ?? "").trim();
  if (!id) return null;
  try {
    const res = await client.post(
      "/b_ihalearama/api/EkapDokumanYonlendirme/GetDokumanUrl",
      { islemId, ihaleId: id },
      { headers: secHeaders() },
    );
    const url = res.data?.url ?? res.data?.item?.url ?? null;
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

export interface EkapEnrichment {
  /** Notice/spec text from the detail announcement(s); "" when unavailable. */
  detailText: string;
  /** Resolved official document entries (empty when the URL can't be resolved). */
  documents: EkapResolvedDocument[];
}

/**
 * One-call enrichment for a tender keyed by its hash id: fetch the detail text
 * and resolve the official document URL. Never throws — fields are empty on
 * failure so the scraper/backfill degrade to the existing grounding chain.
 */
export async function enrichEkapTender(
  ihaleIdHash: string,
): Promise<EkapEnrichment> {
  const detail = await fetchEkapDetail(ihaleIdHash);
  const detailText = buildEkapDetailText(detail);

  const documents: EkapResolvedDocument[] = [];
  const docUrl = await fetchEkapDocumentUrl(ihaleIdHash);
  if (docUrl) {
    documents.push({
      name: "İhale Dokümanı (EKAP)",
      url: docUrl,
      type: "ekap-belge",
    });
  }

  return { detailText, documents };
}
