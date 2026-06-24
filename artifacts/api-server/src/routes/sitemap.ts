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
