import { logger } from "./logger.js";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddress = process.env.SMTP_FROM ?? "noreply@ihalezeka.com";

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.info({ to: payload.to, subject: payload.subject }, "Email skipped: SMTP not configured");
    return false;
  }

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

    logger.info({ to: payload.to, subject: payload.subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err, to: payload.to }, "Failed to send email");
    return false;
  }
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
