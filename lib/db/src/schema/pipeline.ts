import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";

export const pipelineItemsTable = pgTable("pipeline_items", {
  id: serial("id").primaryKey(),
  businessId: text("business_id").notNull(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  stage: text("stage").notNull().default("discovery"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPipelineItemSchema = createInsertSchema(pipelineItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPipelineItem = z.infer<typeof insertPipelineItemSchema>;
export type PipelineItem = typeof pipelineItemsTable.$inferSelect;
