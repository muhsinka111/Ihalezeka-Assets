import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyProfilesTable = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  businessId: text("business_id").notNull().unique(),
  companyName: text("company_name").notNull(),
  taxNumber: text("tax_number").notNull(),
  mersisNumber: text("mersis_number"),
  ekapNumber: text("ekap_number"),
  naceCodes: text("nace_codes").array().notNull().default([]),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  experienceCeiling: real("experience_ceiling"),
  certifications: text("certifications").array().notNull().default([]),
  personnelCount: integer("personnel_count"),
  annualRevenue: real("annual_revenue"),
  preferredProvinces: text("preferred_provinces").array().notNull().default([]),
  excludedProvinces: text("excluded_provinces").array().notNull().default([]),
  discountStrategy: text("discount_strategy"),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  completionStep: integer("completion_step").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyProfile = typeof companyProfilesTable.$inferSelect;
