import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";

export const scraperRunsTable = pgTable("scraper_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  recordsFetched: integer("records_fetched").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  errorMessage: text("error_message"),
});

export type ScraperRun = typeof scraperRunsTable.$inferSelect;
export type InsertScraperRun = typeof scraperRunsTable.$inferInsert;
