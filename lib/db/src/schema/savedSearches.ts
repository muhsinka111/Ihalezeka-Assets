import { pgTable, text, serial, timestamp, integer, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";

/**
 * A user-saved tender search: a named bundle of search criteria (the same
 * filter model used by GET /tenders) plus an alerts toggle. When the daily
 * scrapers ingest new tenders, any tender matching an alert-enabled saved
 * search produces an email digest to the owning business.
 *
 * `criteria` mirrors the tender list filters (q, il, tur, sector, usul, idare,
 * minBedel, maxBedel, durum, deadlineFrom, deadlineTo, source, category). It is
 * stored as JSON so the filter model can evolve without a migration.
 */
export const savedSearchesTable = pgTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    businessId: text("business_id").notNull(),
    name: text("name").notNull(),
    criteria: jsonb("criteria").notNull().$type<Record<string, unknown>>(),
    alertsEnabled: boolean("alerts_enabled").notNull().default(true),
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("saved_searches_business_idx").on(t.businessId)],
);

/**
 * Dedup ledger: one row per (saved search, tender) that has already been
 * alerted. The unique constraint lets the dispatcher insert-on-conflict-do-
 * nothing and treat the freshly inserted rows as the only ones to email,
 * guaranteeing a tender is alerted at most once per saved search.
 */
export const savedSearchAlertsTable = pgTable(
  "saved_search_alerts",
  {
    id: serial("id").primaryKey(),
    savedSearchId: integer("saved_search_id")
      .notNull()
      .references(() => savedSearchesTable.id, { onDelete: "cascade" }),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tendersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_search_alerts_unique").on(t.savedSearchId, t.tenderId)],
);

export const insertSavedSearchSchema = createInsertSchema(savedSearchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearchesTable.$inferSelect;

export type SavedSearchAlert = typeof savedSearchAlertsTable.$inferSelect;
