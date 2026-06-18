import axios from "axios";
import https from "https";
import crypto from "crypto";
import net from "net";
import dns from "dns/promises";
import { createRequire } from "module";
import type {
  AiAnalysis,
  TenderContact,
  FitVerdict,
  GroundingSource,
  GroundingConfidence,
} from "@workspace/db";

const _require = createRequire(import.meta.url);

/**
 * SSRF guard for outbound document downloads.
 *
 * Document URLs originate from external scrapers (EKAP / ilan.gov.tr) and are
 * stored in the DB. If that data is ever poisoned, the byte-proxy endpoints
 * (`/tenders/:id/document*`) could be turned into an SSRF sink. We therefore:
 *  - allow only http/https targets;
 *  - resolve the hostname and reject any private/loopback/link-local IP.
 */
function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

/** Returns true if it is unsafe to fetch the given absolute URL. */
async function isUnsafeFetchTarget(fullUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname;
  // Literal IP host — check directly.
  if (net.isIP(host)) return isPrivateIp(host);
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return true;
    return records.some((r) => isPrivateIp(r.address));
  } catch {
    return true; // resolution failed — treat as unsafe
  }
}

const EKAP_BASE = "https://ekapv2.kik.gov.tr";
const AES_KEY = Buffer.from("Qm2LtXR0aByP69vZNKef4wMJ");

/**
 * EKAP (ekapv2.kik.gov.tr) presents a certificate that does not pass Node.js
 * TLS validation (government CA not in the trust store). This matches the
 * existing pattern in ekap-client.ts for API calls to the same host.
 *
 * Security controls:
 *  - The relaxed agent is ONLY used after a strict-TLS attempt fails AND the
 *    hostname matches EKAP_HOSTNAME_RE (*.kik.gov.tr).
 *  - All non-EKAP URLs always use the strict agent.
 *  - Document content is validated by the AI model, not executed.
 */
const EKAP_HOSTNAME_RE = /^ekapv2?\.kik\.gov\.tr$/i;

/**
 * Any *.kik.gov.tr host (EKAP v2 API + the legacy `ekap.kik.gov.tr` document
 * host). Used to decide when the relaxed-TLS fallback is permitted — the legacy
 * document host presents the same untrusted government CA as the v2 API.
 */
const EKAP_TLS_FALLBACK_RE = /(^|\.)kik\.gov\.tr$/i;

/** Legacy EKAP host that fronts the actual document download (F5/Shape gated). */
const EKAP_LEGACY_HOSTNAME_RE = /^ekap\.kik\.gov\.tr$/i;
const EKAP_LEGACY_BASE = "https://ekap.kik.gov.tr";

const EKAP_TLS_ERRORS = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

const strictAgent = new https.Agent({ rejectUnauthorized: true });
const ekapFallbackAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: "TLSv1.2",
});

// ── In-process download cache ──────────────────────────────────────
// Keyed by normalised URL; lives for the lifetime of the process.
// Avoids re-fetching the same document on re-analyze calls.
const downloadCache = new Map<string, Buffer>();

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOWNLOAD_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500; // 500 ms → 1 000 ms → 2 000 ms

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const MAX_REDIRECT_HOPS = 5;

/**
 * Redirect-safe GET. Axios/follow-redirects only validates the initial URL, so a
 * public URL could 30x-redirect to a private/internal target and bypass the SSRF
 * guard. We disable automatic redirects and follow them manually, re-running
 * isUnsafeFetchTarget() on every hop before issuing the next request.
 */
async function safeAxiosGet(
  startUrl: string,
  opts: {
    agent: https.Agent;
    responseType: "arraybuffer" | "text";
    headers: Record<string, string>;
    maxContentLength?: number;
    transitional?: { silentJSONParsing: boolean };
    /**
     * When provided, Set-Cookie from every hop is merged into this jar and sent
     * back as the Cookie header on subsequent hops. EKAP's document download
     * stashes the requested ihaleId in the ASP.NET session on the first hop and
     * reads it back on the redirected download hop, so the session cookie must
     * stay consistent across the whole 302 chain.
     */
    cookieJar?: Map<string, string>;
  },
): Promise<import("axios").AxiosResponse> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const headers = { ...opts.headers };
    if (opts.cookieJar && opts.cookieJar.size > 0) {
      headers.Cookie = Array.from(opts.cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
    const res = await axios.get(url, {
      responseType: opts.responseType,
      timeout: DOWNLOAD_TIMEOUT_MS,
      httpsAgent: opts.agent,
      maxRedirects: 0,
      maxContentLength: opts.maxContentLength,
      headers,
      validateStatus: (s) => s >= 200 && s < 400,
      ...(opts.transitional ? { transitional: opts.transitional } : {}),
    });
    if (opts.cookieJar) collectSetCookies(res.headers?.["set-cookie"], opts.cookieJar);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers?.location;
      if (!loc) return res;
      const next = new URL(loc, url).toString();
      if (await isUnsafeFetchTarget(next)) {
        throw new Error("unsafe-redirect-target");
      }
      url = next;
      continue;
    }
    return res;
  }
  throw new Error("too-many-redirects");
}

function aesCbcEncrypt(plaintext: string, key: Buffer, iv: Buffer): string {
  const cipher = crypto.createCipheriv("aes-192-cbc", key, iv);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
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

// ── Legacy EKAP session warmup (anti-bot cookie jar) ───────────────
// The legacy `ekap.kik.gov.tr` document host is fronted by an F5/Shape anti-bot
// gate: a cold request is answered with a "Doğrula / İşleminiz Devam Ediyor"
// HTML interstitial (or a 302 to it) instead of the file. The EKAP document flow
// is therefore: warm up a session to obtain its cookies, then issue the download
// with those cookies. We cache the cookie process-wide for a short TTL.
const EKAP_COOKIE_TTL_MS = 10 * 60 * 1000;
let ekapLegacyCookie: { value: string; ts: number } | null = null;

function collectSetCookies(setCookie: unknown, jar: Map<string, string>): void {
  if (!Array.isArray(setCookie)) return;
  for (const c of setCookie) {
    if (typeof c !== "string") continue;
    const pair = c.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

/**
 * Warm up an EKAP legacy session and return a Cookie header string ("" on
 * failure). Cached for EKAP_COOKIE_TTL_MS; pass force=true to re-warm after the
 * gate rejects a request. Targets are hard-coded EKAP URLs (no user input), so
 * following their redirects here does not widen the SSRF surface.
 */
async function getEkapLegacyCookie(force = false): Promise<string> {
  const now = Date.now();
  if (!force && ekapLegacyCookie && now - ekapLegacyCookie.ts < EKAP_COOKIE_TTL_MS) {
    return ekapLegacyCookie.value;
  }
  const jar = new Map<string, string>();
  const warmTargets = [
    `${EKAP_LEGACY_BASE}/EKAP/YeniIhaleArama.aspx`,
    `${EKAP_LEGACY_BASE}/EKAP/Ortak/YeniIhaleAramaData.ashx?metot=idareAra&aranan=a`,
  ];
  for (const u of warmTargets) {
    try {
      const res = await axios.get(u, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        httpsAgent: ekapFallbackAgent,
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          Connection: "keep-alive",
        },
        validateStatus: () => true,
      });
      collectSetCookies(res.headers?.["set-cookie"], jar);
    } catch {
      // best-effort — a failed warmup just yields no cookie for this target
    }
  }
  const value = Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  ekapLegacyCookie = { value, ts: now };
  return value;
}

/**
 * True when a downloaded buffer is the EKAP anti-bot/verification HTML gate
 * (F5/Shape JS challenge) rather than the real attachment, so the caller can
 * stop and fall back to notice/detail grounding instead of ingesting the gate.
 */
function looksLikeAntiBotHtml(buffer: Buffer): boolean {
  const head = buffer.toString("utf8", 0, Math.min(buffer.length, 4_000));
  if (!/<!doctype html|<html[\s>]/i.test(head)) return false;
  // Scan the whole page — the F5/Shape gate buries its "Doğrula / İşleminiz Devam
  // Ediyor" notice well past the first 50 KB of challenge script, so a short
  // window would miss it and we'd cache a useless interstitial as a "document".
  const visible = stripHtml(buffer.toString("utf8", 0, Math.min(buffer.length, 500_000)));
  return (
    visible.length < 200 ||
    /İşleminiz Devam Ediyor|Doğrula|verification in progress|are you a human|captcha/i.test(
      visible,
    )
  );
}

/** Seed a cookie jar from a "k=v; k2=v2" Cookie header string. */
function seedCookieJar(cookie: string): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of cookie.split(";")) {
    const p = part.trim();
    const i = p.indexOf("=");
    if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
  return jar;
}

/** Single HTTP attempt — returns Buffer on success, throws on failure. */
async function attemptDownload(
  fullUrl: string,
  isEkap: boolean,
  isLegacyEkap: boolean,
  cookie = "",
): Promise<Buffer> {
  // The legacy EKAP document host (ekap.kik.gov.tr) is fronted by an F5 WAF that
  // rejects the EKAP v2 API's signed security headers and ekapv2 Origin with a
  // 400. It expects a plain browser request carrying the warmed-up session
  // cookie, which must persist across the 302 → IlanDokumanDownload hop.
  const headers: Record<string, string> = isLegacyEkap
    ? {
        Accept: "*/*",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Referer: `${EKAP_LEGACY_BASE}/EKAP/YeniIhaleArama.aspx`,
      }
    : {
        ...generateSecurityHeaders(),
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        Referer: `${EKAP_BASE}/ekap/search`,
        Origin: EKAP_BASE,
      };
  // Legacy host uses a session cookie jar (carried across redirect hops);
  // non-legacy hosts keep their simple static Cookie header (if any).
  const cookieJar = isLegacyEkap ? seedCookieJar(cookie) : undefined;
  if (!isLegacyEkap && cookie) headers.Cookie = cookie;

  try {
    const res = await safeAxiosGet(fullUrl, {
      agent: strictAgent,
      responseType: "arraybuffer",
      headers,
      cookieJar,
    });
    return Buffer.from(res.data);
  } catch (strictErr: any) {
    // For EKAP hosts only: fall back to relaxed TLS when the government CA is
    // not trusted — this mirrors the same pattern in ekap-client.ts.
    if (isEkap && EKAP_TLS_ERRORS.has(strictErr?.code)) {
      const res = await safeAxiosGet(fullUrl, {
        agent: ekapFallbackAgent,
        responseType: "arraybuffer",
        headers,
        cookieJar,
      });
      return Buffer.from(res.data);
    }
    throw strictErr;
  }
}

/**
 * Fetch document bytes with:
 *  - up to MAX_DOWNLOAD_ATTEMPTS retries with exponential back-off
 *  - per-attempt error logging
 *  - in-process cache: successful buffers are stored for the process lifetime
 *    so re-analyze calls skip the network entirely.
 *
 * Returns null if all attempts fail.
 */
export async function fetchDocumentBytes(url: string): Promise<Buffer | null> {
  const fullUrl = url.startsWith("http") ? url : `${EKAP_BASE}${url}`;
  const cacheKey = fullUrl;

  // Cache hit — no network round-trip needed.
  const cached = downloadCache.get(cacheKey);
  if (cached) return cached;

  let hostname: string;
  try {
    hostname = new URL(fullUrl).hostname;
  } catch {
    console.warn(`[document-analyzer] Invalid URL, skipping: ${url}`);
    return null;
  }

  // SSRF guard: refuse non-http(s) targets and any host that resolves to a
  // private/loopback/link-local address.
  if (await isUnsafeFetchTarget(fullUrl)) {
    console.warn(`[document-analyzer] Blocked unsafe fetch target: ${fullUrl}`);
    return null;
  }

  // Relaxed-TLS fallback is allowed for any *.kik.gov.tr host (v2 API + legacy
  // document host), both of which present the untrusted government CA.
  const isEkap = EKAP_TLS_FALLBACK_RE.test(hostname);
  const isLegacyEkap = EKAP_LEGACY_HOSTNAME_RE.test(hostname);

  // EKAP document flow: warm up a legacy session first so the download is issued
  // with the anti-bot/session cookies (per the spec's 302 → warmup → retry rule).
  let cookie = isLegacyEkap ? await getEkapLegacyCookie() : "";

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const buffer = await attemptDownload(fullUrl, isEkap, isLegacyEkap, cookie);
      if (buffer.length === 0) {
        console.warn(
          `[document-analyzer] Empty response on attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}: ${fullUrl}`,
        );
        // Treat empty body as a retriable failure.
        throw new Error("empty-response");
      }
      // Legacy EKAP answered with its F5/Shape anti-bot JS challenge page rather
      // than the file. The challenge cannot be solved headlessly, so retrying or
      // re-warming won't help — stop now (without caching the gate page) and let
      // the grounding chain fall back to the notice/detail text.
      if (isLegacyEkap && looksLikeAntiBotHtml(buffer)) {
        console.warn(
          `[document-analyzer] EKAP anti-bot gate served instead of document — falling back: ${fullUrl}`,
        );
        return null;
      }
      // Cache and return on success.
      downloadCache.set(cacheKey, buffer);
      return buffer;
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "unknown";
      const isLast = attempt === MAX_DOWNLOAD_ATTEMPTS;
      console.warn(
        `[document-analyzer] Download ${isLast ? "FAILED" : "error"} (attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}, code=${code}): ${fullUrl}`,
      );
      if (isLast) return null;
      // A cold legacy request (4xx/302 from the gate) often needs a warmed
      // session — refresh the cookie before the next attempt.
      if (isLegacyEkap) cookie = await getEkapLegacyCookie(true);
      // Exponential back-off: 500 ms, 1 000 ms, …
      await sleep(BACKOFF_BASE_MS * attempt);
    }
  }

  return null; // unreachable, but satisfies TypeScript
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = _require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch {
    return "";
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> } =
      _require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  } catch {
    return "";
  }
}

export async function extractTextFromDocument(
  buffer: Buffer,
  docType: string,
  docName: string,
): Promise<string> {
  const hint = (docType + " " + docName).toLowerCase();
  if (hint.includes("pdf")) return extractTextFromPdf(buffer);
  if (hint.includes("docx") || hint.includes("doc") || hint.includes("word"))
    return extractTextFromDocx(buffer);
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 50_000));
  // HTML served in place of a real attachment — most commonly an EKAP anti-bot /
  // "Doğrula" verification gate returned instead of the binary şartname. Strip to
  // visible text; if it is a verification interstitial (or carries no real prose)
  // return "" so the grounding chain falls back to notice/detail text rather than
  // ingesting raw markup as if it were the document.
  if (/<!doctype html|<html[\s>]/i.test(text)) {
    const visible = stripHtml(buffer.toString("utf8"));
    if (
      visible.length < 200 ||
      /İşleminiz Devam Ediyor|Doğrula|verification in progress|are you a human|captcha/i.test(
        visible,
      )
    ) {
      return "";
    }
    return visible;
  }
  const printableRatio =
    text.replace(/[^\x20-\x7E\u00C0-\u024F\s]/g, "").length / Math.max(text.length, 1);
  if (printableRatio > 0.5) return text;
  return extractTextFromPdf(buffer);
}

async function getAnthropic() {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  return anthropic;
}

const EXTRACTION_PROMPT = `Sen bir Türk kamu ihalesi uzmanısın. Aşağıda sana bir ihaleye ait MEVCUT bilgi (belge metni, ilan/duyuru metni veya ihale künyesi) ve (varsa) başvuran firmanın profili verilecek. Bu bilgiyi analiz et ve yapılandırılmış bilgi çıkar.

ÖNEMLİ KURALLAR:
- Tüm çıkarımlar SADECE sana verilen metne dayanmalı. Metinde olmayan sayısal/teknik gereksinimleri UYDURMA; bir alan metinde yoksa null veya boş liste döndür.
- Sana verilen bilgi sınırlı olsa bile (örneğin sadece ihale künyesi/başlığı), ASLA "doküman bulunamadı", "bilgi mevcut belgelerde bulunamadı" gibi bir RET cevabı verme. Her zaman eldeki bilgiye dayanan gerçek bir özet ve değerlendirme üret.
- Bilgi sınırlıysa, özette ihalenin konusunu/idaresini/kapsamını eldeki künyeye göre açıkla ve gereksinimlerin resmi ilan/dokümandan teyit edilmesi gerektiğini kısaca belirt. Yine de fitVerdict, pros ve risks alanlarını eldeki bilgiye göre doldur.

Metinden şunları çıkar:
1. Kısa özet (2-3 cümle, Türkçe)
2. Gerekli ciro eşiği (TL cinsinden TAM SAYI, yoksa null — örnek: 5000000)
3. Asgari deneyim yılı (TAM SAYI, yoksa null — örnek: 5)
4. Asgari personel sayısı (TAM SAYI, yoksa null — örnek: 10)
5. Teknik şartnameden önemli gereksinimler (liste, en fazla 8 madde, Türkçe)
6. Değerlendirme kriterleri ağırlıkları (obje: {"Fiyat": 40, "Teknik": 60} formatında, boş olabilir)
7. Yeterlilik kriterleri — SADECE belge metninde açıkça belirtilmiş kriterler (liste: her biri {criterion: string, threshold: string|null} formatında, en fazla 8 madde)
8. Genel uygunluk kararı (fitVerdict): firmanın bu ihaleye girmesi için "uygun" (güçlü uyum), "dikkat" (bazı riskler/eksikler var) veya "uygun_degil" (ciddi engeller var). Firma profili verilmemişse belgenin genel zorluğuna göre değerlendir.
9. Kararın gerekçesi (fitReason): 1-2 cümle, belgeye dayalı Türkçe açıklama.
10. Artılar (pros): firma için olumlu yönler (liste, en fazla 5 madde, Türkçe).
11. Riskler (risks): dikkat edilmesi gereken riskler/zorluklar (liste, en fazla 5 madde, Türkçe).
12. İletişim bilgileri (contact): idarenin adı, açık adresi, telefonu, e-postası ve irtibat kişisi. Belgede yoksa ilgili alan null olsun.

Sadece JSON döndür, başka açıklama ekleme:
{
  "summary": "...",
  "requiredTurnover": null,
  "experienceYears": null,
  "personnelCount": null,
  "technicalSpecs": [],
  "scoringWeights": {},
  "qualificationCriteria": [],
  "fitVerdict": "dikkat",
  "fitReason": "...",
  "pros": [],
  "risks": [],
  "contact": { "authority": null, "address": null, "phone": null, "email": null, "contactPerson": null }
}`;

function normalizeVerdict(v: unknown): FitVerdict | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(/\s+/g, "_");
  if (s.includes("uygun_degil") || s.includes("uygun_değil") || s === "no-go" || s === "nogo") return "uygun_degil";
  if (s === "uygun" || s === "go") return "uygun";
  if (s === "dikkat" || s === "caution") return "dikkat";
  return null;
}

function normalizeContact(c: unknown): TenderContact | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
  const contact: TenderContact = {
    authority: str(o.authority),
    address: str(o.address),
    phone: str(o.phone),
    email: str(o.email),
    contactPerson: str(o.contactPerson),
  };
  const hasAny = Object.values(contact).some((v) => v != null);
  return hasAny ? contact : null;
}

/**
 * Hard-refusal detector. The product requirement is that the analyzer/chat must
 * NEVER answer with a "documents could not be found / downloaded / accessed"
 * refusal — prompting alone is not a guarantee, so we deterministically detect
 * and replace such output. NOTE: this intentionally does NOT match the allowed
 * soft phrasing ("bu detay eldeki ihale bilgisinde yer almıyor"), which is a
 * legitimate, grounded answer rather than a blanket refusal.
 */
const REFUSAL_RE =
  /(belge|belgeler|doküman|dokuman|dökuman)\w*\s+(bulunamad|indirilemed|erişilemed|erisilemed|mevcut\s+değil|mevcut\s+degil)|mevcut\s+belgelerde\s+bulunamad|bilgi\s+mevcut\s+belgelerde\s+bulunamad|no\s+documents?\s+(found|available)|could\s+not\s+(find|access|download)\s+(the\s+)?documents?|unable\s+to\s+(access|find|download)\s+(the\s+)?documents?/i;

function isRefusal(text: string | null | undefined): boolean {
  return !!text && REFUSAL_RE.test(text);
}

/** Build a grounded summary from the resolved context — used when the model refuses. */
function groundedFallbackSummary(
  title: string,
  source: GroundingSource,
  contextText: string,
): string {
  const snippet = contextText.replace(/\s+/g, " ").trim().slice(0, 400);
  const label = GROUNDING_LABEL[source].toLowerCase();
  const base = `${title} ihalesine ilişkin değerlendirme ${label} esas alınarak yapılmıştır.`;
  const detail = snippet ? ` Eldeki bilgi: ${snippet}${snippet.length >= 400 ? "…" : ""}` : "";
  const note =
    source === "document" || source === "notice"
      ? ""
      : " Ayrıntılı gereksinimlerin resmi ilan/ihale dokümanından teyit edilmesi önerilir.";
  return `${base}${detail}${note}`.trim();
}

const GROUNDING_LABEL: Record<GroundingSource, string> = {
  document: "İhale dokümanından çıkarılan metin",
  notice: "İhale ilan/duyuru metni",
  source_page: "Kaynak ilan sayfasından alınan metin",
  metadata: "Yalnızca ihale künyesi (detaylı doküman metni yok)",
};

async function analyzeWithAI(
  textContent: string,
  tenderTitle: string,
  groundingSource: GroundingSource = "notice",
): Promise<AiAnalysis> {
  const anthropic = await getAnthropic();
  const maxChars = 12_000;
  const truncated =
    textContent.length > maxChars
      ? textContent.slice(0, maxChars) + "\n\n[Metin kesildi — belge çok uzun]"
      : textContent;

  const sourceNote =
    groundingSource === "metadata"
      ? "\n\nNOT: Bu ihale için detaylı doküman metni mevcut değil; aşağıdaki bilgi yalnızca ihale künyesidir. Yine de eldeki bilgiye dayalı gerçek bir özet ve değerlendirme üret, RET cevabı verme."
      : "";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `İhale Adı: ${tenderTitle}\n\nBilgi Kaynağı: ${GROUNDING_LABEL[groundingSource]}${sourceNote}\n\nMevcut Bilgi:\n${truncated}`,
      },
    ],
  });

  const firstBlock = response.content[0];
  const raw = firstBlock?.type === "text" ? firstBlock.text : "{}";
  let parsed: Partial<AiAnalysis> = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    parsed = {};
  }

  // Deterministic refusal guardrail: never let a "documents not found/downloadable"
  // refusal escape as the summary — replace it with a grounded fallback.
  const rawSummary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const summary =
    rawSummary && !isRefusal(rawSummary)
      ? rawSummary
      : groundedFallbackSummary(tenderTitle, groundingSource, truncated);

  return {
    summary,
    requiredTurnover: typeof parsed.requiredTurnover === "number" ? parsed.requiredTurnover : null,
    experienceYears: typeof parsed.experienceYears === "number" ? parsed.experienceYears : null,
    personnelCount: typeof parsed.personnelCount === "number" ? parsed.personnelCount : null,
    technicalSpecs: Array.isArray(parsed.technicalSpecs) ? parsed.technicalSpecs : [],
    scoringWeights:
      parsed.scoringWeights && typeof parsed.scoringWeights === "object"
        ? (parsed.scoringWeights as Record<string, number>)
        : {},
    qualificationCriteria: Array.isArray(parsed.qualificationCriteria)
      ? parsed.qualificationCriteria
      : [],
    analyzedAt: new Date().toISOString(),
    fitVerdict: normalizeVerdict(parsed.fitVerdict),
    fitReason: typeof parsed.fitReason === "string" ? parsed.fitReason : null,
    pros: Array.isArray(parsed.pros) ? parsed.pros.filter((p) => typeof p === "string") : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.filter((r) => typeof r === "string") : [],
    contact: normalizeContact(parsed.contact),
  };
}

/**
 * Everything the grounding chain needs to resolve a text context for a tender.
 * Accepts the relevant subset of a tender row (all source systems).
 */
export interface TenderGroundingInput {
  title: string;
  type?: string | null;
  method?: string | null;
  agencyName?: string | null;
  il?: string | null;
  category?: string | null;
  cpvCodes?: string[] | null;
  estimatedValue?: number | null;
  deadline?: Date | string | null;
  description?: string | null;
  sourceSystem?: string | null;
  sourceUrl?: string | null;
  documents?: Array<{ name: string; url: string; type: string }> | null;
  rawData?: Record<string, unknown> | null;
}

/** Outcome of the mandatory grounding chain — never has empty text. */
export interface GroundingResult {
  text: string;
  source: GroundingSource;
  confidence: GroundingConfidence;
  docsDownloaded: number;
  docsTotal: number;
}

/** Result type returned by analyzeTender — extends AiAnalysis with coverage stats. */
export interface DocumentAnalysisResult {
  analysis: AiAnalysis;
  /** Number of documents successfully downloaded and parsed. */
  docsDownloaded: number;
  /** Total number of document URLs provided (including ones that failed). */
  docsTotal: number;
}

/** Result of extracting raw text from a tender's documents. */
export interface ExtractedDocsText {
  /** Concatenated, per-document labelled text (empty string when nothing extractable). */
  text: string;
  docsDownloaded: number;
  docsTotal: number;
}

const MAX_EXTRACT_CHARS = 40_000;

/**
 * Download (with EKAP TLS fallback + cache) and extract text from up to the
 * first few documents of a tender. Shared by analyzeDocuments and the
 * document-chat endpoint so text extraction is consistent and reuses the cache.
 */
export async function extractDocumentsText(
  documents: Array<{ name: string; url: string; type: string }>,
  tenderTitle = "",
): Promise<ExtractedDocsText> {
  const docsToFetch = (documents ?? []).filter((d) => !!d.url).slice(0, 3);
  const docsTotal = docsToFetch.length;
  let docsDownloaded = 0;
  const allText: string[] = [];

  for (const doc of docsToFetch) {
    const buffer = await fetchDocumentBytes(doc.url);
    if (!buffer || buffer.length === 0) {
      console.warn(
        `[document-analyzer] Skipping doc after all retries — tender="${tenderTitle}" doc="${doc.name}"`,
      );
      continue;
    }

    const text = await extractTextFromDocument(buffer, doc.type ?? "", doc.name ?? "");
    if (text.trim().length > 50) {
      docsDownloaded++;
      allText.push(`=== ${doc.name} ===\n${text.trim()}`);
    } else {
      console.warn(
        `[document-analyzer] Doc downloaded but no extractable text — tender="${tenderTitle}" doc="${doc.name}"`,
      );
    }
    if (allText.join("\n").length > MAX_EXTRACT_CHARS) break;
  }

  return {
    text: allText.join("\n\n").slice(0, MAX_EXTRACT_CHARS),
    docsDownloaded,
    docsTotal,
  };
}

/** Extends DocumentAnalysisResult with the raw extracted text used for analysis. */
export interface DocumentAnalysisResultWithText extends DocumentAnalysisResult {
  /** Combined extracted document text (for persistence + later document chat). */
  extractedText: string;
}

// ── Grounding chain ────────────────────────────────────────────────
// The analyzer/chat MUST always have text to work with. We try, in order:
//   1. extracted attachment document text (persisted _docText or live download)
//   2. stored notice/detail text (description / ilan content / raw_data harvest)
//   3. live-fetched source_url page text
//   4. tender metadata (always available)
// The first step yielding >= MIN_GROUNDING_CHARS wins; step 4 is the guaranteed
// floor, so the context passed to the AI is NEVER empty.

const MIN_GROUNDING_CHARS = 200;

/** Keys in raw_data that commonly carry the human-readable notice/detail text. */
const RAW_TEXT_KEYS = [
  "content", "notice_text", "noticeText", "bid_description", "bidDescription",
  "description", "aciklama", "açıklama", "ozet", "özet", "summary", "text",
  "detay", "ihaleKonusu", "konu", "scope", "legalBasisDetail",
];

/** raw_data keys we must never harvest as grounding text. */
const RAW_SKIP_KEYS = new Set([
  "_docText",
  "_docTextSource",
  "_aiAnalysis",
  "_groundingSource",
]);

/** Strip HTML to readable plain text (scripts/styles removed, entities decoded). */
export function stripHtml(html: string): string {
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

/** Harvest readable text from raw_data string fields (HTML stripped where needed). */
function harvestRawDataText(rawData: Record<string, unknown> | null | undefined): string {
  if (!rawData || typeof rawData !== "object") return "";
  const parts: string[] = [];
  const seen = new Set<string>();
  const consider = (v: unknown) => {
    if (typeof v !== "string") return;
    const trimmed = v.trim();
    if (!trimmed) return;
    if (/^https?:\/\//i.test(trimmed)) return; // url
    if (/^[\w.+-]+@[\w.-]+$/.test(trimmed)) return; // email
    const cleaned = /<[a-z!/][\s\S]*>/i.test(trimmed) ? stripHtml(trimmed) : trimmed;
    if (cleaned.length < 20) return;
    const key = cleaned.slice(0, 100).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(cleaned);
  };
  // Priority known text keys first, then any other long string field.
  for (const k of RAW_TEXT_KEYS) {
    if (k in rawData && !RAW_SKIP_KEYS.has(k)) consider((rawData as Record<string, unknown>)[k]);
  }
  for (const [k, v] of Object.entries(rawData)) {
    if (RAW_TEXT_KEYS.includes(k) || RAW_SKIP_KEYS.has(k)) continue;
    if (typeof v === "string" && v.length >= 60) consider(v);
  }
  return parts.join("\n\n").slice(0, MAX_EXTRACT_CHARS);
}

/** Build a labelled metadata block — the guaranteed grounding floor. */
function buildMetadataText(t: TenderGroundingInput): string {
  const deadline =
    t.deadline != null
      ? (() => {
          const d = t.deadline instanceof Date ? t.deadline : new Date(t.deadline);
          return isNaN(d.getTime()) ? null : d.toLocaleString("tr-TR");
        })()
      : null;
  return [
    `İhale Başlığı: ${t.title}`,
    t.agencyName && `İdare / Kurum: ${t.agencyName}`,
    t.il && `İl: ${t.il}`,
    t.type && `İhale Türü: ${t.type}`,
    t.method && `İhale Usulü: ${t.method}`,
    t.category && `Kategori: ${t.category}`,
    t.cpvCodes && t.cpvCodes.length > 0 && `CPV Kodları: ${t.cpvCodes.join(", ")}`,
    t.estimatedValue != null && `Yaklaşık/İhale Bedeli: ${t.estimatedValue.toLocaleString("tr-TR")} TL`,
    deadline && `Son Teklif / İhale Tarihi: ${deadline}`,
    t.sourceUrl && `Kaynak Bağlantısı: ${t.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Resolve stored notice/detail text (chain step 2). */
function resolveStoredText(t: TenderGroundingInput): string {
  const desc = (t.description ?? "").trim();
  if (desc.length >= MIN_GROUNDING_CHARS) return desc;
  const content =
    typeof t.rawData?.content === "string" ? stripHtml(t.rawData.content as string) : "";
  if (content.length >= MIN_GROUNDING_CHARS) return content;
  const harvested = harvestRawDataText(t.rawData);
  if (harvested.length >= MIN_GROUNDING_CHARS) return harvested;
  // Return whatever partial text exists (used to enrich the metadata floor).
  return [desc, content, harvested].sort((a, b) => b.length - a.length)[0] ?? "";
}

/** Live-fetch the source page and extract readable text (chain step 3). */
async function fetchPageText(url: string): Promise<string> {
  try {
    if (!url || !url.startsWith("http")) return "";
    if (await isUnsafeFetchTarget(url)) return "";
    const isEkap = EKAP_TLS_FALLBACK_RE.test(new URL(url).hostname);
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    };
    const get = (agent: https.Agent) =>
      safeAxiosGet(url, {
        agent,
        responseType: "text",
        maxContentLength: 8_000_000,
        headers,
        transitional: { silentJSONParsing: true },
      });
    let res;
    try {
      res = await get(strictAgent);
    } catch (err: any) {
      if (isEkap && EKAP_TLS_ERRORS.has(err?.code)) res = await get(ekapFallbackAgent);
      else throw err;
    }
    const html = typeof res.data === "string" ? res.data : String(res.data ?? "");
    return stripHtml(html).slice(0, MAX_EXTRACT_CHARS);
  } catch (err: any) {
    console.warn(`[document-analyzer] source page fetch failed (${err?.code ?? err?.message}): ${url}`);
    return "";
  }
}

/** Run the mandatory grounding chain. Never returns empty text. */
export async function resolveGrounding(t: TenderGroundingInput): Promise<GroundingResult> {
  let docsDownloaded = 0;
  let docsTotal = 0;

  // Step 1a: persisted attachment text (set by a prior analyze / task #72).
  // Only trust it as a real document when it carries the provenance marker we
  // write at persist time — otherwise legacy/poisoned _docText could be mislabelled.
  const persisted =
    typeof t.rawData?._docText === "string" ? (t.rawData._docText as string).trim() : "";
  const persistedIsDocument = t.rawData?._docTextSource === "document";
  if (persistedIsDocument && persisted.length >= MIN_GROUNDING_CHARS) {
    return { text: persisted, source: "document", confidence: "high", docsDownloaded, docsTotal };
  }
  // Step 1b: live download + extract any real document URLs (empty today).
  const docs = (t.documents ?? []).filter((d) => !!d.url);
  if (docs.length > 0) {
    const extracted = await extractDocumentsText(docs, t.title);
    docsDownloaded = extracted.docsDownloaded;
    docsTotal = extracted.docsTotal;
    if (extracted.text.trim().length >= MIN_GROUNDING_CHARS) {
      return {
        text: extracted.text,
        source: "document",
        confidence: "high",
        docsDownloaded,
        docsTotal,
      };
    }
  }

  // Step 2: stored notice/detail text.
  const stored = resolveStoredText(t);
  if (stored.length >= MIN_GROUNDING_CHARS) {
    return { text: stored, source: "notice", confidence: "high", docsDownloaded, docsTotal };
  }

  // Step 3: live source page.
  if (t.sourceUrl) {
    const page = await fetchPageText(t.sourceUrl);
    if (page.length >= MIN_GROUNDING_CHARS) {
      return { text: page, source: "source_page", confidence: "medium", docsDownloaded, docsTotal };
    }
  }

  // Step 4: metadata floor (always). Enrich with any partial stored text found.
  const meta = buildMetadataText(t);
  const text = stored ? `${meta}\n\n${stored}` : meta;
  return { text, source: "metadata", confidence: "low", docsDownloaded, docsTotal };
}

export async function analyzeTender(
  input: TenderGroundingInput,
): Promise<DocumentAnalysisResultWithText & { groundingSource: GroundingSource; confidence: GroundingConfidence }> {
  const grounding = await resolveGrounding(input);

  const contextPrefix = [
    input.type && `Tür: ${input.type}`,
    input.method && `Usul: ${input.method}`,
    input.agencyName && `İdare: ${input.agencyName}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const combinedText = contextPrefix ? `${contextPrefix}\n\n${grounding.text}` : grounding.text;
  const analysis = await analyzeWithAI(combinedText, input.title, grounding.source);
  analysis.docsDownloaded = grounding.docsDownloaded;
  analysis.docsTotal = grounding.docsTotal;
  analysis.groundingSource = grounding.source;
  analysis.confidence = grounding.confidence;

  // Only persist text as attachment text when it really came from documents —
  // otherwise step 1 of the chain would later mislabel notice text as "document".
  const extractedText = grounding.source === "document" ? grounding.text : "";

  return {
    analysis,
    docsDownloaded: grounding.docsDownloaded,
    docsTotal: grounding.docsTotal,
    extractedText,
    groundingSource: grounding.source,
    confidence: grounding.confidence,
  };
}

export interface DocumentChatInput {
  tenderTitle: string;
  agencyName?: string;
  /** Grounded tender text (documents / notice / source page / metadata). */
  docText: string;
  /** Where docText came from, so the assistant frames its answer honestly. */
  groundingSource?: GroundingSource;
  question: string;
  /** Prior turns (most recent last). Optional. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const DOC_CHAT_SYSTEM = `Sen bir Türk kamu ihalesi uzmanı asistanısın. Kullanıcının sorusunu SADECE aşağıda verilen ihale bilgisine (belge metni, ilan/duyuru metni veya ihale künyesi) dayanarak yanıtla.

Kurallar:
- Yanıtların yalnızca verilen ihale bilgisine dayanmalı. Verilmeyen bir bilgiyi UYDURMA.
- Sorunun yanıtı eldeki bilgide yoksa, bunu kibarca belirt ("Bu detay eldeki ihale bilgisinde yer almıyor; resmi ilan veya ihale dokümanını kontrol edebilirsiniz.") ve varsa konuyla ilgili genel bilgiyi yine de paylaş. ASLA "belge indirilemedi/bulunamadı" deme — sana her zaman en azından ihale künyesi verilir.
- Kısa, net ve Türkçe yanıt ver. Mümkünse ilgili tutar/tarih/madde gibi somut bilgileri ver.`;

export async function chatWithDocuments(input: DocumentChatInput): Promise<string> {
  const { tenderTitle, agencyName, docText, groundingSource = "metadata", question, history } = input;
  const anthropic = await getAnthropic();

  const trimmedDocs =
    docText && docText.trim().length > 0
      ? docText.slice(0, 24_000)
      : `İhale: ${tenderTitle}${agencyName ? ` — ${agencyName}` : ""}`;

  const systemContent = `${DOC_CHAT_SYSTEM}\n\nİhale: ${tenderTitle}${agencyName ? ` — ${agencyName}` : ""}\nBilgi Kaynağı: ${GROUNDING_LABEL[groundingSource]}\n\nMevcut İhale Bilgisi:\n${trimmedDocs}`;

  const historyMessages = (history ?? []).slice(-6).filter(m => m.role !== "system") as Array<{ role: "user" | "assistant"; content: string }>;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 700,
    system: systemContent,
    messages: [
      ...historyMessages,
      { role: "user", content: question },
    ],
  });

  const firstBlock = response.content[0];
  const answer = firstBlock?.type === "text" ? firstBlock.text.trim() : "";
  // Deterministic refusal guardrail: replace a hard "documents unavailable" refusal
  // with a grounded, honest answer that still leans on the available tender info.
  if (!answer || isRefusal(answer)) {
    const snippet = trimmedDocs.replace(/\s+/g, " ").trim().slice(0, 500);
    return `Bu detay eldeki ihale bilgisinde net olarak yer almıyor; resmi ilan veya ihale dokümanını kontrol edebilirsiniz. Eldeki bilgiye göre: ${snippet}`;
  }
  return answer;
}

export interface CriteriaComplianceItem {
  criterion: string;
  /**
   * true  — company meets the threshold
   * false — company does NOT meet the threshold
   * null  — cannot determine (company data missing, or no numeric threshold)
   */
  compliant: boolean | null;
  note: string | null;
}

export interface CompanySnapshot {
  annualRevenue?: number | null;
  experienceCeiling?: number | null;
  personnelCount?: number | null;
}

export function computeCriteriaCompliance(
  aiAnalysis: AiAnalysis,
  company: CompanySnapshot,
): CriteriaComplianceItem[] {
  const results: CriteriaComplianceItem[] = [];

  if (aiAnalysis.requiredTurnover != null) {
    const has = company.annualRevenue != null;
    results.push({
      criterion: "Ciro Yeterliliği",
      compliant: has ? company.annualRevenue! >= aiAnalysis.requiredTurnover : null,
      note: `Gerekli: ₺${aiAnalysis.requiredTurnover.toLocaleString("tr-TR")}${has ? ` / Firmanız: ₺${company.annualRevenue!.toLocaleString("tr-TR")}` : " — Firma cirosu profilde girilmemiş"}`,
    });
  }

  if (aiAnalysis.experienceYears != null) {
    const has = company.experienceCeiling != null;
    results.push({
      criterion: "Deneyim Yeterliliği",
      compliant: has ? company.experienceCeiling! >= aiAnalysis.experienceYears : null,
      note: `Gerekli: ${aiAnalysis.experienceYears} yıl${has ? ` / Firmanız: ${company.experienceCeiling} yıl` : " — Deneyim profilde girilmemiş"}`,
    });
  }

  if (aiAnalysis.personnelCount != null) {
    const has = company.personnelCount != null;
    results.push({
      criterion: "Personel Sayısı",
      compliant: has ? company.personnelCount! >= aiAnalysis.personnelCount : null,
      note: `Gerekli: ${aiAnalysis.personnelCount} kişi${has ? ` / Firmanız: ${company.personnelCount} kişi` : " — Personel sayısı profilde girilmemiş"}`,
    });
  }

  for (const c of aiAnalysis.qualificationCriteria ?? []) {
    results.push({
      criterion: c.criterion,
      compliant: null,
      note: c.threshold
        ? `Eşik: ${c.threshold} — Profil karşılaştırması için şirket profilinizi doldurun`
        : "Uyum için şirket profilinizi doldurun",
    });
  }

  return results;
}
