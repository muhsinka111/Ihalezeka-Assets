import { pgTable, text, serial, timestamp, uniqueIndex, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Application user ↔ Stripe customer mapping. Keyed by `userId` (the Clerk user
 * id, or the shared "demo-user" sentinel while the dev auth bypass is active).
 *
 * Entitlement is NOT stored here directly: the source of truth for "is this user
 * Pro?" is the synced `stripe.subscriptions` table (status active/trialing on the
 * Pro price). This table only persists the IDs we need to (a) attach a checkout
 * session / billing-portal session to the right Stripe customer, and (b) join a
 * user to their synced subscription rows.
 *
 * `searchCredits` tracks the number of AI suitability analysis calls a free-tier
 * user may make. Default is 2 (given at account creation). Pro subscribers bypass
 * this counter entirely.
 */
export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    searchCredits: integer("search_credits").notNull().default(2),
    isAdmin: boolean("is_admin").notNull().default(false),
    isProOverride: boolean("is_pro_override").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_user_id_unique").on(t.userId),
    uniqueIndex("users_stripe_customer_id_unique").on(t.stripeCustomerId),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
