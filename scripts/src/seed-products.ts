import { getUncachableStripeClient } from "./stripeClient.js";

/**
 * Seeds the İhaleZeka "Pro Plan" product and its monthly TRY price in Stripe.
 *
 * Idempotent: it searches for an existing active "Pro Plan" product before
 * creating anything, so it is safe to run multiple times.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-products
 *
 * Requires the Stripe integration to be connected via the Integrations tab.
 * After it runs, the stripe-replit-sync webhook mirrors the product/price into
 * the local `stripe.*` tables that the billing routes read from.
 */
const PRODUCT_NAME = "Pro Plan";
const MONTHLY_AMOUNT_KURUS = 49900; // ₺499.00 / month
const CURRENCY = "try";

async function createProducts(): Promise<void> {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Seeding İhaleZeka products and prices in Stripe...");

    const existing = await stripe.products.search({
      query: `name:'${PRODUCT_NAME}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`"${PRODUCT_NAME}" already exists — skipping creation.`);
      console.log(`Existing product ID: ${existing.data[0].id}`);
      return;
    }

    const proProduct = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "İhaleZeka Pro — full announcement text, contact details, documents, " +
        "AI analysis, saved-search alerts, exports, and power tools.",
    });
    console.log(`Created product: ${proProduct.name} (${proProduct.id})`);

    const proMonthlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: MONTHLY_AMOUNT_KURUS,
      currency: CURRENCY,
      recurring: { interval: "month" },
    });
    console.log(
      `Created monthly price: ₺${(MONTHLY_AMOUNT_KURUS / 100).toFixed(2)}/ay (${proMonthlyPrice.id})`,
    );

    console.log("\u2713 Products and prices created successfully!");
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
