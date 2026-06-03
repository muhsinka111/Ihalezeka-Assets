import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import path from "path";
import { fileURLToPath } from "url";

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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Unknown /api routes must return JSON 404 — never fall through to the SPA shell.
app.use("/api", (_req, res) => {
  res.status(404).json({ title: "Not Found", status: 404 });
});

// Serve the built frontend from artifacts/ihalezeka/dist/public
// __dirname here resolves to artifacts/api-server/dist at runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, "..", "..", "ihalezeka", "dist", "public");

app.use("/", express.static(FRONTEND_DIST));

// SPA fallback: only navigational HTML GET requests return index.html so
// client-side routing works. Non-GET methods and asset/JSON requests fall
// through to Express's default 404 instead of receiving the HTML shell.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!req.accepts("html")) return next();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

export default app;
