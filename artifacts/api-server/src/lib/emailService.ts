import { logger } from "./logger.js";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Attempts to send via the Replit Connectors SDK (OAuth-managed Resend).
// Returns null if the connector is not available, false on send failure, true on success.
// The connector proxy is only available when REPLIT_CONNECTORS_HOSTNAME is set AND
// a valid Resend connection has been bound to this Repl.
// See: connection:conn_resend_01KTA6XWPP93KS6343SBPNHWZA
async function tryViaResendConnector(payload: EmailPayload): Promise<boolean | null> {
  if (!process.env.REPLIT_CONNECTORS_HOSTNAME) return null;

  const fromAddress = process.env.RESEND_FROM ?? "İhaleZeka <onboarding@resend.dev>";
  try {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn({ status: response.status, body, to: payload.to }, "Resend connector send failed — will try next provider");
      return false;
    }

    logger.info({ to: payload.to, subject: payload.subject }, "Email sent via Resend (connector)");
    return true;
  } catch (err) {
    logger.warn({ err, to: payload.to }, "Resend connector unavailable — will try next provider");
    return null;
  }
}

// Attempts to send via an explicit RESEND_API_KEY env var.
// Returns null if not configured, false on send failure, true on success.
async function tryViaResendApiKey(payload: EmailPayload): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const fromAddress = process.env.RESEND_FROM ?? "İhaleZeka <onboarding@resend.dev>";
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      logger.warn({ error, to: payload.to }, "Resend API key send failed — will try next provider");
      return false;
    }
    logger.info({ to: payload.to, subject: payload.subject }, "Email sent via Resend (API key)");
    return true;
  } catch (err) {
    logger.warn({ err, to: payload.to }, "Resend API key send error — will try next provider");
    return false;
  }
}

// Attempts to send via SMTP/nodemailer.
// Returns null if not configured, false on send failure, true on success.
async function tryViaSmtp(payload: EmailPayload): Promise<boolean | null> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddress = process.env.SMTP_FROM ?? "noreply@ihalezeka.com";

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    logger.info({ to: payload.to, subject: payload.subject }, "Email sent via SMTP");
    return true;
  } catch (err) {
    logger.error({ err, to: payload.to }, "SMTP send failed");
    return false;
  }
}

// Returns which provider is statically configured (based on env vars).
// "resend" covers both the connector and a raw API key.
// This reflects configuration, not runtime send success.
export function getEmailProvider(): "resend" | "smtp" | null {
  if (process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

// Sends an email via the first available provider in priority order:
//   1. Replit Connectors (OAuth-managed Resend) — tried if REPLIT_CONNECTORS_HOSTNAME is set
//   2. RESEND_API_KEY — explicit Resend API key
//   3. SMTP — nodemailer fallback
// Each provider falls through on null (not configured) or false (send failure).
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // 1. Try Replit connector (falls through to next if unavailable or fails)
  const connectorResult = await tryViaResendConnector(payload);
  if (connectorResult === true) return true;

  // 2. Try raw Resend API key
  const apiKeyResult = await tryViaResendApiKey(payload);
  if (apiKeyResult === true) return true;

  // 3. Try SMTP
  const smtpResult = await tryViaSmtp(payload);
  if (smtpResult === true) return true;

  // All providers exhausted
  if (connectorResult === null && apiKeyResult === null && smtpResult === null) {
    logger.warn({ to: payload.to }, "Email skipped: no email provider configured");
  } else {
    logger.error({ to: payload.to }, "Email delivery failed across all configured providers");
  }
  return false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildMatchEmailHtml(
  matches: Array<{ title: string; fitScore: number; agencyName: string; sourceUrl?: string | null }>
): string {
  const appUrl = escapeHtml(process.env.APP_URL ?? "https://ihalezeka.com");

  const rows = matches
    .map((m) => {
      const safeTitle = escapeHtml(m.title);
      const safeAgency = escapeHtml(m.agencyName);
      const safeUrl = m.sourceUrl ? escapeHtml(m.sourceUrl) : "#";
      const bgColor = m.fitScore >= 70 ? "#d1fae5" : m.fitScore >= 50 ? "#fef3c7" : "#fee2e2";
      const textColor = m.fitScore >= 70 ? "#065f46" : m.fitScore >= 50 ? "#92400e" : "#991b1b";
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <a href="${safeUrl}" style="font-weight:600;color:#2C46D8;text-decoration:none;">${safeTitle}</a>
          <div style="color:#6b7280;font-size:13px;margin-top:2px;">${safeAgency}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;white-space:nowrap;">
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:700;
            background:${bgColor};color:${textColor};">
            %${m.fitScore} Uyum
          </span>
        </td>
      </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2C46D8,#7c3aed);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">İhaleZeka — Yeni Eşleşmeler</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:15px;">Profilinize uyan ${matches.length} yeni ihale bulundu</p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:10px 12px;font-size:13px;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">İhale Adı</th>
            <th style="text-align:center;padding:10px 12px;font-size:13px;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Uyum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}/firsatlarim"
           style="display:inline-block;background:#2C46D8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Tüm Fırsatları Gör
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
      Bu e-posta İhaleZeka tarafından gönderilmiştir. Bildirim tercihlerinizi uygulamadan yönetebilirsiniz.
    </div>
  </div>
</body>
</html>`;
}
