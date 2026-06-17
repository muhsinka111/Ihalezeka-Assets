import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";

export const awardResultsTable = pgTable("award_results", {
  id: serial("id").primaryKey(),
  ikn: text("ikn").notNull().unique(),
  originalIkn: text("original_ikn"),
  awardedCompany: text("awarded_company"),
  awardedPrice: real("awarded_price"),
  bidderCount: integer("bidder_count"),
  estimatedValue: real("estimated_value"),
  awardDate: timestamp("award_date", { withTimezone: true }),
  category: text("category"),
  il: text("il"),
  agencyName: text("agency_name"),
  rawText: text("raw_text"),
  sourceSystem: text("source_system").notNull().default("ekap"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AwardResult = typeof awardResultsTable.$inferSelect;
export type InsertAwardResult = typeof awardResultsTable.$inferInsert;
