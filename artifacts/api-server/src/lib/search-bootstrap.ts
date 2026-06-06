import { pool } from "@workspace/db";
import { logger } from "./logger";

// Tracks whether the trigram/unaccent search objects are available. When false
// (e.g. the DB role can't create extensions), the search route falls back to a
// plain multi-field ILIKE so text search degrades gracefully instead of 500ing.
let fuzzySearchReady = false;

export function isFuzzySearchReady(): boolean {
  return fuzzySearchReady;
}

/**
 * Ensures the Postgres-native search objects used by tender full-text search
 * exist. Idempotent and safe to run on every startup, in both dev and prod:
 *
 *  - pg_trgm  -> trigram similarity / fuzzy (typo & accent-variant) matching
 *  - unaccent -> strips Turkish diacritics (İ, ş, ç, ö, ü, ğ, ı) so accent
 *                variants match
 *  - f_unaccent(text) -> IMMUTABLE wrapper around unaccent so it can be used
 *                in expression indexes and query expressions
 *  - trigram GIN indexes on the commonly searched/filtered text columns
 */
export async function ensureSearchObjects(): Promise<void> {
  const statements = [
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    `CREATE EXTENSION IF NOT EXISTS unaccent`,
    `CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
       LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
       $func$ SELECT public.unaccent('public.unaccent', $1) $func$`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_title_trgm
       ON tenders USING gin (f_unaccent(lower(title)) gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_agency_trgm
       ON tenders USING gin (f_unaccent(lower(agency_name)) gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_il_trgm
       ON tenders USING gin (f_unaccent(lower(il)) gin_trgm_ops)`,
    // B-tree indexes backing the structured filter dimensions (type, category,
    // source, status) and the range/sort columns (estimated value, deadline).
    // Keeps combined filtering fast as the dataset grows beyond a seq-scan-cheap
    // size. All are idempotent.
    `CREATE INDEX IF NOT EXISTS idx_tenders_type ON tenders (type)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_category ON tenders (category)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_source_system ON tenders (source_system)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders (status)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_estimated_value ON tenders (estimated_value)`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders (deadline)`,
  ];

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  fuzzySearchReady = true;
  logger.info("Fuzzy search ready (pg_trgm + unaccent available)");
}
