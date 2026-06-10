import { pgTable, text, serial, timestamp, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface TenderContact {
  authority: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  contactPerson: string | null;
}

export type FitVerdict = "uygun" | "dikkat" | "uygun_degil";

/**
 * Where the AI analysis text came from (mandatory grounding chain):
 *  - document    → extracted attachment document text
 *  - notice      → stored notice/detail text (ilan content, raw_data harvest)
 *  - source_page → live-fetched source_url page text
 *  - metadata    → tender metadata only (title/agency/CPV/value/deadline …)
 */
export type GroundingSource = "document" | "notice" | "source_page" | "metadata";

/** Confidence in the analysis given how it was grounded. */
export type GroundingConfidence = "high" | "medium" | "low";

export interface AiAnalysis {
  summary: string;
  requiredTurnover: number | null;
  experienceYears: number | null;
  personnelCount: number | null;
  technicalSpecs: string[];
  scoringWeights: Record<string, number>;
  qualificationCriteria: Array<{ criterion: string; threshold: string | null }>;
  analyzedAt: string;
  fitVerdict?: FitVerdict | null;
  fitReason?: string | null;
  pros?: string[];
  risks?: string[];
  contact?: TenderContact | null;
  docsDownloaded?: number;
  docsTotal?: number;
  groundingSource?: GroundingSource | null;
  confidence?: GroundingConfidence | null;
}

export const tendersTable = pgTable("tenders", {
  id: serial("id").primaryKey(),
  ikn: text("ikn").notNull().unique(),
  title: text("title").notNull(),
  agencyName: text("agency_name").notNull(),
  agencyLogoUrl: text("agency_logo_url"),
  type: text("type").notNull(),
  method: text("method").notNull(),
  estimatedValue: real("estimated_value"),
  deadline: timestamp("deadline", { withTimezone: true }),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  il: text("il").notNull().default(""),
  status: text("status").notNull().default("active"),
  category: text("category").notNull().default("ihale"),
  description: text("description"),
  qualificationCriteria: text("qualification_criteria").array().notNull().default([]),
  documentsRequired: text("documents_required").array().notNull().default([]),
  rawDocsUrls: text("raw_docs_urls").array().notNull().default([]),
  sourceSystem: text("source_system").notNull().default("ekap"),
  sourceUrl: text("source_url"),
  procurementMethod: text("procurement_method"),
  documents: jsonb("documents").$type<Array<{ name: string; url: string; type: string }>>(),
  contact: jsonb("contact").$type<TenderContact>(),
  rawData: jsonb("raw_data"),
  aiSummary: jsonb("ai_summary").$type<AiAnalysis>(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenderSchema = createInsertSchema(tendersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type Tender = typeof tendersTable.$inferSelect;
