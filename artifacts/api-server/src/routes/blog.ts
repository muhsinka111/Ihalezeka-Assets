import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { db } from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { eq, isNotNull, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const ALLOWED_BLOG_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "em", "b", "i", "u", "s",
    "a", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https", "http"] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" },
    }),
  },
};

const router = Router();

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const blogHtml = (title: string, meta: string, body: string, jsonLd: string) => `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(title)} | İhaleZeka Blog</title>
  ${meta}
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,system-ui,sans-serif;color:#1a2030;background:#f8faff;line-height:1.7}
    a{color:#2C46D8;text-decoration:none}
    a:hover{text-decoration:underline}
    .header{background:#2C46D8;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px}
    .header .logo{font-weight:800;font-size:20px;letter-spacing:-0.5px}
    .header .tagline{font-size:13px;opacity:0.8}
    .container{max-width:800px;margin:48px auto;padding:0 24px}
    h1{font-size:2rem;font-weight:800;line-height:1.25;margin-bottom:16px;color:#111827}
    .meta{font-size:13px;color:#6b7280;margin-bottom:32px;display:flex;gap:16px;flex-wrap:wrap}
    .content{font-size:1rem;color:#374151}
    .content p{margin-bottom:16px}
    .content h2{font-size:1.4rem;font-weight:700;margin:32px 0 12px;color:#111827}
    .content h3{font-size:1.15rem;font-weight:600;margin:24px 0 8px;color:#111827}
    .content ul,.content ol{padding-left:24px;margin-bottom:16px}
    .content li{margin-bottom:6px}
    .thumbnail{width:100%;border-radius:12px;margin-bottom:32px;object-fit:cover;max-height:400px}
    .back{display:inline-flex;align-items:center;gap:6px;margin-bottom:32px;color:#2C46D8;font-size:14px;font-weight:500}
    .footer{background:#1a2030;color:#9ca3af;padding:32px 24px;text-align:center;font-size:13px;margin-top:64px}
    .cta{background:#2C46D8;color:#fff;padding:32px;border-radius:16px;text-align:center;margin-top:48px}
    .cta h3{color:#fff;font-size:1.25rem;margin-bottom:12px}
    .cta a{background:#fff;color:#2C46D8;padding:12px 28px;border-radius:8px;font-weight:700;display:inline-block;margin-top:8px}
  </style>
</head>
<body>
  <header class="header">
    <div>
      <div class="logo">İhaleZeka</div>
      <div class="tagline">Akıllı İhale Takip Platformu</div>
    </div>
  </header>
  ${body}
  <footer class="footer">
    <p>© ${new Date().getFullYear()} İhaleZeka — Akıllı İhale Takip Platformu</p>
    <p style="margin-top:8px"><a href="/" style="color:#6b7280">Ana Sayfa</a> &nbsp;·&nbsp; <a href="/blog" style="color:#6b7280">Blog</a></p>
  </footer>
</body>
</html>`;

router.get("/blog", async (_req, res) => {
  try {
    const posts = await db
      .select({
        id: socialPostsTable.id,
        title: socialPostsTable.title,
        blogSlug: socialPostsTable.blogSlug,
        imageUrl: socialPostsTable.imageUrl,
        metaDescription: socialPostsTable.metaDescription,
        createdAt: socialPostsTable.createdAt,
        topic: socialPostsTable.topic,
      })
      .from(socialPostsTable)
      .where(and(isNotNull(socialPostsTable.blogSlug), eq(socialPostsTable.status, "published")))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(20);

    const cards = posts.map((p) => `
      <article style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,0.08);display:flex;gap:20px;align-items:flex-start">
        ${p.imageUrl ? `<img src="${escHtml(p.imageUrl)}" alt="${escHtml(p.title)}" style="width:140px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0"/>` : `<div style="width:140px;height:90px;background:#e5e7eb;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">Görsel yok</div>`}
        <div>
          <h2 style="font-size:1.1rem;margin-bottom:8px"><a href="/blog/${escHtml(p.blogSlug!)}">${escHtml(p.title)}</a></h2>
          <p style="color:#6b7280;font-size:13px;margin-bottom:8px">${escHtml(p.metaDescription ?? "")}</p>
          <span style="font-size:12px;color:#9ca3af">${new Date(p.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </article>
    `).join("\n");

    const meta = `
      <meta name="description" content="İhaleZeka Blog — Türkiye'de ihale takibi, kamu alımları ve AI destekli ihale stratejileri hakkında uzman içerikler."/>
      <meta property="og:title" content="İhaleZeka Blog"/>
      <meta property="og:description" content="İhaleZeka Blog — ihale takibi ve AI destekli stratejiler."/>
      <meta property="og:type" content="website"/>
      <link rel="canonical" href="/blog"/>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "İhaleZeka Blog",
      description: "Türkiye'de ihale takibi ve AI destekli ihale stratejileri hakkında uzman içerikler.",
      url: "/blog",
    });

    const bodyHtml = `
      <div class="container">
        <h1>İhaleZeka Blog</h1>
        <p style="color:#6b7280;margin-bottom:32px">İhale dünyasından haberler, stratejiler ve ipuçları.</p>
        ${posts.length === 0 ? '<p style="color:#9ca3af">Henüz blog yazısı yayınlanmamış.</p>' : `<div style="display:flex;flex-direction:column;gap:16px">${cards}</div>`}
      </div>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(blogHtml("Blog", meta, bodyHtml, jsonLd));
  } catch (err) {
    logger.error({ err }, "Blog index failed");
    res.status(500).send("<h2>Blog yüklenemedi.</h2>");
  }
});

router.get("/blog/:slug", async (req, res) => {
  const slug = req.params["slug"] as string;

  try {
    const [post] = await db
      .select()
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.blogSlug, slug), eq(socialPostsTable.status, "published")));

    if (!post) {
      return res.status(404).send(
        blogHtml("Sayfa Bulunamadı", "", `<div class="container"><h1>404 — Sayfa Bulunamadı</h1><p>Bu blog yazısı mevcut değil.</p><a class="back" href="/blog">← Blog'a Dön</a></div>`, "{}")
      );
    }

    const publishDate = new Date(post.createdAt).toISOString();
    const meta = `
      <meta name="description" content="${escHtml(post.metaDescription ?? post.title)}"/>
      <meta property="og:title" content="${escHtml(post.title)}"/>
      <meta property="og:description" content="${escHtml(post.metaDescription ?? "")}"/>
      <meta property="og:type" content="article"/>
      ${post.imageUrl ? `<meta property="og:image" content="${escHtml(post.imageUrl)}"/>` : ""}
      <meta name="twitter:card" content="summary_large_image"/>
      <meta name="twitter:title" content="${escHtml(post.title)}"/>
      <link rel="canonical" href="/blog/${escHtml(slug)}"/>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.metaDescription ?? "",
      image: post.imageUrl ?? undefined,
      datePublished: publishDate,
      dateModified: new Date(post.updatedAt).toISOString(),
      author: { "@type": "Organization", name: "İhaleZeka" },
      publisher: {
        "@type": "Organization",
        name: "İhaleZeka",
        logo: { "@type": "ImageObject", url: "/logo.svg" },
      },
    });

    const bodyHtml = `
      <div class="container">
        <a class="back" href="/blog">← Blog'a Dön</a>
        ${post.imageUrl ? `<img class="thumbnail" src="${escHtml(post.imageUrl)}" alt="${escHtml(post.title)}"/>` : ""}
        <h1>${escHtml(post.title)}</h1>
        <div class="meta">
          <span>📅 ${new Date(post.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</span>
          ${post.topic ? `<span>🏷️ ${escHtml(post.topic)}</span>` : ""}
        </div>
        <div class="content">${sanitizeHtml(post.blogBody ?? `<p>${escHtml(post.body)}</p>`, ALLOWED_BLOG_HTML)}</div>
        <div class="cta">
          <h3>İhale fırsatlarını kaçırmayın!</h3>
          <p style="color:#e0e7ff">İhaleZeka ile size özel ihaleleri AI destekli eşleştirme ile takip edin.</p>
          <a href="/">Ücretsiz Deneyin</a>
        </div>
      </div>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(blogHtml(post.title, meta, bodyHtml, jsonLd));
  } catch (err) {
    logger.error({ err }, "Blog post failed");
    res.status(500).send("<h2>Blog yazısı yüklenemedi.</h2>");
  }
});

export default router;
