import { type Request, type Response } from "express";
import { Webhook } from "svix";
import { db } from "@workspace/db";
import { emailLogsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { sendEmail, buildWelcomeEmailHtml } from "../lib/emailService.js";

export async function handleClerkWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env["CLERK_WEBHOOK_SECRET"];
  if (!secret) {
    logger.warn("CLERK_WEBHOOK_SECRET not set — Clerk webhook disabled");
    res.status(200).json({ received: true, skipped: true });
    return;
  }

  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(req.body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof evt;
  } catch (err) {
    logger.warn({ err }, "Clerk webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (evt.type === "user.created") {
    const data = evt.data as {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email_addresses?: Array<{ email_address: string; verification?: { status: string } }>;
    };

    const primaryEmail =
      data.email_addresses?.find((e) => e.verification?.status === "verified")?.email_address ??
      data.email_addresses?.[0]?.email_address;

    const name =
      [data.first_name, data.last_name].filter(Boolean).join(" ") || "Değerli Kullanıcı";

    logger.info({ userId: data.id, email: primaryEmail }, "New user registered — sending welcome email");

    if (primaryEmail) {
      const html = buildWelcomeEmailHtml({ name, email: primaryEmail });
      const sent = await sendEmail({
        to: primaryEmail,
        subject: "İhaleZeka'ya Hoş Geldiniz 🎉",
        html,
      });

      await db
        .insert(emailLogsTable)
        .values({
          to: primaryEmail,
          subject: "İhaleZeka'ya Hoş Geldiniz 🎉",
          status: sent ? "sent" : "failed",
          triggeredBy: "clerk:user.created",
        })
        .catch((err) => logger.warn({ err }, "Failed to log welcome email"));

      logger.info({ email: primaryEmail, sent }, "Welcome email result");
    }
  }

  res.status(200).json({ received: true });
}
