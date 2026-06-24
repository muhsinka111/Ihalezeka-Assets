import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { db } from "@workspace/db";
import { socialPostsTable } from "@workspace/db";
import { eq, isNotNull, desc, and } from "drizzle-orm";

const ALLOWED_TAGS = [
  "h1","h2","h3","h4","h5","h6","p","br","hr","ul","ol","li",
  "strong","em","b","i","u","s","a","blockquote","pre","code",
  "table","thead","tbody","tr","th","td","img",
];

const router = Router();

router.get("/blog/posts", async (_req, res) => {
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

    res.json({ posts, total: posts.length });
  } catch {
    res.status(500).json({ error: "Blog yazıları yüklenemedi" });
  }
});

router.get("/blog/posts/:slug", async (req, res) => {
  const slug = req.params["slug"] as string;
  try {
    const [post] = await db
      .select()
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.blogSlug, slug), eq(socialPostsTable.status, "published")));

    if (!post) {
      res.status(404).json({ error: "Yazı bulunamadı" });
      return;
    }

    const blogBody = post.blogBody
      ? sanitizeHtml(post.blogBody, {
          allowedTags: ALLOWED_TAGS,
          allowedAttributes: {
            a: ["href", "title", "target", "rel"],
            img: ["src", "alt", "width", "height"],
            td: ["colspan", "rowspan"],
            th: ["colspan", "rowspan"],
          },
          allowedSchemes: ["http", "https", "mailto"],
          transformTags: {
            a: (tagName, attribs) => ({
              tagName,
              attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" },
            }),
          },
        })
      : null;

    res.json({
      id: post.id,
      title: post.title,
      blogSlug: post.blogSlug,
      imageUrl: post.imageUrl,
      metaDescription: post.metaDescription,
      blogBody,
      createdAt: post.createdAt,
      topic: post.topic,
    });
  } catch {
    res.status(500).json({ error: "Yazı yüklenemedi" });
  }
});

export default router;
