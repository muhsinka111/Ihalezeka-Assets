import type { Request } from "express";

/**
 * Returns the businessId to scope all queries against.
 *
 * Currently returns "demo-business" to match every other route in this
 * codebase (companyProfile, matches, pipeline, dashboard, etc.). All data —
 * company profiles, matches, notifications — lives under this single tenant.
 *
 * When a full cross-route auth migration happens (mapping Clerk userId →
 * businessId for every route and backfilling existing data), this helper
 * is the single place to update.
 */
export function getBusinessId(_req: Request): string {
  return "demo-business";
}
