# İhaleZeka — Landing Page Examples

3 design variants for the İhaleZeka landing page. Each is a single self-contained HTML file — open directly in a browser.

## Variants

| # | Style | Feel | Best for |
|---|-------|------|----------|
| **01-dark-3d** | Linear/Vercel dark futurism | Techy, eye-catching, 3D tilt on hero mockup, particle background, glassmorphism | Grabbing attention, AI/tech positioning |
| **02-editorial-light** | Stripe/Notion clean editorial | Calm, trustworthy, serif headlines, email capture hero, FAQ | B2B corporate buyers, conversion |
| **03-playful-gradient** | Framer/Raycast colorful | Energetic, gradient blobs, marquee logos, bento grid | Modern SaaS feel, startup vibe |

## Preview locally

```bash
cd landing-page-examples
python -m http.server 8099
```

Then open:
- http://127.0.0.1:8099/01-dark-3d/index.html
- http://127.0.0.1:8099/02-editorial-light/index.html
- http://127.0.0.1:8099/03-playful-gradient/index.html

Or just double-click any `index.html` — all three work from `file://` (no external requests except Google Fonts).

## Sections (all variants share)

- Hero with headline + CTAs
- Social proof (EKAP, Dünya Bankası, AB/TED, EBRD, UNGM, AIIB)
- Features (AI Eşleştirme, Şartname Analizi, Rakip Analizi, Akıllı Arama, Pipeline, Raporlar)
- "Nasıl Çalışır" 4-step flow
- Pricing ($99/ay, tek plan)
- Footer

## Notes

- All Turkish content
- Single-file: inline CSS + JS, only external dep is Google Fonts
- Fully responsive
- No build step needed
