import type { TenderContact } from "@workspace/db";

/**
 * Derive a structured tender contact from data already harvested by the
 * scrapers — NO network calls. Used both at ingest (mapEkapToTender /
 * mapIlanToTender) and by the one-off backfill so the detail page can show a
 * populated contact block immediately, without waiting for a live MCP lookup.
 *
 * Honest by design: a field is filled only when it can be read from a
 * structured raw-data key or matched conservatively in the notice text.
 * Anything uncertain is left null rather than guessed. Returns null when not a
 * single field could be derived.
 */

// Turkish phone shape: optional +90 or leading 0, 3-digit area code, then 3-2-2.
const PHONE_RE = /(?:\+90[\s.\-]?|0)\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function normalizePhone(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Find a phone-shaped number within 50 chars after a labelling keyword. */
function phoneNearKeyword(text: string, keyword: RegExp): string | null {
  const idx = text.search(keyword);
  if (idx < 0) return null;
  const scope = text.slice(idx, idx + 50);
  const m = scope.match(PHONE_RE);
  return m ? normalizePhone(m[0]) : null;
}

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

export function deriveContact(input: {
  agencyName?: string | null;
  description?: string | null;
  rawData?: Record<string, unknown> | null;
}): TenderContact | null {
  const raw = input.rawData ?? {};
  const text = input.description ?? "";

  const authority = pickString(raw.idareAdi, raw.advertiserName, input.agencyName);
  const address = pickString(raw.adres, raw.addressCityName);
  const contactPerson = pickString(raw.irtibatKisi, raw.yetkiliKisi);

  // Structured raw keys win; otherwise extract conservatively from notice text.
  // Fax is keyword-scoped only (never a bare global match) so a phone number is
  // never mislabelled as a fax.
  const fax = pickString(raw.faks) ?? phoneNearKeyword(text, /faks?|fax/i);
  const phone =
    pickString(raw.telefon) ?? phoneNearKeyword(text, /tel(?:efon)?/i);
  const email = pickString(raw.eposta) ?? extractEmail(text);

  const contact: TenderContact = { authority, address, phone, fax, email, contactPerson };
  const hasAny = Object.values(contact).some((v) => v != null);
  return hasAny ? contact : null;
}
