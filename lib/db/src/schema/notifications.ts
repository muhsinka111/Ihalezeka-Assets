import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  businessId: text("business_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  emailAddress: text("email_address"),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  minFitScore: integer("min_fit_score").notNull().default(60),
  sources: text("sources").array().notNull().default(["ekap", "ilan_gov"]),
  categories: text("categories").array().notNull().default([]),
  lastVisitedAt: timestamp("last_visited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  businessId: text("business_id").notNull(),
  matchId: integer("match_id").references(() => matchesTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  fitScore: integer("fit_score"),
  tenderTitle: text("tender_title"),
  tenderId: integer("tender_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
