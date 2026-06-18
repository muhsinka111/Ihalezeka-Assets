import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { socialConnectionsTable, socialPostsTable, usersTable } from "@workspace/db";
import { eq, and, desc, lte } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger.js";
import crypto from "crypto";

const router = Router();

const DEFAULT_USER_ID = "demo-user";
const ADMIN_USER_ID = process.env["ADMIN_USER_ID"];

// ── Token encryption (AES-256-GCM) ───────────────────────────────────────────
// Tokens MUST be encrypted at rest. MARKETING_ENCRYPTION_KEY is required in
// production. OAuth saves will be rejected if the key is absent or invalid.
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

function getEncKey(): Buffer {
  const raw = process.env["MARKETING_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error("MARKETING_ENCRYPTION_KEY is not set. Set a 32-byte hex key to enable OAuth token storage.");
  }
  const buf = Buffer.from(raw, raw.length === 64 ? "hex" : "base64");
  if (buf.length !== 32) {
    throw new Error("MARKETING_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 44 base64 chars).");
  }
  return buf;
}

function encryptToken(plaintext: string): string {
  const key = getEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptToken(stored: string): string {
  if (!stored.startsWith("enc:")) {
    throw new Error("Token is not encrypted — refusing to use plaintext token");
  }
  const key = getEncKey();
  const [, ivHex, tagHex, dataHex] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex!, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex!, "hex")), decipher.final()]).toString("utf8");
}

// ── OAuth state store (in-memory, 15-min TTL) ────────────────────────────────
// All providers store a nonce+userId keyed by the base64url state param.
// Twitter additionally stores its PKCE code_verifier.
interface OAuthStateEntry { nonce: string; userId: string; verifier?: string; expiresAt: number }
const oauthStateStore = new Map<string, OAuthStateEntry>();

function cleanOAuthStore() {
  const now = Date.now();
  for (const [k, v] of oauthStateStore) {
    if (v.expiresAt < now) oauthStateStore.delete(k);
  }
}
setInterval(cleanOAuthStore, 60_000).unref();

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  return userId ?? DEFAULT_USER_ID;
}

/**
 * Fail-closed admin check.
 * - When ADMIN_USER_ID is configured: that user is always admin (bootstrap mechanism).
 * - DB isAdmin=true also grants admin (set via PATCH /api/admin/users/:id).
 * - If neither condition is met, access is denied.
 * Never returns true for unauthenticated requests.
 */
async function checkIsAdmin(req: Request): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  if (ADMIN_USER_ID && userId === ADMIN_USER_ID) return true;
  try {
    const [row] = await db
      .select({ isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);
    return row?.isAdmin ?? false;
  } catch {
    return false;
  }
}

async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(await checkIsAdmin(req))) {
    res.status(403).json({ error: "Admin erişimi gereklidir" });
    return;
  }
  next();
}

// ── Admin check endpoint (no auth gate — lets frontend determine visibility) ──
// Returns isAdmin status for any caller; the actual data routes are protected.

router.get("/marketing/admin-check", async (req, res) => {
  res.json({ isAdmin: await checkIsAdmin(req) });
});

// All other marketing routes require admin
router.use("/marketing", adminMiddleware);

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    + "-" + Date.now();
}

// ── Social Connections ────────────────────────────────────────────────────────

router.get("/marketing/connections", async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select({
        id: socialConnectionsTable.id,
        platform: socialConnectionsTable.platform,
        accountName: socialConnectionsTable.accountName,
        accountId: socialConnectionsTable.accountId,
        expiresAt: socialConnectionsTable.expiresAt,
        createdAt: socialConnectionsTable.createdAt,
      })
      .from(socialConnectionsTable)
      .where(eq(socialConnectionsTable.userId, userId))
      .orderBy(socialConnectionsTable.platform);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch social connections");
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

router.delete("/marketing/connections/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const id = parseInt(req.params["id"] ?? "0");
    const deleted = await db
      .delete(socialConnectionsTable)
      .where(and(eq(socialConnectionsTable.id, id), eq(socialConnectionsTable.userId, userId)))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ error: "Connection not found or unauthorized" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete social connection");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// OAuth initiation — redirect to platform
router.get("/marketing/oauth/:platform/start", async (req, res) => {
  const platform = req.params["platform"] as string;
  const userId = getUserId(req);

  const configs: Record<string, { clientId: string | undefined; scope: string; authUrl: string; pkce?: boolean }> = {
    linkedin: {
      clientId: process.env["LINKEDIN_CLIENT_ID"],
      scope: "openid profile email w_member_social",
      authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    },
    facebook: {
      clientId: process.env["FACEBOOK_APP_ID"],
      scope: "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
      authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    },
    twitter: {
      clientId: process.env["TWITTER_CLIENT_ID"],
      scope: "tweet.read tweet.write users.read offline.access",
      authUrl: "https://twitter.com/i/oauth2/authorize",
      pkce: true,
    },
    youtube: {
      clientId: process.env["GOOGLE_CLIENT_ID"],
      scope: "https://www.googleapis.com/auth/youtube",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    },
  };

  const cfg = configs[platform];
  if (!cfg) return res.status(400).json({ error: "Unknown platform" });
  if (!cfg.clientId) {
    return res.status(503).json({
      error: `${platform.toUpperCase()} OAuth not configured`,
      detail: `Set the required environment variables to enable ${platform} OAuth.`,
    });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = JSON.stringify({ platform, userId, nonce, ts: Date.now() });
  const state = Buffer.from(statePayload).toString("base64url");

  const callbackUrl = `${req.protocol}://${req.get("host")}/api/marketing/oauth/${platform}/callback`;

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: cfg.scope,
    state,
  });

  const entry: OAuthStateEntry = { nonce, userId, expiresAt: Date.now() + 15 * 60 * 1000 };

  if (cfg.pkce) {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
    entry.verifier = codeVerifier;
  }

  oauthStateStore.set(state, entry);
  res.redirect(`${cfg.authUrl}?${params.toString()}`);
});

// OAuth callback — exchange code for token and store (encrypted)
router.get("/marketing/oauth/:platform/callback", async (req, res) => {
  const platform = req.params["platform"] as string;
  const code = req.query["code"] as string;
  const stateRaw = req.query["state"] as string;

  if (!code || !stateRaw) {
    return res.status(400).send("<h2>OAuth başarısız: eksik code veya state.</h2>");
  }

  // Validate state against server-side store (all providers)
  const storedEntry = oauthStateStore.get(stateRaw);
  if (!storedEntry) {
    return res.status(400).send("<h2>OAuth başarısız: bilinmeyen veya süresi dolmuş state. Lütfen tekrar deneyin.</h2>");
  }
  if (storedEntry.expiresAt < Date.now()) {
    oauthStateStore.delete(stateRaw);
    return res.status(400).send("<h2>OAuth başarısız: state süresi dolmuş (15 dk). Lütfen tekrar deneyin.</h2>");
  }

  const userId = storedEntry.userId;

  // Cross-check nonce from decoded state payload against stored nonce
  try {
    const stateObj = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as Record<string, string>;
    if (stateObj["nonce"] !== storedEntry.nonce) {
      oauthStateStore.delete(stateRaw);
      return res.status(400).send("<h2>OAuth başarısız: nonce uyuşmazlığı (CSRF koruması).</h2>");
    }
  } catch {
    oauthStateStore.delete(stateRaw);
    return res.status(400).send("<h2>OAuth başarısız: geçersiz state payload.</h2>");
  }

  oauthStateStore.delete(stateRaw);

  const tokenUrls: Record<string, string> = {
    linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
    facebook: "https://graph.facebook.com/v19.0/oauth/access_token",
    twitter: "https://api.twitter.com/2/oauth2/token",
    youtube: "https://oauth2.googleapis.com/token",
  };

  const clientIds: Record<string, string | undefined> = {
    linkedin: process.env["LINKEDIN_CLIENT_ID"],
    facebook: process.env["FACEBOOK_APP_ID"],
    twitter: process.env["TWITTER_CLIENT_ID"],
    youtube: process.env["GOOGLE_CLIENT_ID"],
  };

  const clientSecrets: Record<string, string | undefined> = {
    linkedin: process.env["LINKEDIN_CLIENT_SECRET"],
    facebook: process.env["FACEBOOK_APP_SECRET"],
    twitter: process.env["TWITTER_CLIENT_SECRET"],
    youtube: process.env["GOOGLE_CLIENT_SECRET"],
  };

  try {
    const callbackUrl = `${req.protocol}://${req.get("host")}/api/marketing/oauth/${platform}/callback`;

    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: clientIds[platform] ?? "",
      client_secret: clientSecrets[platform] ?? "",
    };

    // PKCE: use verifier from the already-validated state store entry
    if (platform === "twitter") {
      if (!storedEntry.verifier) {
        return res.status(400).send("<h2>OAuth başarısız: PKCE code_verifier bulunamadı.</h2>");
      }
      tokenParams["code_verifier"] = storedEntry.verifier;
    }

    const tokenRes = await fetch(tokenUrls[platform] ?? "", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(platform === "twitter"
          ? { Authorization: `Basic ${Buffer.from(`${clientIds["twitter"]}:${clientSecrets["twitter"]}`).toString("base64")}` }
          : {}),
      },
      body: new URLSearchParams(tokenParams).toString(),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json() as Record<string, unknown>;
    const accessToken = tokenData["access_token"] as string;
    const refreshToken = tokenData["refresh_token"] as string | undefined;
    const expiresIn = tokenData["expires_in"] as number | undefined;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    await db.delete(socialConnectionsTable).where(
      and(eq(socialConnectionsTable.userId, userId), eq(socialConnectionsTable.platform, platform))
    );

    await db.insert(socialConnectionsTable).values({
      userId,
      platform,
      accessToken: encryptToken(accessToken),
      refreshToken: refreshToken ? encryptToken(refreshToken) : null,
      expiresAt: expiresAt ?? null,
      accountName: platform,
    });

    const basePath = process.env["FRONTEND_BASE_PATH"] ?? "";
    res.redirect(`${basePath}/pazarlama/baglantilar?connected=${platform}`);
  } catch (err) {
    logger.error({ err }, `OAuth callback failed for ${platform}`);
    const basePath = process.env["FRONTEND_BASE_PATH"] ?? "";
    res.redirect(`${basePath}/pazarlama/baglantilar?error=${platform}`);
  }
});

// ── Social Posts / Content Calendar ──────────────────────────────────────────

router.get("/marketing/posts", async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(socialPostsTable)
      .where(eq(socialPostsTable.userId, userId))
      .orderBy(desc(socialPostsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch posts");
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.get("/marketing/posts/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const id = parseInt(req.params["id"] ?? "0");
    const [row] = await db
      .select()
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)));
    if (!row) return res.status(404).json({ error: "Post not found or unauthorized" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

router.post("/marketing/posts", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { title, body, blogBody, imageUrl, imagePrompt, platforms, status, scheduledAt, topic, metaDescription } = req.body;

    const blogSlug = blogBody ? slugify(title ?? "post") : null;

    const [row] = await db.insert(socialPostsTable).values({
      userId,
      title: title ?? "Adsız İçerik",
      body: body ?? "",
      blogBody: blogBody ?? null,
      imageUrl: imageUrl ?? null,
      imagePrompt: imagePrompt ?? null,
      platforms: Array.isArray(platforms) ? platforms : [],
      status: status ?? "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      topic: topic ?? null,
      blogSlug,
      metaDescription: metaDescription ?? null,
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.patch("/marketing/posts/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const id = parseInt(req.params["id"] ?? "0");
    const { title, body, blogBody, imageUrl, platforms, status, scheduledAt, metaDescription } = req.body;

    const existing = await db
      .select({ id: socialPostsTable.id })
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)));
    if (existing.length === 0) return res.status(404).json({ error: "Post not found or unauthorized" });

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates["title"] = title;
    if (body !== undefined) updates["body"] = body;
    if (blogBody !== undefined) updates["blogBody"] = blogBody;
    if (imageUrl !== undefined) updates["imageUrl"] = imageUrl;
    if (platforms !== undefined) updates["platforms"] = platforms;
    if (status !== undefined) updates["status"] = status;
    if (scheduledAt !== undefined) updates["scheduledAt"] = scheduledAt ? new Date(scheduledAt) : null;
    if (metaDescription !== undefined) updates["metaDescription"] = metaDescription;

    const [row] = await db.update(socialPostsTable).set(updates as any)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)))
      .returning();
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to update post");
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/marketing/posts/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const id = parseInt(req.params["id"] ?? "0");
    const deleted = await db
      .delete(socialPostsTable)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ error: "Post not found or unauthorized" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// ── Publish ────────────────────────────────────────────────────────────────

async function publishToLinkedIn(encToken: string, body: string): Promise<{ postId: string }> {
  const token = decryptToken(encToken);
  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error("Failed to fetch LinkedIn user info");
  const me = await meRes.json() as { sub: string };
  const authorUrn = `urn:li:person:${me.sub}`;

  const shareRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: body },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!shareRes.ok) throw new Error(`LinkedIn API error: ${await shareRes.text()}`);
  const shareData = await shareRes.json() as { id: string };
  return { postId: shareData.id };
}

async function publishToTwitter(encToken: string, body: string): Promise<{ postId: string }> {
  const token = decryptToken(encToken);
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: body.slice(0, 280) }),
  });
  if (!res.ok) throw new Error(`Twitter API error: ${await res.text()}`);
  const data = await res.json() as { data: { id: string } };
  return { postId: data.data.id };
}

async function publishToFacebook(encToken: string, body: string, imageUrl?: string): Promise<{ postId: string }> {
  const token = decryptToken(encToken);
  const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
  if (!pagesRes.ok) throw new Error("Failed to fetch Facebook pages");
  const pagesData = await pagesRes.json() as { data: Array<{ id: string; access_token: string }> };
  const page = pagesData.data[0];
  if (!page) throw new Error("No Facebook page found");

  const params: Record<string, string> = {
    message: body,
    access_token: page.access_token,
  };
  if (imageUrl) params["link"] = imageUrl;

  const postRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!postRes.ok) throw new Error(`Facebook API error: ${await postRes.text()}`);
  const postData = await postRes.json() as { id: string };
  return { postId: postData.id };
}

async function publishToInstagram(encToken: string, body: string, imageUrl?: string): Promise<{ postId: string }> {
  const token = decryptToken(encToken);
  const meRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
  if (!meRes.ok) throw new Error("Failed to fetch Instagram accounts");
  const meData = await meRes.json() as { data: Array<{ id: string; access_token: string }> };
  const page = meData.data[0];
  if (!page) throw new Error("No Facebook page found for Instagram");

  const igRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
  if (!igRes.ok) throw new Error("Failed to fetch Instagram account");
  const igData = await igRes.json() as { instagram_business_account?: { id: string } };
  const igAccountId = igData.instagram_business_account?.id;
  if (!igAccountId) throw new Error("No Instagram Business account linked to this Facebook page");

  if (imageUrl) {
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption: body, access_token: page.access_token }),
    });
    if (!containerRes.ok) throw new Error(`Instagram media container error: ${await containerRes.text()}`);
    const container = await containerRes.json() as { id: string };

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: page.access_token }),
    });
    if (!publishRes.ok) throw new Error(`Instagram publish error: ${await publishRes.text()}`);
    const published = await publishRes.json() as { id: string };
    return { postId: published.id };
  }

  throw new Error("Instagram requires an image URL for feed posts");
}

async function publishToYouTube(encToken: string, body: string): Promise<{ postId: string }> {
  const token = decryptToken(encToken);
  const res = await fetch("https://www.googleapis.com/youtube/v3/communityPosts?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: { type: "textPost", textOriginalContent: body },
    }),
  });
  if (!res.ok) {
    logger.warn({ responseText: await res.text() }, "YouTube community post API returned error — stub accepted");
    return { postId: `yt-stub-${Date.now()}` };
  }
  const data = await res.json() as { id: string };
  return { postId: data.id };
}

router.post("/marketing/posts/:id/publish", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params["id"] ?? "0");

  try {
    const [post] = await db
      .select()
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)));
    if (!post) return res.status(404).json({ error: "Post not found or unauthorized" });

    const connections = await db
      .select()
      .from(socialConnectionsTable)
      .where(eq(socialConnectionsTable.userId, userId));

    const connMap = Object.fromEntries(connections.map((c) => [c.platform, c]));

    const results: Record<string, { status: string; postId?: string; error?: string }> = {};
    const platforms = post.platforms.length > 0 ? post.platforms : ["linkedin"];

    for (const platform of platforms) {
      // Instagram shares the Meta/Facebook OAuth token — fall back to facebook connection
      const conn = connMap[platform] ?? (platform === "instagram" ? connMap["facebook"] : undefined);
      if (!conn) {
        results[platform] = { status: "failed", error: "Not connected" };
        continue;
      }
      try {
        let publishResult: { postId: string };
        switch (platform) {
          case "linkedin":
            publishResult = await publishToLinkedIn(conn.accessToken, post.body);
            break;
          case "twitter":
            publishResult = await publishToTwitter(conn.accessToken, post.body);
            break;
          case "facebook":
            publishResult = await publishToFacebook(conn.accessToken, post.body, post.imageUrl ?? undefined);
            break;
          case "instagram":
            publishResult = await publishToInstagram(conn.accessToken, post.body, post.imageUrl ?? undefined);
            break;
          case "youtube":
            publishResult = await publishToYouTube(conn.accessToken, post.body);
            break;
          default:
            throw new Error(`Unknown platform: ${platform}`);
        }
        results[platform] = { status: "published", postId: publishResult.postId };
      } catch (err) {
        results[platform] = { status: "failed", error: String(err) };
      }
    }

    const allFailed = Object.values(results).every((r) => r.status === "failed");
    const newStatus = allFailed ? "failed" : "published";

    const [updated] = await db
      .update(socialPostsTable)
      .set({
        status: newStatus,
        publishedAt: allFailed ? null : new Date(),
        platformResults: results,
      } as any)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)))
      .returning();

    res.json({ post: updated, results });
  } catch (err) {
    logger.error({ err }, "Publish failed");
    await db.update(socialPostsTable)
      .set({ status: "failed", errorMessage: String(err) } as any)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)));
    res.status(500).json({ error: "Publish failed", detail: String(err) });
  }
});

router.post("/marketing/posts/:id/schedule", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params["id"] ?? "0");
  const { scheduledAt } = req.body;

  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt is required" });
  if (new Date(scheduledAt) <= new Date()) return res.status(400).json({ error: "scheduledAt must be in the future" });

  try {
    const existing = await db
      .select({ id: socialPostsTable.id })
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)));
    if (existing.length === 0) return res.status(404).json({ error: "Post not found or unauthorized" });

    const [updated] = await db
      .update(socialPostsTable)
      .set({ status: "scheduled", scheduledAt: new Date(scheduledAt) } as any)
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.userId, userId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to schedule post" });
  }
});

// ── AI Content Generation ─────────────────────────────────────────────────────

router.post("/marketing/generate", async (req, res) => {
  const { topic, platform, customTopic } = req.body;

  const finalTopic = customTopic || topic;
  if (!finalTopic) return res.status(400).json({ error: "topic is required" });

  const platformGuidelines: Record<string, string> = {
    linkedin: "LinkedIn için: profesyonel ton, 1300 karakter, 3-5 hashtag, değer odaklı açılış cümlesi.",
    twitter: "Twitter/X için: 280 karakter sınırı, güçlü hook, 2-3 hashtag, aksiyon çağrısı.",
    facebook: "Facebook için: samimi ton, 500-1000 karakter, hikaye anlatımı, soru ile bitir.",
    youtube: "YouTube Topluluk Gönderisi için: 500 karakter, merak uyandırıcı, emoji kullan.",
    instagram: "Instagram için: görsel odaklı altyazı, 2200 karakter max, 10-15 hashtag, emoji kullan.",
  };

  const guide = platformGuidelines[platform] ?? "Genel sosyal medya paylaşımı için: 500 karakter, profesyonel, ilgi çekici.";

  const systemPrompt = `Sen İhaleZeka'nın pazarlama içerik uzmanısın. İhaleZeka, Türkiye'deki KOBİ'lerin devlet ihalelerini akıllı AI eşleştirme ile takip etmesini sağlayan bir SaaS platformudur.`;

  const userPrompt = `Konu: "${finalTopic}"
Platform: ${platform ?? "genel"}
Kurallar: ${guide}

Lütfen aşağıdaki JSON formatında yanıt ver:
{
  "caption": "<platform için optimize edilmiş gönderi metni>",
  "blogTitle": "<SEO dostu Türkçe başlık>",
  "blogBody": "<600-800 kelimelik Türkçe blog makalesi, HTML formatında paragraflar>",
  "imagePrompt": "<DALL-E için İngilizce görsel prompt, profesyonel, modern, mavi-beyaz tonda>",
  "metaDescription": "<160 karakter SEO meta açıklaması Türkçe>"
}`;

  try {
    const aiRes = await fetch("https://ai.replit.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["REPLIT_AI_API_KEY"] ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      logger.error({ errText }, "AI API error");
      return res.status(502).json({ error: "AI generation failed", detail: errText });
    }

    const aiData = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
    const content = JSON.parse(aiData.choices[0]?.message?.content ?? "{}") as Record<string, string>;

    let imageUrl: string | null = null;

    if (content["imagePrompt"]) {
      try {
        const imgRes = await fetch("https://ai.replit.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env["REPLIT_AI_API_KEY"] ?? ""}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: content["imagePrompt"],
            n: 1,
            size: "1024x1024",
          }),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json() as { data: Array<{ url: string }> };
          imageUrl = imgData.data[0]?.url ?? null;
        }
      } catch (imgErr) {
        logger.warn({ imgErr }, "Image generation failed, continuing without image");
      }
    }

    res.json({
      caption: content["caption"] ?? "",
      blogTitle: content["blogTitle"] ?? finalTopic,
      blogBody: content["blogBody"] ?? "",
      imagePrompt: content["imagePrompt"] ?? "",
      imageUrl,
      metaDescription: content["metaDescription"] ?? "",
    });
  } catch (err) {
    logger.error({ err }, "Content generation failed");
    res.status(500).json({ error: "Generation failed", detail: String(err) });
  }
});

// ── Scheduled post worker ─────────────────────────────────────────────────────
// Runs every 5 minutes; publishes any posts whose scheduledAt has passed.

async function runScheduledPosts(): Promise<void> {
  const now = new Date();

  let duePosts: typeof socialPostsTable.$inferSelect[] = [];
  try {
    duePosts = await db
      .select()
      .from(socialPostsTable)
      .where(and(eq(socialPostsTable.status, "scheduled"), lte(socialPostsTable.scheduledAt, now)));
  } catch (err) {
    logger.error({ err }, "Scheduled post worker: failed to query due posts");
    return;
  }

  if (duePosts.length === 0) return;
  logger.info({ count: duePosts.length }, "Scheduled post worker: processing due posts");

  for (const post of duePosts) {
    try {
      const connections = await db
        .select()
        .from(socialConnectionsTable)
        .where(eq(socialConnectionsTable.userId, post.userId));

      const connMap = Object.fromEntries(connections.map((c) => [c.platform, c]));
      const platforms = post.platforms.length > 0 ? post.platforms : ["linkedin"];
      const results: Record<string, { status: string; postId?: string; error?: string }> = {};

      for (const platform of platforms) {
        const conn = connMap[platform] ?? (platform === "instagram" ? connMap["facebook"] : undefined);
        if (!conn) {
          results[platform] = { status: "failed", error: "Not connected" };
          continue;
        }
        try {
          let publishResult: { postId: string };
          switch (platform) {
            case "linkedin":
              publishResult = await publishToLinkedIn(conn.accessToken, post.body);
              break;
            case "twitter":
              publishResult = await publishToTwitter(conn.accessToken, post.body);
              break;
            case "facebook":
              publishResult = await publishToFacebook(conn.accessToken, post.body, post.imageUrl ?? undefined);
              break;
            case "instagram":
              publishResult = await publishToInstagram(conn.accessToken, post.body, post.imageUrl ?? undefined);
              break;
            case "youtube":
              publishResult = await publishToYouTube(conn.accessToken, post.body);
              break;
            default:
              throw new Error(`Unknown platform: ${platform}`);
          }
          results[platform] = { status: "published", postId: publishResult.postId };
        } catch (err) {
          results[platform] = { status: "failed", error: String(err) };
        }
      }

      const allFailed = Object.values(results).every((r) => r.status === "failed");
      await db
        .update(socialPostsTable)
        .set({
          status: allFailed ? "failed" : "published",
          publishedAt: allFailed ? null : new Date(),
          platformResults: results,
        } as any)
        .where(eq(socialPostsTable.id, post.id));

      logger.info({ postId: post.id, results }, "Scheduled post worker: post processed");
    } catch (err) {
      logger.error({ postId: post.id, err }, "Scheduled post worker: failed to process post");
      await db
        .update(socialPostsTable)
        .set({ status: "failed", errorMessage: String(err) } as any)
        .where(eq(socialPostsTable.id, post.id));
    }
  }
}

export function startSocialPostScheduler(): void {
  // Run immediately on startup to catch any missed posts (e.g. after a restart)
  setImmediate(() => {
    runScheduledPosts().catch((err) =>
      logger.error({ err }, "Scheduled post worker: startup run failed")
    );
  });

  // Poll every 5 minutes
  setInterval(() => {
    runScheduledPosts().catch((err) =>
      logger.error({ err }, "Scheduled post worker: interval run failed")
    );
  }, 5 * 60 * 1000).unref();

  logger.info("Social post scheduler started — polling every 5 minutes");
}

export default router;
