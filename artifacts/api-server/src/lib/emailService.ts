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

/**
 * Operator alert email shown when a previously-working scraper source breaks
 * (errors) or goes empty (fetches 0 records). Plain, scannable, action-oriented.
 */
export function buildSourceHealthEmailHtml(opts: {
  sourceLabel: string;
  status: "error" | "empty";
  errorMessage: string | null;
  recordsFetched: number;
}): string {
  const appUrl = escapeHtml(process.env.APP_URL ?? "https://ihalezeka.com");
  const safeLabel = escapeHtml(opts.sourceLabel);
  const safeError = escapeHtml(opts.errorMessage ?? "Ayrıntı yok");
  const headline =
    opts.status === "error"
      ? `${safeLabel} kaynağında hata oluştu`
      : `${safeLabel} kaynağı 0 kayıt döndürdü`;
  const explain =
    opts.status === "error"
      ? "Kaynak çalışırken bir hata aldı ve veri çekemedi."
      : "Kaynak hatasız çalıştı ancak hiç kayıt döndürmedi. Bu genellikle sayfa yapısının değiştiğine veya kaynağın erişilemez hale geldiğine işaret eder.";

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">⚠️ İhaleZeka — Kaynak Uyarısı</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:15px;">${headline}</p>
    </div>
    <div style="padding:24px 32px;color:#374151;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">${explain}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#6b7280;width:160px;">Kaynak</td><td style="padding:8px 0;font-weight:600;">${safeLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Durum</td><td style="padding:8px 0;font-weight:600;">${opts.status === "error" ? "Hata" : "Boş (0 kayıt)"}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Çekilen kayıt</td><td style="padding:8px 0;font-weight:600;">${opts.recordsFetched}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Ayrıntı</td><td style="padding:8px 0;color:#991b1b;">${safeError}</td></tr>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}/ihale-arama"
           style="display:inline-block;background:#2C46D8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Kaynak Durumunu Gör
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
      Bu otomatik uyarı, daha önce çalışan bir kaynak veri çekemediğinde gönderilir.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Daily digest for saved-search alerts. Groups newly-ingested tenders by the
 * saved search they matched. Each tender shows title, buyer (agency) and
 * deadline, and links into the app's tender detail page.
 */
export function buildSavedSearchEmailHtml(
  groups: Array<{
    searchName: string;
    tenders: Array<{
      id: number;
      title: string;
      agencyName: string;
      deadline: Date | string | null;
      sourceUrl?: string | null;
    }>;
  }>
): string {
  const appUrl = (process.env.APP_URL ?? "https://ihalezeka.com").replace(/\/$/, "");
  const totalCount = groups.reduce((n, g) => n + g.tenders.length, 0);

  const fmtDeadline = (d: Date | string | null): string => {
    if (!d) return "Belirtilmemiş";
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return "Belirtilmemiş";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  };

  const sections = groups
    .map((g) => {
      const rows = g.tenders
        .map((t) => {
          const safeTitle = escapeHtml(t.title);
          const safeAgency = escapeHtml(t.agencyName);
          const link = `${appUrl}/ihale/${t.id}`;
          return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <a href="${link}" style="font-weight:600;color:#2C46D8;text-decoration:none;">${safeTitle}</a>
          <div style="color:#6b7280;font-size:13px;margin-top:2px;">${safeAgency}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;color:#374151;font-size:13px;">
          ${escapeHtml(fmtDeadline(t.deadline))}
        </td>
      </tr>`;
        })
        .join("");
      return `
      <div style="margin-bottom:28px;">
        <h2 style="font-size:16px;color:#111827;margin:0 0 8px;font-weight:700;">
          🔖 ${escapeHtml(g.searchName)}
          <span style="font-weight:500;color:#6b7280;font-size:13px;">(${g.tenders.length} yeni)</span>
        </h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">İhale Adı</th>
              <th style="text-align:right;padding:8px 12px;font-size:12px;color:#374151;font-weight:600;border-bottom:2px solid #e5e7eb;">Son Teklif</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2C46D8,#7c3aed);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">İhaleZeka — Kayıtlı Arama Bildirimi</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:15px;">Kayıtlı aramalarınıza uyan ${totalCount} yeni ihale yayınlandı</p>
    </div>
    <div style="padding:24px 32px;">
      ${sections}
      <div style="margin-top:8px;text-align:center;">
        <a href="${appUrl}/ihale-arama"
           style="display:inline-block;background:#2C46D8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          İhaleZeka'da Aç
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
      Bu e-posta kayıtlı aramalarınız için gönderilmiştir. Bildirimleri her aramanın yanından kapatabilirsiniz.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Welcome email sent immediately after a new user signs up.
 */
export function buildWelcomeEmailHtml(opts: { name: string; email: string }): string {
  const appUrl = (process.env.APP_URL ?? "https://ihalezeka.com").replace(/\/$/, "");
  const safeName = escapeHtml(opts.name);

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2D5BFF,#7c3aed);padding:32px;">
      <img src="${appUrl}/logo.png" alt="İhaleZeka" style="height:36px;margin-bottom:16px;display:block;" onerror="this.style.display='none'" />
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Hoş Geldiniz, ${safeName}! 🎉</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:16px;">
        İhaleZeka'ya üye olduğunuz için teşekkürler. Artık kamu ihalelerini takip etmek çok daha kolay.
      </p>
    </div>
    <div style="padding:32px;color:#374151;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 24px;">İhaleZeka ile neler yapabilirsiniz:</p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px;background:#f0f4ff;border-radius:8px;margin-bottom:12px;vertical-align:top;width:44px;">
            <span style="font-size:24px;">🔍</span>
          </td>
          <td style="padding:12px 12px 12px 16px;vertical-align:top;">
            <strong style="color:#111827;">Akıllı İhale Arama</strong>
            <div style="color:#6b7280;font-size:14px;margin-top:2px;">EKAP ve diğer kaynaklardan binlerce ihaleye tek yerden ulaşın</div>
          </td>
        </tr>
        <tr><td colspan="2" style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px;background:#f0fdf4;border-radius:8px;vertical-align:top;width:44px;">
            <span style="font-size:24px;">🤖</span>
          </td>
          <td style="padding:12px 12px 12px 16px;vertical-align:top;">
            <strong style="color:#111827;">Yapay Zeka Uygunluk Skoru</strong>
            <div style="color:#6b7280;font-size:14px;margin-top:2px;">Her ihale için şirketinize özel uygunluk analizi ve risk değerlendirmesi</div>
          </td>
        </tr>
        <tr><td colspan="2" style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px;background:#fdf4ff;border-radius:8px;vertical-align:top;width:44px;">
            <span style="font-size:24px;">🔔</span>
          </td>
          <td style="padding:12px 12px 12px 16px;vertical-align:top;">
            <strong style="color:#111827;">Kayıtlı Arama Bildirimleri</strong>
            <div style="color:#6b7280;font-size:14px;margin-top:2px;">Yeni ihaleler yayınlandığında anında e-posta ile bildirim alın</div>
          </td>
        </tr>
      </table>

      <div style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/ihale-arama"
           style="display:inline-block;background:#2D5BFF;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.01em;">
          İhale Aramaya Başla →
        </a>
      </div>

      <p style="color:#6b7280;font-size:14px;margin:0;">
        Herhangi bir sorunuz olursa <a href="mailto:info@ihalezeka.com" style="color:#2D5BFF;">info@ihalezeka.com</a> adresinden bize ulaşabilirsiniz.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
      Bu e-posta, İhaleZeka'ya kayıt olduğunuz için gönderilmiştir.<br/>
      © 2025 İhaleZeka — Tüm hakları saklıdır.
    </div>
  </div>
</body>
</html>`;
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
