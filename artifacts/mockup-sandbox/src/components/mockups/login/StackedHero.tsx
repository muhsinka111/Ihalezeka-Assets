export function StackedHero() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start px-4 pt-14 pb-10 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 50%, #f1f5ff 100%)",
      }}
    >
      {/* Background blobs */}
      <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 80% at 50% -20%, rgba(44,70,216,0.12) 0%, transparent 100%)" }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #c7d4ff 0%, transparent 70%)" }} />

      {/* ── Hero section: big logo + tagline ── */}
      <div className="relative z-10 flex flex-col items-center text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, #2C46D8 0%, #4f6ef7 100%)", boxShadow: "0 8px 24px rgba(44,70,216,0.30)" }}
        >
          İ
        </div>
        <h1
          className="text-3xl font-bold text-slate-900 tracking-tight mb-2"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          İhaleZeka
        </h1>
        <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed">
          Türkiye'nin yapay zeka destekli ihale platformuna hoş geldiniz
        </p>
      </div>

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full max-w-[400px] rounded-2xl p-7"
        style={{
          background: "#fff",
          border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 16px 48px -8px rgba(44,70,216,0.12), 0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-0.5" style={{ fontFamily: "Sora, sans-serif" }}>
            Giriş Yapın
          </h2>
          <p className="text-slate-400 text-xs">Hesabınıza erişmek için bilgilerinizi girin</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">E-posta</label>
            <input
              type="email"
              placeholder="ornek@firma.com"
              className="w-full h-10 px-3 rounded-lg text-sm placeholder-slate-300 outline-none"
              style={{ border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#1e293b" }}
              readOnly
            />
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Şifre</label>
              <a className="text-xs font-medium" style={{ color: "#2C46D8" }}>Unuttum</a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg text-sm placeholder-slate-300 outline-none"
              style={{ border: "1.5px solid #e2e8f0", background: "#f8fafc" }}
              readOnly
            />
          </div>

          <button
            className="w-full h-11 rounded-xl text-white text-sm font-bold tracking-wide"
            style={{
              background: "linear-gradient(135deg, #2C46D8 0%, #4055c8 100%)",
              boxShadow: "0 4px 16px rgba(44,70,216,0.35)",
            }}
          >
            Giriş Yap
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-300 font-medium">veya</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <button
          className="w-full h-10 rounded-xl text-sm font-medium text-slate-600 flex items-center justify-center gap-2.5"
          style={{ border: "1.5px solid #e2e8f0", background: "#f8fafc" }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google ile devam et
        </button>

        {/* Social proof inside card */}
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {["#4f6ef7", "#2C46D8", "#7b9bff", "#1a2f5a"].map((c, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: c }}
                >
                  {["A", "B", "C", "+"][i]}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-600">500+</span> firma güveniyor
            </p>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-center text-xs text-slate-400 mt-5">
        Hesabınız yok mu?{" "}
        <a className="font-semibold" style={{ color: "#2C46D8" }}>Ücretsiz kaydolun</a>
      </p>
    </div>
  );
}
