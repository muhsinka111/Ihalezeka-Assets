import { db, tendersTable } from "@workspace/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";

/**
 * One-time backfill: derive a plain-text `description` for international-source
 * tenders from the text the source API stored in raw_data, so the grounding
 * chain has stored notice text to fall back on (it still prefers the live
 * source page when that yields more).
 *
 * - worldbank: notice_text / bid_description (rich, real notice prose)
 * - ebrd:      title + buyer + noticeType + country (compact notice block)
 * - kit:       title + agency
 * - kosgeb:    title + "KOSGEB Destek Programı"
 * - tubitak:   title + label + "TÜBİTAK Ar-Ge / Destek Programı"
 */
function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function deriveDescription(
  source: string,
  title: string,
  raw: Record<string, unknown>,
): string {
  switch (source) {
    case "worldbank":
      return [s(raw.notice_text), s(raw.bid_description)].filter(Boolean).join("\n\n");
    case "ebrd":
      return [
        s(raw.title) || title,
        s(raw.buyer) && `Alıcı: ${s(raw.buyer)}`,
        s(raw.noticeType) && `İlan türü: ${s(raw.noticeType)}`,
        s(raw.country) && `Ülke: ${s(raw.country)}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "kit":
      return [title, s(raw.agency) && `Kurum: ${s(raw.agency)}`].filter(Boolean).join("\n");
    case "kosgeb":
      return [title, "KOSGEB Destek Programı"].filter(Boolean).join("\n");
    case "tubitak":
      return [
        title,
        s(raw.label) && `Kategori: ${s(raw.label)}`,
        "TÜBİTAK Ar-Ge / Destek Programı",
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return "";
  }
}

async function main() {
  const sources = ["worldbank", "ebrd", "kit", "kosgeb", "tubitak"];

  for (const source of sources) {
    const rows = await db
      .select({
        id: tendersTable.id,
        title: tendersTable.title,
        rawData: tendersTable.rawData,
      })
      .from(tendersTable)
      .where(
        and(
          eq(tendersTable.sourceSystem, source),
          or(isNull(tendersTable.description), eq(tendersTable.description, "")),
        ),
      );

    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const raw = (row.rawData as Record<string, unknown> | null) ?? {};
      const text = deriveDescription(source, row.title ?? "", raw).slice(0, 20_000).trim();
      if (text.length < 12) {
        skipped++;
        continue;
      }
      await db
        .update(tendersTable)
        .set({ description: text })
        .where(eq(tendersTable.id, row.id));
      updated++;
    }

    const [{ count: withDesc }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(
        and(
          eq(tendersTable.sourceSystem, source),
          sql`coalesce(btrim(${tendersTable.description}), '') <> ''`,
        ),
      );

    console.log(
      `${source} backfill: ${updated} updated, ${skipped} skipped, now ${withDesc} with description`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
