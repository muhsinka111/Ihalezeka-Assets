import { SITE_URL } from "./site.js";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Shared server-rendered HTML shell for public, crawlable pages
 * (blog, legal, marketing). Keeps a single source of truth for the
 * header/footer chrome and base styles so every SSR page is consistent.
 *
 * `title` is the full <title> text. `meta` is a raw HTML string of
 * <meta>/<link> tags. `jsonLd` is a JSON string for structured data.
 */
export const pageShell = (title: string, meta: string, body: string, jsonLd: string) => `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(title)}</title>
  <meta name="theme-color" content="#2C46D8"/>
  ${meta}
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg"/>
  <link rel="icon" type="image/png" sizes="32x32" href="${SITE_URL}/favicon-32.png"/>
  <link rel="icon" type="image/png" sizes="16x16" href="${SITE_URL}/favicon-16.png"/>
  <link rel="shortcut icon" href="${SITE_URL}/favicon.ico"/>
  <link rel="apple-touch-icon" sizes="180x180" href="${SITE_URL}/apple-touch-icon.png"/>
  <link rel="manifest" href="${SITE_URL}/site.webmanifest"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,system-ui,sans-serif;color:#1a2030;background:#f8faff;line-height:1.7}
    a{color:#2C46D8;text-decoration:none}
    a:hover{text-decoration:underline}
    .header{background:#2C46D8;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px}
    .header a{color:#fff}
    .header .logo{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;letter-spacing:-0.5px}
    .header .tagline{font-size:13px;opacity:0.8}
    .container{max-width:800px;margin:48px auto;padding:0 24px}
    h1{font-family:'Space Grotesk',sans-serif;font-size:2rem;font-weight:800;line-height:1.25;margin-bottom:16px;color:#111827}
    .meta{font-size:13px;color:#6b7280;margin-bottom:32px;display:flex;gap:16px;flex-wrap:wrap}
    .content{font-size:1rem;color:#374151}
    .content p{margin-bottom:16px}
    .content h2{font-family:'Space Grotesk',sans-serif;font-size:1.4rem;font-weight:700;margin:32px 0 12px;color:#111827}
    .content h3{font-family:'Space Grotesk',sans-serif;font-size:1.15rem;font-weight:600;margin:24px 0 8px;color:#111827}
    .content ul,.content ol{padding-left:24px;margin-bottom:16px}
    .content li{margin-bottom:6px}
    .content table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.95rem}
    .content th,.content td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}
    .content th{background:#eef2ff}
    .content blockquote{border-left:4px solid #2C46D8;padding:8px 16px;margin:0 0 16px;background:#eef2ff;border-radius:0 8px 8px 0;color:#374151}
    .thumbnail{width:100%;border-radius:12px;margin-bottom:32px;object-fit:cover;max-height:400px}
    .back{display:inline-flex;align-items:center;gap:6px;margin-bottom:32px;color:#2C46D8;font-size:14px;font-weight:500}
    .footer{background:#1a2030;color:#9ca3af;padding:32px 24px;text-align:center;font-size:13px;margin-top:64px}
    .footer a{color:#9ca3af}
    .cta{background:#2C46D8;color:#fff;padding:32px;border-radius:16px;text-align:center;margin-top:48px}
    .cta h3{color:#fff;font-size:1.25rem;margin-bottom:12px}
    .cta a{background:#fff;color:#2C46D8;padding:12px 28px;border-radius:8px;font-weight:700;display:inline-block;margin-top:8px}
  </style>
</head>
<body>
  <header class="header">
    <div>
      <div class="logo"><a href="${SITE_URL}/">İhaleZeka</a></div>
      <div class="tagline">Akıllı İhale Takip Platformu</div>
    </div>
  </header>
  ${body}
  <footer class="footer">
    <p>© ${new Date().getFullYear()} İhaleZeka — Akıllı İhale Takip Platformu</p>
    <p style="margin-top:8px">
      <a href="${SITE_URL}/">Ana Sayfa</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}/blog">Blog</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}/gizlilik">Gizlilik</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}/kvkk">KVKK</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}/kullanim-sartlari">Kullanım Şartları</a>
    </p>
  </footer>
</body>
</html>`;
