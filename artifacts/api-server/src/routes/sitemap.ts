import { Router } from "express";
import { db } from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { isNotNull, desc, eq, and } from "drizzle-orm";
import { SITE_URL } from "../lib/site.js";

const router = Router();

const today = () => new Date().toISOString().split("T")[0];

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const posts = await db
      .select({ blogSlug: socialPostsTable.blogSlug, updatedAt: socialPostsTable.updatedAt })
      .from(socialPostsTable)
      .where(and(isNotNull(socialPostsTable.blogSlug), eq(socialPostsTable.status, "published")))
      .orderBy(desc(socialPostsTable.updatedAt));

    // Only public, crawlable pages. Auth-gated app routes (/dashboard,
    // /ihale-arama, /firsatlarim, etc.) are intentionally excluded.
    const staticUrls = [
      { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly", lastmod: today() },
      { loc: `${SITE_URL}/blog`, priority: "0.9", changefreq: "weekly", lastmod: today() },
      { loc: `${SITE_URL}/uluslararasi-ihaleler`, priority: "0.7", changefreq: "monthly", lastmod: today() },
      { loc: `${SITE_URL}/gizlilik`, priority: "0.4", changefreq: "yearly", lastmod: today() },
      { loc: `${SITE_URL}/kvkk`, priority: "0.4", changefreq: "yearly", lastmod: today() },
      { loc: `${SITE_URL}/kullanim-sartlari`, priority: "0.4", changefreq: "yearly", lastmod: today() },
    ];

    const blogUrls = posts.map((p) => ({
      loc: `${SITE_URL}/blog/${p.blogSlug}`,
      lastmod: new Date(p.updatedAt).toISOString().split("T")[0],
      priority: "0.7",
      changefreq: "monthly",
    }));

    const allUrls = [...staticUrls, ...blogUrls];

    const urlEntries = allUrls.map((u) => `
  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch {
    res.status(500).send("<?xml version='1.0'?><urlset/>");
  }
});

export default router;

// ── Google Search Console verification ──────────────────────────────────
// Serves the google<code>.html verification file. Two options:
//  1. Place the file from Search Console into artifacts/api-server/public/
//     (e.g. public/google1234567890abcdef.html) → served at /google...html
//  2. Set GOOGLE_SITE_VERIFICATION env to the <code> value from Search
//     Console; the route synthesizes the file on the fly (no redeploy).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "..", "public");

router.get(/^\/google[a-z0-9]+\.html$/, async (req, res) => {
  // Option 2: env-based code (highest priority, zero-redeploy)
  const envCode = process.env.GOOGLE_SITE_VERIFICATION;
  const reqCode = req.path.match(/^\/google([a-z0-9]+)\.html$/)?.[1];
  if (envCode && reqCode === envCode) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`google-site-verification: ${envCode}`);
    return;
  }
  // Option 1: static file in public/
  try {
    const file = join(PUBLIC_DIR, req.path.replace(/^\//, ""));
    const html = await readFile(file, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch {
    res.status(404).send("Not found");
  }
});
