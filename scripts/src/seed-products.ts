import { getUncachableStripeClient } from "./stripeClient.js";

/**
 * Seeds the İhaleZeka "Pro Plan" product and its monthly USD price in Stripe.
 *
 * Idempotent for product creation: it searches for an existing active "Pro Plan"
 * product before creating a new one. If the product already exists it checks
 * whether an active $99 USD monthly price exists; if not, it adds one.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-products
 *
 * Requires the Stripe integration to be connected via the Integrations tab.
 * After it runs, the stripe-replit-sync webhook mirrors the product/price into
 * the local `stripe.*` tables that the billing routes read from.
 */
const PRODUCT_NAME = "Pro Plan";
const MONTHLY_AMOUNT_CENTS = 9900; // $99.00 / month
const CURRENCY = "usd";

async function createProducts(): Promise<void> {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Seeding İhaleZeka products and prices in Stripe...");

    const existing = await stripe.products.search({
      query: `name:'${PRODUCT_NAME}' AND active:'true'`,
    });

    let productId: string;

    if (existing.data.length > 0) {
      productId = existing.data[0].id;
      console.log(`"${PRODUCT_NAME}" already exists (${productId}) — checking prices.`);

      // Check if a matching USD $99/month active price already exists.
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        currency: CURRENCY,
        type: "recurring",
        limit: 10,
      });

      const match = prices.data.find(
        (p) =>
          p.unit_amount === MONTHLY_AMOUNT_CENTS &&
          p.recurring?.interval === "month",
      );

      if (match) {
        console.log(`Active $${MONTHLY_AMOUNT_CENTS / 100} USD/month price already exists (${match.id}) — nothing to do.`);
        return;
      }

      // Archive old prices so the billing route picks up the new one.
      for (const p of prices.data) {
        if (p.id !== match?.id) {
          await stripe.prices.update(p.id, { active: false });
          console.log(`Archived old price: ${p.id}`);
        }
      }
    } else {
      const proProduct = await stripe.products.create({
        name: PRODUCT_NAME,
        description:
          "İhaleZeka Pro — full announcement text, contact details, documents, " +
          "AI analysis, saved-search alerts, exports, and power tools.",
      });
      productId = proProduct.id;
      console.log(`Created product: ${proProduct.name} (${productId})`);
    }

    const proMonthlyPrice = await stripe.prices.create({
      product: productId,
      unit_amount: MONTHLY_AMOUNT_CENTS,
      currency: CURRENCY,
      recurring: { interval: "month" },
    });
    console.log(
      `Created monthly price: $${(MONTHLY_AMOUNT_CENTS / 100).toFixed(2)}/month (${proMonthlyPrice.id})`,
    );

    console.log("\u2713 Products and prices synced successfully!");
    console.log("Webhooks will sync this data to your database automatically.");
  } catch (error) {
    console.error(
      "Error creating products:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

createProducts();
