import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("sent"),
  provider: text("provider"),
  triggeredBy: text("triggered_by"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailLog = typeof emailLogsTable.$inferSelect;
