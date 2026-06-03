import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();
const DEFAULT_BIZ = "demo-business";

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || "ihalezeka-dev-key-32-bytes-long!!";
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

const fmt = (k: any) => ({
  ...k,
  createdAt: k.createdAt?.toISOString?.() ?? k.createdAt,
  lastUsedAt: k.lastUsedAt?.toISOString?.() ?? k.lastUsedAt,
});

router.get("/api-keys", async (req, res) => {
  try {
    const items = await db
      .select({
        id: apiKeysTable.id,
        provider: apiKeysTable.provider,
        maskedKey: apiKeysTable.maskedKey,
        lastUsedAt: apiKeysTable.lastUsedAt,
        createdAt: apiKeysTable.createdAt,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.businessId, DEFAULT_BIZ));
    res.json(items.map(fmt));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api-keys", async (req, res) => {
  try {
    const { provider, key } = req.body;
    if (!provider || !key) return res.status(400).json({ error: "Missing provider or key" });

    const encryptedKey = encrypt(key);
    const maskedKey = maskKey(key);

    const [created] = await db
      .insert(apiKeysTable)
      .values({ businessId: DEFAULT_BIZ, provider, encryptedKey, maskedKey })
      .returning({
        id: apiKeysTable.id,
        provider: apiKeysTable.provider,
        maskedKey: apiKeysTable.maskedKey,
        lastUsedAt: apiKeysTable.lastUsedAt,
        createdAt: apiKeysTable.createdAt,
      });

    res.status(201).json(fmt(created));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api-keys/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await db
      .delete(apiKeysTable)
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.businessId, DEFAULT_BIZ)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
