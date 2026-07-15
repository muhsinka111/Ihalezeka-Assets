import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { usersTable, emailLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserId } from "../lib/authHelpers.js";
import { createSession, setSessionCookie, hashToken, SESSION_COOKIE } from "../lib/sessionHelpers.js";
import { sessionsTable } from "@workspace/db";
import { sendEmail, buildWelcomeEmailHtml } from "../lib/emailService.js";
import { logger } from "../lib/logger.js";

const router = Router();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: "Geçerli bir e-posta ve en az 8 karakterli şifre girin." });
    return;
  }
  const { email, password, name } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "email_taken", message: "Bu e-posta adresi zaten kayıtlı." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;

    await db.insert(usersTable).values({
      userId,
      email,
      name: name ?? null,
      passwordHash,
      searchCredits: 2,
    });

    const token = await createSession(userId);
    setSessionCookie(res, token);

    const displayName = name ?? "Değerli Kullanıcı";
    const html = buildWelcomeEmailHtml({ name: displayName, email });
    sendEmail({ to: email, subject: "İhaleZeka'ya Hoş Geldiniz 🎉", html })
      .then((sent) =>
        db
          .insert(emailLogsTable)
          .values({
            to: email,
            subject: "İhaleZeka'ya Hoş Geldiniz 🎉",
            status: sent ? "sent" : "failed",
            triggeredBy: "auth:signup",
          })
          .catch((err) => logger.warn({ err }, "Failed to log welcome email")),
      )
      .catch((err) => logger.warn({ err }, "Welcome email send failed"));

    res.status(201).json({ id: userId, email, name: name ?? null, isAdmin: false });
  } catch (err) {
    logger.error({ err }, "Signup failed");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: "Geçerli bir e-posta ve şifre girin." });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select({
        userId: usersTable.userId,
        email: usersTable.email,
        name: usersTable.name,
        passwordHash: usersTable.passwordHash,
        isAdmin: usersTable.isAdmin,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "invalid_credentials", message: "E-posta veya şifre hatalı." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid_credentials", message: "E-posta veya şifre hatalı." });
      return;
    }

    const token = await createSession(user.userId);
    setSessionCookie(res, token);

    res.json({ id: user.userId, email: user.email, name: user.name, isAdmin: user.isAdmin });
  } catch (err) {
    logger.error({ err }, "Login failed");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
    } catch (err) {
      logger.warn({ err }, "Failed to delete session on logout");
    }
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId || userId === "demo-user") {
    res.json(null);
    return;
  }

  try {
    const [user] = await db
      .select({
        userId: usersTable.userId,
        email: usersTable.email,
        name: usersTable.name,
        isAdmin: usersTable.isAdmin,
      })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    if (!user) {
      res.json(null);
      return;
    }
    res.json({ id: user.userId, email: user.email, name: user.name, isAdmin: user.isAdmin });
  } catch (err) {
    logger.error({ err }, "Failed to load current user");
    res.status(500).json({ error: "internal_error" });
  }
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

router.patch("/auth/me", async (req, res) => {
  const userId = getUserId(req);
  if (!userId || userId === "demo-user") {
    res.status(401).json({ error: "auth_required" });
    return;
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  try {
    await db.update(usersTable).set({ name: parsed.data.name }).where(eq(usersTable.userId, userId));
    const [user] = await db
      .select({ userId: usersTable.userId, email: usersTable.email, name: usersTable.name, isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);
    res.json({ id: user!.userId, email: user!.email, name: user!.name, isAdmin: user!.isAdmin });
  } catch (err) {
    logger.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/auth/change-password", async (req, res) => {
  const userId = getUserId(req);
  if (!userId || userId === "demo-user") {
    res.status(401).json({ error: "auth_required" });
    return;
  }

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", message: "Yeni şifre en az 8 karakter olmalıdır." });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);

    if (!user?.passwordHash) {
      res.status(400).json({ error: "no_password_set" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid_current_password", message: "Mevcut şifre hatalı." });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.userId, userId));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Change password failed");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
