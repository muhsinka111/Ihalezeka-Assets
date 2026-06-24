import { useState, type ReactNode } from "react";
import { useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { isDevLoginEnabled } from "@/lib/devLogin";

const FEATURES = [
  "AI uygunluk skoru",
  "Rakip takibi",
  "Otomatik eşleştirme",
];

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function DevLoginButton() {
  const clerk = useClerk();
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/dev-token`, { method: "POST", credentials: "include" });
      const { token } = await res.json();
      const result = await (clerk.client as any).signIn.create({ strategy: "ticket", ticket: token });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        setLocation("/dashboard");
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full mt-4 h-9 rounded-lg text-xs font-medium border border-dashed border-slate-200 text-slate-400 hover:border-[#2D5BFF] hover:text-[#2D5BFF] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
    >
      <span>⚡</span>
      {loading ? "Giriş yapılıyor..." : "Dev: Admin olarak gir"}
    </button>
  );
}

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 100% 70% at 50% 0%, #dde5ff 0%, #f1f4ff 40%, #f8fafc 100%)",
      }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, #a5b8f8 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #c7d4ff 0%, transparent 70%)" }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[760px] rounded-2xl overflow-hidden flex"
        style={{
          boxShadow: "0 24px 64px -12px rgba(20,33,61,0.18), 0 8px 24px rgba(0,0,0,0.06)",
          border: "1px solid rgba(226,232,240,0.5)",
        }}
      >
        {/* ── Left mini-brand panel ── */}
        <div
          className="hidden sm:flex w-[42%] flex-shrink-0 p-8 flex-col justify-between relative overflow-hidden"
          style={{ background: "linear-gradient(155deg, #14213D 0%, #2D5BFF 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative">
            <a href="/" className="flex items-center gap-2 mb-7 w-fit">
              <img src="/logo.svg?v=2" alt="İhaleZeka" className="w-8 h-8" />
              <span className="text-white font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                İhaleZeka
              </span>
            </a>

            <h2 className="text-white text-xl font-bold leading-snug mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Akıllı ihale<br />yönetimi
            </h2>
            <p className="text-blue-200/70 text-xs leading-relaxed mb-6">
              Günlük 12.000+ ihaleyi yapay zeka ile tarayın ve fırsatları kaçırmayın.
            </p>

            <ul className="space-y-2.5">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l1.8 1.8L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-blue-100/80 text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24">
                  <path d="M6 1l1.2 3.6H11L8.1 6.8l1.2 3.6L6 8.2 2.7 10.4l1.2-3.6L1 4.6h3.8z" />
                </svg>
              ))}
            </div>
            <p className="text-blue-200/60 text-[11px]">"Artık hiçbir ihaleyi kaçırmıyoruz"</p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 bg-white p-8 flex flex-col justify-center min-w-0">
          {/* Mobile-only logo */}
          <div className="sm:hidden mb-6 flex items-center gap-2">
            <img src="/logo.svg?v=2" alt="İhaleZeka" className="w-7 h-7" />
            <span className="font-bold text-base text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              İhaleZeka
            </span>
          </div>

          {children}

          {isDevLoginEnabled() && <DevLoginButton />}
        </div>
      </div>
    </div>
  );
}
