import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Server-side session store for email/password auth. The cookie holds a random
 * opaque token; only its SHA-256 hash is persisted here so a DB leak alone
 * doesn't hand out valid session tokens.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash)],
);

export type Session = typeof sessionsTable.$inferSelect;
