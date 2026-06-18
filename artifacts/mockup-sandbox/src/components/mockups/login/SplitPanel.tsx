export function SplitPanel() {
  return (
    <div className="flex min-h-screen w-full font-sans">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0f1e3c 0%, #1a2f5a 60%, #1e3a7a 100%)" }}
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute top-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: "#2C46D8" }} />
        <div className="absolute bottom-10 right-0 w-64 h-64 rounded-full blur-3xl opacity-15" style={{ background: "#4f6ef7" }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
              style={{ background: "#2C46D8" }}
            >
              İ
            </div>
            <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>
              İhaleZeka
            </span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <h1
            className="text-4xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            Türkiye'nin
            <br />
            <span style={{ color: "#7b9bff" }}>akıllı ihale</span>
            <br />
            platformu
          </h1>
          <p className="text-blue-200/70 text-base mb-10 leading-relaxed max-w-xs">
            Yapay zeka ile ihaleleri analiz edin, rakiplerinizi takip edin, fırsatları kaçırmayın.
          </p>

          <ul className="space-y-4">
            {[
              "Günlük 12.000+ ihale otomatik tarama",
              "AI destekli uygunluk skoru analizi",
              "Rakip firma takibi ve karşılaştırma",
              "Teklif hazırlama ve boru hattı yönetimi",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: "rgba(44,70,216,0.35)", border: "1px solid rgba(120,155,255,0.4)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 2.5" stroke="#7b9bff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-blue-100/80 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom trust */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["#4f6ef7", "#2C46D8", "#7b9bff", "#1a2f5a"].map((c, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ background: c }}
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
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "#2C46D8" }}>
            İ
          </div>
          <span className="font-bold text-lg text-slate-900" style={{ fontFamily: "Sora, sans-serif" }}>İhaleZeka</span>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1.5" style={{ fontFamily: "Sora, sans-serif" }}>
              Hoş Geldiniz
            </h2>
            <p className="text-slate-500 text-sm">Hesabınıza giriş yapın</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-posta adresi</label>
              <input
                type="email"
                placeholder="ornek@firma.com"
                className="w-full h-11 px-3.5 rounded-lg border text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2"
                style={{
                  borderColor: "#e2e8f0",
                  background: "#fff",
                  boxShadow: "none",
                }}
                readOnly
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Şifre</label>
                <a className="text-xs font-medium" style={{ color: "#2C46D8" }}>Şifremi unuttum</a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-lg border text-sm placeholder-slate-400 outline-none"
                style={{ borderColor: "#e2e8f0", background: "#fff" }}
                readOnly
              />
            </div>

            <button
              className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 shadow-sm"
              style={{ background: "#2C46D8" }}
            >
              Giriş Yap
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">veya</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google SSO */}
          <button
            className="w-full h-11 rounded-lg border text-sm font-medium text-slate-700 flex items-center justify-center gap-2.5 hover:bg-slate-50 transition-colors"
            style={{ borderColor: "#e2e8f0" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ile devam et
          </button>

          <p className="text-center text-sm text-slate-500 mt-6">
            Hesabınız yok mu?{" "}
            <a className="font-semibold" style={{ color: "#2C46D8" }}>Kayıt olun</a>
          </p>
        </div>
      </div>
    </div>
  );
}
