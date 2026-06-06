import { sql, type SQL } from "drizzle-orm";
import { tendersTable } from "@workspace/db";

/**
 * A human-friendly industry/sector grouping for tenders.
 *
 * The Turkish public-procurement data has almost no CPV codes populated
 * (~8 of 8k rows), so the formal CPV classification is unusable as the primary
 * signal. Instead each sector is matched primarily by distinctive keywords
 * against the (accent-folded, lower-cased) tender title, with CPV-division
 * prefixes used as a bonus signal when codes do exist.
 *
 * Keywords MUST be written already accent-folded + lower-cased (ascii) so they
 * line up with the `f_unaccent(lower(title))` expression that the trigram GIN
 * index is built on — that lets the keyword ILIKEs use the index.
 */
export interface SectorDef {
  id: string;
  label: string;
  keywords: string[];
  cpvPrefixes: string[];
}

export const SECTORS: SectorDef[] = [
  {
    id: "insaat",
    label: "İnşaat & Yapı",
    keywords: [
      "insaat", "yapim", "beton", "asfalt", " yol", "bina", "onarim", "tadilat",
      "cati", "kanalizasyon", "altyapi", "kazi", "restorasyon", "duvar",
      "kaldirim", "kopru", "ihata", "yapi isleri", "yapim isi",
    ],
    cpvPrefixes: ["45"],
  },
  {
    id: "saglik",
    label: "Sağlık & Medikal",
    keywords: [
      "tibbi", "medikal", "ilac", "saglik", "hastane", "sarf malzeme",
      "ameliyat", "anestezi", " dis ", "laboratuvar", "goruntuleme", "protez",
      "reaktif", " kan ", "serum", "eczane", "diyaliz", "ortez",
    ],
    cpvPrefixes: ["33"],
  },
  {
    id: "gida",
    label: "Gıda & Yemek",
    keywords: [
      "gida", "yemek", " et ", "sebze", "meyve", "ekmek", " sut", "catering",
      "mutfak", "tavuk", "balik", "pasta", "kuru gida", "yas sebze", "donuk",
      "beslenme",
    ],
    cpvPrefixes: ["15", "55"],
  },
  {
    id: "bilisim",
    label: "Bilişim & Teknoloji",
    keywords: [
      "yazilim", "donanim", "bilgisayar", "network", "lisans", "sunucu",
      "server", "yazici", "bilisim", " veri ", "siber", "bilgi sistem",
      "otomasyon", "data center", "veri merkezi",
    ],
    cpvPrefixes: ["48", "72"],
  },
  {
    id: "ulasim",
    label: "Ulaşım & Araç",
    keywords: [
      " arac ", "otobus", "tasima", "ulasim", "nakliye", "akaryakit", " yakit",
      "lastik", "minibus", "kamyon", "filo", "surucu", "personel tasima",
      "ogrenci tasima",
    ],
    cpvPrefixes: ["34", "60"],
  },
  {
    id: "temizlik",
    label: "Temizlik & Hijyen",
    keywords: ["temizlik", "hijyen", "deterjan", "ilaclama", "haserat"],
    cpvPrefixes: ["90"],
  },
  {
    id: "guvenlik",
    label: "Güvenlik",
    keywords: [
      "guvenlik", "kamera", "alarm", "koruma", "ozel guvenlik", "kgys",
      "plaka tanima",
    ],
    cpvPrefixes: ["79710", "35"],
  },
  {
    id: "enerji",
    label: "Enerji & Elektrik",
    keywords: [
      "elektrik", "enerji", "dogalgaz", "jenerator", "trafo", "aydinlatma",
      " kablo", "solar", "gunes enerji", "kojenerasyon", " enh", "tesisat",
    ],
    cpvPrefixes: ["09", "31", "71314"],
  },
  {
    id: "egitim",
    label: "Eğitim",
    keywords: [
      "egitim", " okul", " kurs", "ogrenci", " kitap", "kirtasiye", "ders",
      "akademi", "seminer",
    ],
    cpvPrefixes: ["80"],
  },
  {
    id: "mobilya",
    label: "Mobilya & Donatım",
    keywords: [
      "mobilya", " masa", "sandalye", "koltuk", " dolap", " buro", "donatim",
      "okul sirasi", "raf ",
    ],
    cpvPrefixes: ["39"],
  },
  {
    id: "tekstil",
    label: "Tekstil & Giyim",
    keywords: [
      "tekstil", "giyim", "kiyafet", "kumas", "uniforma", "ayakkabi",
      "is elbise", "personel giyim",
    ],
    cpvPrefixes: ["18"],
  },
  {
    id: "tarim",
    label: "Tarım & Orman",
    keywords: [
      "tarim", "orman", "fidan", "gubre", "tohum", "hayvan", "zirai",
      "sulama", "yem ", "agaclandirma", "peyzaj",
    ],
    cpvPrefixes: ["03", "77"],
  },
];

/**
 * Build a SQL predicate matching tenders that belong to the given sector.
 * Returns null for an unknown sector id (the caller should then ignore the
 * filter rather than returning zero rows).
 *
 * Keyword matches run against `f_unaccent(lower(title))` so they reuse the
 * trigram GIN index; CPV-prefix matches scan the (tiny) populated cpv arrays.
 * All literals are bound parameters, so there is no SQL-injection surface.
 */
export function buildSectorCondition(sectorId: string): SQL | null {
  const sector = SECTORS.find((s) => s.id === sectorId);
  if (!sector) return null;

  const nTitle = sql`f_unaccent(lower(coalesce(${tendersTable.title}, '')))`;
  const parts: SQL[] = [];

  for (const kw of sector.keywords) {
    parts.push(sql`${nTitle} like ${`%${kw}%`}`);
  }
  for (const prefix of sector.cpvPrefixes) {
    parts.push(
      sql`exists (select 1 from unnest(${tendersTable.cpvCodes}) c where c like ${`${prefix}%`})`,
    );
  }

  if (parts.length === 0) return null;
  return sql`(${sql.join(parts, sql` or `)})`;
}

/**
 * Canonical procurement-type groups. The underlying `type` column is messy and
 * source-dependent ("Mal", "Mal Alımı", "Hizmet", "Yapım", "Yapım İşleri",
 * "Danışmanlık" …), so an exact match is useless. The UI sends a stable key
 * and we translate it into a forgiving accent-folded prefix match.
 */
export const TYPE_GROUPS: Array<{ key: string; label: string; prefixes: string[] }> = [
  { key: "mal", label: "Mal Alımı", prefixes: ["mal"] },
  { key: "hizmet", label: "Hizmet Alımı", prefixes: ["hizmet"] },
  { key: "yapim", label: "Yapım İşleri", prefixes: ["yap"] },
  { key: "danismanlik", label: "Danışmanlık", prefixes: ["danis"] },
];

/**
 * Build a SQL predicate for a procurement-type filter value. Known canonical
 * keys map to accent-folded prefix matches; any other value falls back to a
 * forgiving "contains" match so legacy/bookmarked values still work.
 */
export function buildTypeCondition(turValue: string): SQL | null {
  const value = turValue.trim();
  if (!value) return null;

  const nType = sql`f_unaccent(lower(coalesce(${tendersTable.type}, '')))`;
  const group = TYPE_GROUPS.find((g) => g.key === value);

  if (group) {
    const parts = group.prefixes.map((p) => sql`${nType} like ${`${p}%`}`);
    return sql`(${sql.join(parts, sql` or `)})`;
  }

  // Legacy / free-text fallback: accent-fold BOTH sides so Turkish diacritics
  // and dotless-i in bookmarked values still match the stored type.
  return sql`${nType} like ('%' || f_unaccent(lower(${value})) || '%')`;
}
