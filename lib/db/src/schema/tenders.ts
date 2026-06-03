import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tendersTable = pgTable("tenders", {
  id: serial("id").primaryKey(),
  ikn: text("ikn").notNull().unique(),
  title: text("title").notNull(),
  agencyName: text("agency_name").notNull(),
  agencyLogoUrl: text("agency_logo_url"),
  type: text("type").notNull(),
  method: text("method").notNull(),
  estimatedValue: real("estimated_value").notNull().default(0),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  il: text("il").notNull().default(""),
  status: text("status").notNull().default("active"),
  description: text("description"),
  qualificationCriteria: text("qualification_criteria").array().notNull().default([]),
  documentsRequired: text("documents_required").array().notNull().default([]),
  rawDocsUrls: text("raw_docs_urls").array().notNull().default([]),
  sourceSystem: text("source_system").notNull().default("ekap"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenderSchema = createInsertSchema(tendersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type Tender = typeof tendersTable.$inferSelect;
