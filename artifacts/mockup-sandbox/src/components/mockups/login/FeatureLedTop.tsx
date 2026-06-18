export function FeatureLedTop() {
  const features = [
    { icon: "⚡", label: "12.000+ İhale / Gün" },
    { icon: "🤖", label: "AI Uygunluk Skoru" },
    { icon: "🏆", label: "Rakip Analizi" },
    { icon: "🔒", label: "SSL Güvenli" },
  ];

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 35%, #f8fafc 70%, #eef2ff 100%)",
      }}
    >
      {/* Mesh gradient blobs */}
      <div className="absolute top-[-100px] right-[-80px] w-[420px] h-[420px] rounded-full opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, #b8c8ff 0%, transparent 65%)" }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, #c3d0ff 0%, transparent 65%)" }} />

      {/* ── Feature pills strip (above card) ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 mb-8 max-w-lg">
        {features.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(44,70,216,0.12)",
              color: "#374151",
              boxShadow: "0 1px 4px rgba(44,70,216,0.08)",
            }}
          >
            <span className="text-sm leading-none">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.95)",
          boxShadow: "0 24px 72px -12px rgba(44,70,216,0.16), 0 6px 20px rgba(0,0,0,0.05)",
        }}
      >
        {/* Colored top accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #2C46D8, #7b9bff, #2C46D8)" }} />

        <div className="p-8">
          {/* Logo inside card */}
          <div className="flex items-center gap-2.5 mb-6">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shadow"
              style={{ background: "linear-gradient(135deg, #2C46D8 0%, #4f6ef7 100%)" }}
            >
              İ
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base leading-tight" style={{ fontFamily: "Sora, sans-serif" }}>
                İhaleZeka
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">Türkiye'nin ihale platformu</div>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
              Hesabınıza Giriş Yapın
            </h2>
            <p className="text-slate-400 text-sm">Devam etmek için bilgilerinizi girin</p>
          </div>

          {/* Fields with more breathing room */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">E-posta adresi</label>
              <input
                type="email"
                placeholder="ornek@firma.com"
                className="w-full h-11 px-4 rounded-xl text-sm placeholder-slate-300 outline-none transition"
                style={{
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#1e293b",
                }}
                readOnly
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Şifre</label>
                <a className="text-xs font-medium" style={{ color: "#2C46D8" }}>Şifremi unuttum?</a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl text-sm placeholder-slate-300 outline-none"
                style={{ border: "1.5px solid #e2e8f0", background: "#f8fafc" }}
                readOnly
              />
            </div>

            <button
              className="w-full h-12 rounded-xl text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #1e3ab8 0%, #2C46D8 50%, #4f6ef7 100%)",
                boxShadow: "0 6px 20px rgba(44,70,216,0.40)",
              }}
            >
              Giriş Yap
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #e2e8f0)" }} />
            <span className="text-xs text-slate-400 font-medium px-1">veya</span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #e2e8f0, transparent)" }} />
          </div>

          {/* Google */}
          <button
            className="w-full h-11 rounded-xl text-sm font-medium text-slate-600 flex items-center justify-center gap-2.5"
            style={{
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ile devam et
          </button>

          <p className="text-xs text-slate-400 text-center mt-5">
            Henüz hesabınız yok mu?{" "}
            <a className="font-semibold" style={{ color: "#2C46D8" }}>Ücretsiz başlayın</a>
          </p>
        </div>
      </div>

      {/* Social proof below */}
      <div className="relative z-10 flex items-center gap-2 mt-7">
        <div className="flex -space-x-2 mr-1">
          {["#4f6ef7", "#2C46D8", "#7b9bff"].map((c, i) => (
            <div key={i} className="w-6 h-6 rounded-full border-2 border-white text-white text-[9px] font-bold flex items-center justify-center"
              style={{ background: c }}>
              {["A", "B", "C"][i]}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          <span className="text-slate-600 font-semibold">500+</span> firma zaten kullanıyor
        </p>
      </div>
    </div>
  );
}
