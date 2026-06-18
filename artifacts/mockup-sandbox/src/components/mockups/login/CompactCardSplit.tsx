export function CompactCardSplit() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 100% 70% at 50% 0%, #dde5ff 0%, #f1f4ff 40%, #f8fafc 100%)",
      }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, #a5b8f8 0%, transparent 70%)" }} />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #c7d4ff 0%, transparent 70%)" }} />

      {/* ── Wide horizontal card ── */}
      <div
        className="relative z-10 w-full max-w-[760px] rounded-2xl overflow-hidden flex"
        style={{
          boxShadow: "0 24px 64px -12px rgba(44,70,216,0.18), 0 8px 24px rgba(0,0,0,0.06)",
          border: "1px solid rgba(226,232,240,0.5)",
        }}
      >
        {/* Left mini-brand panel */}
        <div
          className="w-[45%] flex-shrink-0 p-8 flex flex-col justify-between"
          style={{
            background: "linear-gradient(155deg, #1a2f5a 0%, #2C46D8 100%)",
          }}
        >
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

          <div className="relative">
            <div className="flex items-center gap-2 mb-7">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-base"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
                İ
              </div>
              <span className="text-white font-bold text-base" style={{ fontFamily: "Sora, sans-serif" }}>İhaleZeka</span>
            </div>

            <h2 className="text-white text-xl font-bold leading-snug mb-3" style={{ fontFamily: "Sora, sans-serif" }}>
              Akıllı ihale<br />yönetimi
            </h2>
            <p className="text-blue-200/70 text-xs leading-relaxed mb-6">
              Günlük 12.000+ ihaleyi yapay zeka ile tarayın ve fırsatları kaçırmayın.
            </p>

            <ul className="space-y-2.5">
              {[
                "AI uygunluk skoru",
                "Rakip takibi",
                "Otomatik eşleştirme",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l1.8 1.8L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-blue-100/80 text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom rating */}
          <div className="relative">
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24">
                  <path d="M6 1l1.2 3.6H11L8.1 6.8l1.2 3.6L6 8.2 2.7 10.4l1.2-3.6L1 4.6h3.8z"/>
                </svg>
              ))}
            </div>
            <p className="text-blue-200/60 text-[11px]">"Artık hiçbir ihaleyi kaçırmıyoruz"</p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 bg-white p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
              Hoş Geldiniz
            </h2>
            <p className="text-slate-400 text-sm">Hesabınıza giriş yapın</p>
          </div>

          {/* Google SSO */}
          <button
            className="w-full h-10 rounded-lg text-sm font-medium text-slate-700 flex items-center justify-center gap-2 mb-4"
            style={{ border: "1px solid #e2e8f0", background: "#f8fafc" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ile devam et
          </button>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-300">veya</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="E-posta adresi"
              className="w-full h-10 px-3 rounded-lg text-sm placeholder-slate-300 outline-none"
              style={{ border: "1px solid #e2e8f0", background: "#f8fafc" }}
              readOnly
            />
            <input
              type="password"
              placeholder="Şifre"
              className="w-full h-10 px-3 rounded-lg text-sm placeholder-slate-300 outline-none"
              style={{ border: "1px solid #e2e8f0", background: "#f8fafc" }}
              readOnly
            />
            <div className="flex justify-end">
              <a className="text-xs font-medium" style={{ color: "#2C46D8" }}>Şifremi unuttum?</a>
            </div>

            <button
              className="w-full h-10 rounded-lg text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #2C46D8 0%, #4055c8 100%)", boxShadow: "0 4px 12px rgba(44,70,216,0.3)" }}
            >
              Giriş Yap →
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center mt-5">
            Hesabınız yok mu?{" "}
            <a className="font-semibold" style={{ color: "#2C46D8" }}>Kayıt olun</a>
          </p>
        </div>
      </div>
    </div>
  );
}
