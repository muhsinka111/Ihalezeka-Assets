import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  businessId: text("business_id").notNull(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  fitScore: integer("fit_score").notNull().default(0),
  reasoning: text("reasoning"),
  pros: text("pros").array().notNull().default([]),
  risks: text("risks").array().notNull().default([]),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
