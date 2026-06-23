import { type ReactNode } from "react";

const FEATURES = [
  "Günlük 12.000+ ihale otomatik tarama",
  "AI destekli uygunluk skoru analizi",
  "Rakip firma takibi ve karşılaştırma",
  "Teklif hazırlama ve boru hattı yönetimi",
];

const AVATARS = ["#2D5BFF", "#2D5BFF", "#6E8BFF", "#14213D"];

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] w-full">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(155deg, #14213D 0%, #14213D 60%, #1B2C50 100%)",
        }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Glow blobs */}
        <div
          className="absolute top-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "#2D5BFF" }}
        />
        <div
          className="absolute bottom-10 right-0 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: "#2D5BFF" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <a href="/" className="flex items-center gap-3 w-fit">
            <img src="/logo.svg" alt="İhaleZeka" className="w-9 h-9" />
            <span
              className="text-white font-bold text-xl tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              İhaleZeka
            </span>
          </a>
        </div>

        {/* Centre: headline + bullets */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <h1
            className="text-4xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Türkiye'nin
            <br />
            <span style={{ color: "#6E8BFF" }}>akıllı ihale</span>
            <br />
            platformu
          </h1>
          <p className="text-blue-200/70 text-base mb-10 leading-relaxed max-w-xs">
            Yapay zeka ile ihaleleri analiz edin, rakiplerinizi takip edin, fırsatları kaçırmayın.
          </p>

          <ul className="space-y-4">
            {FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                  style={{
                    background: "rgba(45,91,255,0.35)",
                    border: "1px solid rgba(110,139,255,0.4)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2.5 2.5L8 2.5"
                      stroke="#6E8BFF"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-blue-100/80 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: social proof */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {AVATARS.map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ background: color, borderColor: "#14213D" }}
                >
                  {["A", "B", "C", "+"][i]}
                </div>
              ))}
            </div>
            <p className="text-blue-200/60 text-xs">
              <span className="text-white font-semibold">500+ firma</span> İhaleZeka kullanıyor
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white overflow-y-auto">
        {/* Mobile-only logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <img src="/logo.svg" alt="İhaleZeka" className="w-8 h-8" />
          <span className="font-bold text-lg text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            İhaleZeka
          </span>
        </div>

        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
