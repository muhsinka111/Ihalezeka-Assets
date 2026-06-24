import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";
import blogRouter from "./routes/blog";
import legalRouter from "./routes/legal";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { handleClerkWebhook } from "./routes/clerkWebhook";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { startScraperScheduler } from "./scrapers/scheduler";
import { startSocialPostScheduler } from "./routes/marketing";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Clerk webhook — raw body required for Svix signature verification,
// must be registered BEFORE express.json().
app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

// Stripe webhook MUST be registered with a raw body BEFORE express.json(),
// otherwise the signature verification fails (the SDK needs the exact bytes).
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0]! : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error(
          "STRIPE WEBHOOK ERROR: req.body is not a Buffer — express.json() ran first.",
        );
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use env-var keys directly — avoids dynamic key computation that can
// produce a mismatched publishable key under the Replit proxy headers.
app.use(clerkMiddleware());

app.use("/api", router);

// Sitemap, blog, and legal/marketing pages served at root level (no /api
// prefix) for SEO crawlability. The api-server artifact must claim these
// root paths in artifact.toml so the production router forwards them here.
app.use(sitemapRouter);
app.use(blogRouter);
app.use(legalRouter);

// Unknown /api routes → JSON 404
app.use("/api", (_req, res) => {
  res.status(404).json({ title: "Not Found", status: 404 });
});

startScraperScheduler();
startSocialPostScheduler();

export default app;
