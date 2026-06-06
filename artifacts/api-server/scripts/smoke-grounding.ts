import { db, tendersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  analyzeTender,
  chatWithDocuments,
  resolveGrounding,
  type TenderGroundingInput,
} from "../src/services/document-analyzer.js";

/**
 * Cross-source grounding smoke test (Task #71 acceptance check).
 *
 * For one tender per source_system, runs the full analyzer grounding chain and a
 * chat turn, then asserts that NEITHER ever returns the refusal string
 * ("Bu bilgi mevcut belgelerde bulunamadı" / "no documents found" / "doküman
 * bulunamadı") and that a structured summary with a grounding source is always
 * produced.
 *
 * Exit code is non-zero if any source returns a refusal or empty summary, so
 * this can run as a CI/validation gate.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/smoke-grounding.ts
 */
const REFUSAL_RE =
  /(bu bilgi mevcut belgelerde bulunamad|belgelerde bulunamad|doküman(?:lar)? bulunamad|no documents? (?:were )?found|belge bulunamad)/i;

function toGroundingInput(
  tender: typeof tendersTable.$inferSelect,
): TenderGroundingInput {
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
    documents:
      (tender.documents as Array<{ name: string; url: string; type: string }> | null) ?? [],
    rawData: (tender.rawData as Record<string, unknown>) ?? {},
  };
}

async function main() {
  const sourceRows = await db
    .selectDistinct({ source: tendersTable.sourceSystem })
    .from(tendersTable);
  const sources = sourceRows.map((r) => r.source).filter(Boolean) as string[];

  let failures = 0;
  for (const source of sources) {
    const [tender] = await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.sourceSystem, source))
      .limit(1);
    if (!tender) {
      console.log(`SKIP  ${source}: no tenders`);
      continue;
    }

    const input = toGroundingInput(tender);
    try {
      const result = await analyzeTender(input);
      const summary = (result.analysis.summary ?? "").trim();
      const analyzeRefused = REFUSAL_RE.test(summary);
      const summaryEmpty = summary.length === 0;

      const grounding = await resolveGrounding(input);
      const answer = await chatWithDocuments({
        tenderTitle: input.title,
        agencyName: input.agencyName ?? undefined,
        docText: grounding.text,
        groundingSource: grounding.source,
        question: "Bu ihalenin konusu ve son başvuru tarihi nedir?",
        history: [],
      });
      const chatRefused = REFUSAL_RE.test(answer ?? "");

      const ok = !analyzeRefused && !summaryEmpty && !chatRefused;
      if (!ok) failures++;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${source.padEnd(10)} ` +
          `grounding=${result.groundingSource}/${result.confidence} ` +
          `summaryLen=${summary.length} ` +
          `${analyzeRefused ? "[ANALYZE-REFUSAL] " : ""}` +
          `${summaryEmpty ? "[EMPTY-SUMMARY] " : ""}` +
          `${chatRefused ? "[CHAT-REFUSAL]" : ""}`,
      );
    } catch (err) {
      failures++;
      console.log(`FAIL  ${source}: threw ${String(err)}`);
    }
  }

  console.log(`\n${failures === 0 ? "ALL SOURCES PASS" : `${failures} SOURCE(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
