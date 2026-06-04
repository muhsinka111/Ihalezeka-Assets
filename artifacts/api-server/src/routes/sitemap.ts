import { Router } from "express";
import { db } from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { isNotNull, desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const posts = await db
      .select({ blogSlug: socialPostsTable.blogSlug, updatedAt: socialPostsTable.updatedAt })
      .from(socialPostsTable)
      .where(and(isNotNull(socialPostsTable.blogSlug), eq(socialPostsTable.status, "published")))
      .orderBy(desc(socialPostsTable.updatedAt));

    const staticUrls = [
      { loc: `${baseUrl}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${baseUrl}/dashboard`, priority: "0.8", changefreq: "daily" },
      { loc: `${baseUrl}/ihale-arama`, priority: "0.8", changefreq: "daily" },
      { loc: `${baseUrl}/firsatlarim`, priority: "0.7", changefreq: "daily" },
      { loc: `${baseUrl}/blog`, priority: "0.9", changefreq: "weekly" },
    ];

    const blogUrls = posts.map((p) => ({
      loc: `${baseUrl}/blog/${p.blogSlug}`,
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
  } catch (err) {
    res.status(500).send("<?xml version='1.0'?><urlset/>");
  }
});

export default router;
