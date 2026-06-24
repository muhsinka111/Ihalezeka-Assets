import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { db } from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { eq, isNotNull, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { SITE_URL } from "../lib/site.js";
import { escHtml, pageShell } from "../lib/ssrShell.js";

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

/** Resolve a possibly-relative image path to an absolute URL for OG tags. */
function absoluteUrl(maybePath: string | null | undefined): string | undefined {
  if (!maybePath) return undefined;
  if (/^https?:\/\//i.test(maybePath)) return maybePath;
  return `${SITE_URL}/${maybePath.replace(/^\/+/, "")}`;
}

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
          <h2 style="font-size:1.1rem;margin-bottom:8px"><a href="${SITE_URL}/blog/${escHtml(p.blogSlug!)}">${escHtml(p.title)}</a></h2>
          <p style="color:#6b7280;font-size:13px;margin-bottom:8px">${escHtml(p.metaDescription ?? "")}</p>
          <span style="font-size:12px;color:#9ca3af">${new Date(p.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </article>
    `).join("\n");

    const meta = `
      <meta name="description" content="İhaleZeka Blog — Türkiye'de ihale takibi, kamu alımları ve AI destekli ihale stratejileri hakkında uzman içerikler."/>
      <meta name="robots" content="index, follow"/>
      <meta property="og:title" content="İhaleZeka Blog"/>
      <meta property="og:description" content="İhaleZeka Blog — ihale takibi ve AI destekli stratejiler."/>
      <meta property="og:type" content="website"/>
      <meta property="og:url" content="${SITE_URL}/blog"/>
      <meta property="og:image" content="${SITE_URL}/opengraph.jpg"/>
      <meta name="twitter:card" content="summary_large_image"/>
      <link rel="canonical" href="${SITE_URL}/blog"/>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "İhaleZeka Blog",
      description: "Türkiye'de ihale takibi ve AI destekli ihale stratejileri hakkında uzman içerikler.",
      url: `${SITE_URL}/blog`,
    });

    const bodyHtml = `
      <div class="container">
        <h1>İhaleZeka Blog</h1>
        <p style="color:#6b7280;margin-bottom:32px">İhale dünyasından haberler, stratejiler ve ipuçları.</p>
        ${posts.length === 0 ? '<p style="color:#9ca3af">Henüz blog yazısı yayınlanmamış.</p>' : `<div style="display:flex;flex-direction:column;gap:16px">${cards}</div>`}
      </div>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(pageShell("İhaleZeka Blog", meta, bodyHtml, jsonLd));
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
        pageShell("Sayfa Bulunamadı | İhaleZeka", '<meta name="robots" content="noindex"/>', `<div class="container"><h1>404 — Sayfa Bulunamadı</h1><p>Bu blog yazısı mevcut değil.</p><a class="back" href="${SITE_URL}/blog">← Blog'a Dön</a></div>`, "{}")
      );
    }

    const publishDate = new Date(post.createdAt).toISOString();
    const ogImage = absoluteUrl(post.imageUrl);
    const meta = `
      <meta name="description" content="${escHtml(post.metaDescription ?? post.title)}"/>
      <meta name="robots" content="index, follow"/>
      <meta property="og:title" content="${escHtml(post.title)}"/>
      <meta property="og:description" content="${escHtml(post.metaDescription ?? "")}"/>
      <meta property="og:type" content="article"/>
      <meta property="og:url" content="${SITE_URL}/blog/${escHtml(slug)}"/>
      <meta property="og:image" content="${escHtml(ogImage ?? `${SITE_URL}/opengraph.jpg`)}"/>
      <meta name="twitter:card" content="summary_large_image"/>
      <meta name="twitter:title" content="${escHtml(post.title)}"/>
      <meta name="twitter:image" content="${escHtml(ogImage ?? `${SITE_URL}/opengraph.jpg`)}"/>
      <link rel="canonical" href="${SITE_URL}/blog/${escHtml(slug)}"/>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.metaDescription ?? "",
      image: ogImage ?? `${SITE_URL}/opengraph.jpg`,
      datePublished: publishDate,
      dateModified: new Date(post.updatedAt).toISOString(),
      mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
      author: { "@type": "Organization", name: "İhaleZeka", url: SITE_URL },
      publisher: {
        "@type": "Organization",
        name: "İhaleZeka",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
      },
    });

    const bodyHtml = `
      <div class="container">
        <a class="back" href="${SITE_URL}/blog">← Blog'a Dön</a>
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
          <a href="${SITE_URL}/">Ücretsiz Deneyin</a>
        </div>
      </div>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(pageShell(`${post.title} | İhaleZeka Blog`, meta, bodyHtml, jsonLd));
  } catch (err) {
    logger.error({ err }, "Blog post failed");
    res.status(500).send("<h2>Blog yazısı yüklenemedi.</h2>");
  }
});

export default router;
