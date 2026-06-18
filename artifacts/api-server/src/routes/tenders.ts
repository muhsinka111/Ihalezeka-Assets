import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, or, isNull, sql, type SQL, desc, asc, count, getTableColumns } from "drizzle-orm";
import { ListTendersQueryParams, GetTenderParams } from "@workspace/api-zod";
import { isFuzzySearchReady } from "../lib/search-bootstrap.js";
import { SECTORS, buildSectorCondition, buildTypeCondition } from "../lib/tender-filters.js";
import {
  analyzeTender,
  chatWithDocuments,
  resolveGrounding,
  fetchDocumentBytes,
  extractTextFromDocument,
  type TenderGroundingInput,
} from "../services/document-analyzer.js";
import { searchEkapByKeyword } from "../scrapers/ekap-client.js";
import { searchIlanByKeyword } from "../scrapers/ilan-client.js";
import { mapEkapToTender, mapIlanToTender } from "../scrapers/utils.js";
import { getTenderAnnouncementsViaMcp, getTenderDetailsViaMcp } from "../scrapers/ihalemcp-client.js";
import { isPro, requirePro, requireAuth, maskTenderForFree, consumeCredit } from "../lib/authHelpers.js";

const router = Router();

/** Map a tender row to the grounding-chain input the analyzer/chat expect. */
function toGroundingInput(tender: typeof tendersTable.$inferSelect): TenderGroundingInput {
  return {
    title: tender.title,
    type: tender.type,
    method: tender.method,
    agencyName: tender.agencyName,
    il: tender.il,
    category: tender.category,
    cpvCodes: tender.cpvCodes,
    estimatedValue: tender.estimatedValue,
    deadline: tender.deadline,
    description: tender.description,
    sourceSystem: tender.sourceSystem,
    sourceUrl: tender.sourceUrl,
    documents: (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [],
    rawData: (tender.rawData as Record<string, unknown>) ?? {},
  };
}

export type ListQuery = ReturnType<typeof ListTendersQueryParams.parse>;

/**
 * Build the SQL predicates shared by the list and facet endpoints, plus the
 * optional relevance expression used when a text query is present.
 *
 * `excludeSector` lets the facet endpoint compute per-sector counts using all
 * the OTHER active filters — the standard faceted-search behaviour where a
 * dimension's own selection does not constrain its own counts.
 */
export function buildTenderConditions(
  query: ListQuery,
  opts: { excludeSector?: boolean } = {},
): { conditions: SQL[]; relevanceExpr: SQL | null } {
  const conditions: SQL[] = [];

  // ── Smarter text search ──────────────────────────────────────────────
  // Spans title, description, agency name and CPV codes. Everything is
  // normalised with f_unaccent(lower(...)) so Turkish case/accent variants
  // (İ↔i, ş↔s, ç↔c, ö↔o, ü↔u, ğ↔g, ı↔i) match. A row matches when the query
  // is a substring OR has a high enough trigram word-similarity (typo
  // tolerance). Relevance blends the fuzzy score with field-weighted boosts.
  const q = query.q?.trim();
  let relevanceExpr: SQL | null = null;
  if (q && isFuzzySearchReady()) {
    const searchable = sql`(coalesce(${tendersTable.title}, '') || ' ' || coalesce(${tendersTable.description}, '') || ' ' || coalesce(${tendersTable.agencyName}, '') || ' ' || array_to_string(${tendersTable.cpvCodes}, ' '))`;
    const nq = sql`f_unaccent(lower(${q}))`;
    const nSearch = sql`f_unaccent(lower(${searchable}))`;
    const nTitle = sql`f_unaccent(lower(coalesce(${tendersTable.title}, '')))`;
    const nAgency = sql`f_unaccent(lower(coalesce(${tendersTable.agencyName}, '')))`;
    const like = sql`('%' || ${nq} || '%')`;
    conditions.push(sql`(${nSearch} like ${like} or word_similarity(${nq}, ${nSearch}) > 0.3)`);
    relevanceExpr = sql`(
      word_similarity(${nq}, ${nSearch})
      + case when ${nTitle} like ${like} then 0.5 else 0 end
      + case when ${nAgency} like ${like} then 0.2 else 0 end
    )::float8`;
  } else if (q) {
    // Degraded fallback when trigram/unaccent objects aren't available:
    // still search across multiple fields (case-insensitive), just without
    // accent folding, fuzzy tolerance, or a relevance score.
    const likeVal = `%${q}%`;
    conditions.push(
      or(
        ilike(tendersTable.title, likeVal),
        ilike(tendersTable.description, likeVal),
        ilike(tendersTable.agencyName, likeVal),
      )!,
    );
  }

  if (query.il) conditions.push(ilike(tendersTable.il, query.il));
  // `type` is messy and source-dependent, so map friendly keys to forgiving
  // accent-folded prefix matches instead of an exact equality.
  if (query.tur) {
    const typeCond = buildTypeCondition(query.tur);
    if (typeCond) conditions.push(typeCond);
  }
  // Industry/sector grouping derived from title keywords (+ CPV when present).
  if (!opts.excludeSector && query.sector) {
    const sectorCond = buildSectorCondition(query.sector);
    if (sectorCond) conditions.push(sectorCond);
  }
  if (query.usul) conditions.push(eq(tendersTable.method, query.usul));
  if (query.idare) conditions.push(ilike(tendersTable.agencyName, `%${query.idare}%`));
  if (query.minBedel) conditions.push(gte(tendersTable.estimatedValue, query.minBedel));
  if (query.maxBedel) conditions.push(lte(tendersTable.estimatedValue, query.maxBedel));
  if (query.source) conditions.push(eq(tendersTable.sourceSystem, query.source));
  if (query.category) conditions.push(eq(tendersTable.category, query.category));
  if (query.durum) conditions.push(eq(tendersTable.status, query.durum));
  if (query.deadlineFrom) {
    // Include tenders with deadline >= date AND tenders with no deadline set
    conditions.push(
      or(gte(tendersTable.deadline, new Date(query.deadlineFrom)), isNull(tendersTable.deadline))!
    );
  }
  if (query.deadlineTo) {
    const endOfDay = new Date(query.deadlineTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(tendersTable.deadline, endOfDay));
  }

  return { conditions, relevanceExpr };
}

/**
 * Faceted counts for the sector dimension. Honours every active filter EXCEPT
 * sector so the user sees how many tenders fall into each industry given their
 * other choices. One scan with per-sector conditional aggregates.
 */
router.get("/tenders/facets", async (req, res) => {
  try {
    const query = ListTendersQueryParams.parse(req.query);
    const { conditions } = buildTenderConditions(query, { excludeSector: true });
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sectorCounts = SECTORS.map((s) => {
      const cond = buildSectorCondition(s.id);
      // cond is always non-null for a real sector id, but guard for safety.
      return sql`count(*) filter (where ${cond ?? sql`false`})::int as ${sql.raw(`"sector_${s.id}"`)}`;
    });

    const selection = sql.join([sql`count(*)::int as "total"`, ...sectorCounts], sql`, `);
    const result = await db.execute(
      sql`select ${selection} from ${tendersTable}${where ? sql` where ${where}` : sql``}`,
    );
    const row = (result.rows?.[0] ?? {}) as Record<string, number>;

    const sectors = SECTORS.map((s) => ({
      id: s.id,
      label: s.label,
      count: Number(row[`sector_${s.id}`] ?? 0),
    }));

    res.json({ total: Number(row.total ?? 0), sectors });
  } catch (err) {
    console.error("Tender facets error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenders", async (req, res) => {
  try {
    const query = ListTendersQueryParams.parse(req.query);
    const { conditions, relevanceExpr } = buildTenderConditions(query);

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const isDesc = query.sortDir === "desc";
    // Default to relevance ordering when a text query is present and the user
    // hasn't explicitly chosen a different column (or picked "relevance").
    const useRelevance = !!relevanceExpr && (!query.sortBy || query.sortBy === "relevance");
    const sortCol =
      query.sortBy === "estimatedValue" ? tendersTable.estimatedValue :
      query.sortBy === "createdAt" ? tendersTable.createdAt :
      tendersTable.deadline;

    // For deadline sorts: use NULLS LAST on ASC so upcoming deadlines appear
    // first and grant/programme records (no deadline) sink to the bottom.
    // NULLS FIRST on DESC keeps the same sensible ordering.
    let orderClause: SQL;
    if (useRelevance && relevanceExpr) {
      // Best matches first; break ties by soonest deadline.
      orderClause = sql`${relevanceExpr} DESC, ${tendersTable.deadline} ASC NULLS LAST`;
    } else if (query.sortBy === "deadline" || !query.sortBy || query.sortBy === "relevance") {
      orderClause = isDesc
        ? sql`${sortCol} DESC NULLS FIRST`
        : sql`${sortCol} ASC NULLS LAST`;
    } else {
      orderClause = isDesc ? desc(sortCol) : asc(sortCol);
    }

    // Surface the relevance score on each item when a text query was used so
    // the UI can indicate match quality.
    const selection = relevanceExpr
      ? { ...getTableColumns(tendersTable), relevance: relevanceExpr }
      : getTableColumns(tendersTable);

    const [items, totalResult] = await Promise.all([
      db.select(selection).from(tendersTable).where(where).orderBy(orderClause).limit(limit).offset(offset),
      db.select({ total: count() }).from(tendersTable).where(where),
    ]);

    // Free tier: project each row through the allowlist so premium fields
    // (full description, rawData, contact, etc.) never reach the client.
    const pro = await isPro(req);
    const projected = pro ? items : items.map((t) => maskTenderForFree(t));

    res.json({ items: projected, total: Number(totalResult[0]?.total ?? 0), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Live real-time search — fans out to EKAP v2 API and İlan.gov.tr in parallel
 * without any date restriction, surfacing the full 50K+ EKAP catalogue.
 * Results are ephemeral (not stored) and tagged with `_isLive: true`.
 *
 * GET /api/tenders/live-search?q=...&skip=0&take=20&source=ekap|ilan|all
 */
router.get("/tenders/live-search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ items: [], ekapTotal: 0, ilanTotal: 0 });

  const skip = Math.max(0, Number(req.query.skip ?? 0));
  const take = Math.min(50, Math.max(1, Number(req.query.take ?? 20)));
  const source = String(req.query.source ?? "all");

  try {
    const [ekapResult, ilanResult] = await Promise.allSettled([
      source === "ilan"
        ? Promise.resolve({ list: [] as any[], totalCount: 0 })
        : searchEkapByKeyword(q, skip, take),
      source === "ekap"
        ? Promise.resolve({ ads: [] as any[], numFound: 0 })
        : searchIlanByKeyword(q, skip, take),
    ]);

    // Free-tier endpoint: only ever serialize allowlisted, non-premium fields
    // below (no description/contact/documents/rawData). Keep this in sync with
    // maskTenderForFree() so live results never leak Pro-only data.
    const items: Record<string, unknown>[] = [];

    if (ekapResult.status === "fulfilled") {
      for (const tender of ekapResult.value.list) {
        const mapped = mapEkapToTender(tender);
        items.push({
          id: `live-ekap-${tender.id}`,
          ikn: mapped.ikn,
          title: mapped.title,
          agencyName: mapped.agencyName,
          il: mapped.il,
          deadline: mapped.deadline?.toISOString() ?? null,
          type: mapped.type,
          method: mapped.method,
          status: mapped.status,
          sourceSystem: "ekap",
          sourceUrl: mapped.ikn
            ? `https://ekapv2.kik.gov.tr/ekap/detay/${mapped.ikn}`
            : `https://ekapv2.kik.gov.tr/ekap/ihale-detay/${tender.id}`,
          estimatedValue: mapped.estimatedValue,
          category: "ihale",
          _isLive: true,
        });
      }
    } else {
      console.error("EKAP live search error:", ekapResult.reason);
    }

    if (ilanResult.status === "fulfilled") {
      for (const ad of ilanResult.value.ads) {
        const mapped = mapIlanToTender(ad);
        items.push({
          id: `live-ilan-${ad.id}`,
          ikn: mapped.ikn,
          title: mapped.title,
          agencyName: mapped.agencyName,
          il: mapped.il,
          deadline: mapped.deadline?.toISOString() ?? null,
          type: mapped.type,
          method: mapped.method,
          status: "active",
          sourceSystem: "ilan_gov",
          sourceUrl: mapped.sourceUrl,
          estimatedValue: mapped.estimatedValue,
          category: "ihale",
          _isLive: true,
        });
      }
    } else {
      console.error("İlan live search error:", ilanResult.reason);
    }

    const ekapTotal = ekapResult.status === "fulfilled" ? ekapResult.value.totalCount : 0;
    const ilanTotal = ilanResult.status === "fulfilled" ? ilanResult.value.numFound : 0;

    res.json({ items, ekapTotal, ilanTotal });
  } catch (err) {
    console.error("Live search error:", err);
    res.status(500).json({ error: "Live search failed", items: [], ekapTotal: 0, ilanTotal: 0 });
  }
});

router.get("/tenders/:id", async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    // Ensure EKAP tenders always have at least the portal URL as a document entry.
    // This covers the 77% of tenders whose documents array was never populated by
    // the enrichment scraper. The portal URL opens EKAP's own document page in the
    // user's browser — it works correctly there even though headless download is
    // blocked by the anti-bot gate.
    const storedDocs = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];
    if (storedDocs.length === 0 && tender.sourceSystem === "ekap" && tender.ikn) {
      const portalUrl = tender.sourceUrl ?? `https://ekapv2.kik.gov.tr/ekap/detay/${tender.ikn}`;
      const injected = { ...tender, documents: [{ name: "İhale Dokümanı (EKAP Portal)", url: portalUrl, type: "ekap-portal" }] };
      const pro = await isPro(req);
      return res.json(pro ? injected : maskTenderForFree(injected));
    }

    // Free tier gets the allowlisted basic summary; Pro gets the full row.
    const pro = await isPro(req);
    res.json(pro ? tender : maskTenderForFree(tender));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tenders/:id/analyze", requireAuth, async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    const credit = await consumeCredit(req);
    if (!credit.ok) {
      return res.status(402).json({ error: "credits_exhausted", message: "Ücretsiz analiz hakkınız bitti. Pro'ya geçerek sınırsız erişim edinin." });
    }

    const { analysis, docsDownloaded, docsTotal, extractedText, groundingSource, confidence } =
      await analyzeTender(toGroundingInput(tender));

    const existingRawData = (tender.rawData as Record<string, unknown>) ?? {};
    const updatedRawData = {
      ...existingRawData,
      _aiAnalysis: analysis,
      // Persist extracted document text ONLY when it really came from attachments —
      // persisting notice/page text here would make the grounding chain later
      // mislabel it as "document". extractedText is empty for non-document sources.
      // _docTextSource is a provenance marker the chain requires before trusting it.
      ...(extractedText ? { _docText: extractedText, _docTextSource: "document" } : {}),
    };

    await db
      .update(tendersTable)
      .set({ aiSummary: analysis, rawData: updatedRawData, updatedAt: new Date() })
      .where(eq(tendersTable.id, id));

    res.json({ ok: true, analysis, docsDownloaded, docsTotal, groundingSource, confidence });
  } catch (err) {
    console.error("Tender analyze error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

/**
 * Proxy a single tender document's bytes through the backend so the in-app
 * viewer can render it (the browser cannot reach EKAP gov URLs directly, and
 * the backend reuses the EKAP TLS-fallback download path). The document is
 * addressed by its index in the tender's stored `documents` array — arbitrary
 * URLs are NOT accepted, which avoids SSRF.
 */
router.get("/tenders/:id/document", requirePro, async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const index = Number.parseInt(String(req.query.i ?? ""), 10);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid document index" });
    }

    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    const documents = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];
    const doc = documents[index];
    if (!doc?.url) return res.status(404).json({ error: "Document not found" });

    const buffer = await fetchDocumentBytes(doc.url);
    if (!buffer || buffer.length === 0) {
      return res.status(502).json({ error: "Document could not be downloaded" });
    }

    const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    const contentType = isPdf
      ? "application/pdf"
      : /docx/i.test(`${doc.type} ${doc.name}`)
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : /\.doc$|word/i.test(`${doc.type} ${doc.name}`)
          ? "application/msword"
          : "application/octet-stream";

    const safeName = (doc.name || `belge-${index}`).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  } catch (err) {
    console.error("Tender document proxy error:", err);
    res.status(500).json({ error: "Document fetch failed" });
  }
});

/**
 * Return extracted plain text for a single tender document. Used by the in-app
 * viewer to display Word/other documents that the browser cannot render inline.
 */
router.get("/tenders/:id/document-text", requirePro, async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const index = Number.parseInt(String(req.query.i ?? ""), 10);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid document index" });
    }

    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    const documents = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];
    const doc = documents[index];
    if (!doc?.url) return res.status(404).json({ error: "Document not found" });

    const buffer = await fetchDocumentBytes(doc.url);
    if (!buffer || buffer.length === 0) {
      return res.status(502).json({ error: "Document could not be downloaded" });
    }

    const text = await extractTextFromDocument(buffer, doc.type ?? "", doc.name ?? "");
    res.json({ name: doc.name, text: text.trim().slice(0, 60_000) });
  } catch (err) {
    console.error("Tender document text error:", err);
    res.status(500).json({ error: "Document text extraction failed" });
  }
});

/**
 * Answer a free-form question grounded in a tender's document text. Uses the
 * persisted extracted text when available; otherwise extracts on the fly and
 * persists it for next time.
 */
router.post("/tenders/:id/chat", requirePro, async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const { question, history } = (req.body ?? {}) as {
      question?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "question is required" });
    }

    // Sanitize history: only allow user/assistant turns with string content,
    // capped in count and length. Prevents prompt injection via spoofed
    // "system" roles weakening the grounded-only policy.
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter(
        (h): h is { role: "user" | "assistant"; content: string } =>
          !!h &&
          (h.role === "user" || h.role === "assistant") &&
          typeof h.content === "string",
      )
      .slice(-6)
      .map((h) => ({ role: h.role, content: h.content.slice(0, 4000) }));

    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    // Ground the chat in the same mandatory chain the analyzer uses, so the
    // assistant always has at least the tender metadata to answer from and
    // never claims "no documents found".
    const grounding = await resolveGrounding(toGroundingInput(tender));

    // Cache real attachment text for reuse; never persist notice/page text as
    // _docText (it would later be mislabelled as a document by the chain).
    if (grounding.source === "document" && grounding.text) {
      const rawData = (tender.rawData as Record<string, unknown>) ?? {};
      if (rawData._docText !== grounding.text) {
        await db
          .update(tendersTable)
          .set({
            rawData: { ...rawData, _docText: grounding.text, _docTextSource: "document" },
            updatedAt: new Date(),
          })
          .where(eq(tendersTable.id, id));
      }
    }

    const answer = await chatWithDocuments({
      tenderTitle: tender.title,
      agencyName: tender.agencyName ?? undefined,
      docText: grounding.text,
      groundingSource: grounding.source,
      question: question.trim(),
      history: safeHistory,
    });

    res.json({ answer, hasDocText: grounding.text.length > 0, groundingSource: grounding.source });
  } catch (err) {
    console.error("Tender chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

/**
 * Fetch live MCP announcement text + structured contact details for a tender.
 * Uses MCP get_tender_announcements + get_tender_details (by IKN) and falls
 * back to whatever is already stored in the DB. Cached for 10 min via headers.
 */
router.get("/tenders/:id/mcp-enrichment", requirePro, async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
    if (!tender) return res.status(404).json({ error: "Not found" });

    const ikn = tender.ikn ?? "";
    let announcement = tender.description ?? "";
    let details: Record<string, unknown> = {};

    if (ikn) {
      const [mcpText, mcpDetails] = await Promise.all([
        getTenderAnnouncementsViaMcp(ikn).catch(() => ""),
        getTenderDetailsViaMcp(ikn).catch(() => ({})),
      ]);
      // Discard if MCP returned an error JSON string (EKAP upstream failure)
      if (mcpText.length > 50 && !mcpText.trimStart().startsWith("{")) announcement = mcpText;
      if (Object.keys(mcpDetails).length > 0) details = mcpDetails as Record<string, unknown>;
    }

    const d = details;
    const stored = (tender.contact as Record<string, unknown> | null) ?? {};
    const pick = (...vals: unknown[]) =>
      (vals.find((v) => typeof v === "string" && (v as string).trim().length > 0) as string)?.trim() ?? null;

    // Live MCP details are richest; fall back to the persisted contact column
    // (populated at ingest / backfill) and finally the tender's agency name.
    const contact = {
      authority: pick(d.idareAdi, stored.authority, tender.agencyName),
      address: pick(d.adres, stored.address),
      phone: pick(d.telefon, stored.phone),
      fax: pick(d.faks, stored.fax),
      email: pick(d.eposta, stored.email),
      contactPerson: pick(d.irtibatKisi, stored.contactPerson),
      sourceUrl: tender.sourceUrl ?? null,
    };

    res.setHeader("Cache-Control", "private, max-age=600");
    res.json({ ikn, announcement, contact, details });
  } catch (err) {
    console.error("MCP enrichment error:", err);
    res.status(500).json({ error: "MCP enrichment failed" });
  }
});

export default router;
