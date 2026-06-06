import { Router } from "express";
import { db } from "@workspace/db";
import { tendersTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, or, isNull, sql, type SQL, desc, asc, count } from "drizzle-orm";
import { ListTendersQueryParams, GetTenderParams } from "@workspace/api-zod";
import {
  analyzeDocuments,
  chatWithDocuments,
  extractDocumentsText,
  fetchDocumentBytes,
  extractTextFromDocument,
} from "../services/document-analyzer.js";

const router = Router();

router.get("/tenders", async (req, res) => {
  try {
    const query = ListTendersQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.q) conditions.push(ilike(tendersTable.title, `%${query.q}%`));
    if (query.il) conditions.push(ilike(tendersTable.il, query.il));
    if (query.tur) conditions.push(eq(tendersTable.type, query.tur));
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

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const isDesc = query.sortDir === "desc";
    const sortCol =
      query.sortBy === "estimatedValue" ? tendersTable.estimatedValue :
      query.sortBy === "createdAt" ? tendersTable.createdAt :
      tendersTable.deadline;

    // For deadline sorts: use NULLS LAST on ASC so upcoming deadlines appear
    // first and grant/programme records (no deadline) sink to the bottom.
    // NULLS FIRST on DESC keeps the same sensible ordering.
    const orderClause = query.sortBy === "deadline" || !query.sortBy
      ? isDesc
        ? sql`${sortCol} DESC NULLS FIRST`
        : sql`${sortCol} ASC NULLS LAST`
      : isDesc ? desc(sortCol) : asc(sortCol);

    const [items, totalResult] = await Promise.all([
      db.select().from(tendersTable).where(where).orderBy(orderClause).limit(limit).offset(offset),
      db.select({ total: count() }).from(tendersTable).where(where),
    ]);

    res.json({ items, total: Number(totalResult[0]?.total ?? 0), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenders/:id", async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });
    res.json(tender);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tenders/:id/analyze", async (req, res) => {
  try {
    const { id } = GetTenderParams.parse(req.params);
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
    if (!tender) return res.status(404).json({ error: "Not found" });

    const documents = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];

    const { analysis, docsDownloaded, docsTotal, extractedText } = await analyzeDocuments({
      tenderTitle: tender.title,
      tenderType: tender.type ?? undefined,
      tenderMethod: tender.method ?? undefined,
      agencyName: tender.agencyName ?? undefined,
      documents,
    });

    const existingRawData = (tender.rawData as Record<string, unknown>) ?? {};
    const updatedRawData = {
      ...existingRawData,
      _aiAnalysis: analysis,
      // Persist extracted document text so the document-chat endpoint and
      // repeat analyses do not have to re-download/parse the files.
      ...(extractedText ? { _docText: extractedText } : {}),
    };

    await db
      .update(tendersTable)
      .set({ aiSummary: analysis, rawData: updatedRawData, updatedAt: new Date() })
      .where(eq(tendersTable.id, id));

    res.json({ ok: true, analysis, docsDownloaded, docsTotal });
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
router.get("/tenders/:id/document", async (req, res) => {
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
router.get("/tenders/:id/document-text", async (req, res) => {
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
router.post("/tenders/:id/chat", async (req, res) => {
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

    const rawData = (tender.rawData as Record<string, unknown>) ?? {};
    let docText = typeof rawData._docText === "string" ? (rawData._docText as string) : "";

    if (!docText) {
      const documents = (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [];
      const extracted = await extractDocumentsText(documents, tender.title);
      docText = extracted.text;
      if (docText) {
        await db
          .update(tendersTable)
          .set({ rawData: { ...rawData, _docText: docText }, updatedAt: new Date() })
          .where(eq(tendersTable.id, id));
      }
    }

    const answer = await chatWithDocuments({
      tenderTitle: tender.title,
      agencyName: tender.agencyName ?? undefined,
      docText,
      question: question.trim(),
      history: safeHistory,
    });

    res.json({ answer, hasDocText: docText.length > 0 });
  } catch (err) {
    console.error("Tender chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

export default router;
