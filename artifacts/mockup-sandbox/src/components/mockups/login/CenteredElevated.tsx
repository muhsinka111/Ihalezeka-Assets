export function CenteredElevated() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(226 71% 93%) 0%, hsl(210 20% 97%) 55%, hsl(210 20% 98%) 100%)",
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, #c7d4ff 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-48 -left-32 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #a5b8f8 0%, transparent 70%)" }}
      />

      {/* Logo above card */}
      <div className="flex items-center gap-2.5 mb-8 relative z-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
          style={{ background: "linear-gradient(135deg, #2C46D8 0%, #4f6ef7 100%)" }}
        >
          İ
        </div>
        <span className="font-bold text-[1.15rem] text-slate-900" style={{ fontFamily: "Sora, sans-serif" }}>
          İhaleZeka
        </span>
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-2xl p-8"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow: "0 20px 60px -10px rgba(44,70,216,0.15), 0 8px 20px -4px rgba(0,0,0,0.06), 0 0 0 1px rgba(226,232,240,0.6)",
        }}
      >
        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-slate-900 mb-1.5" style={{ fontFamily: "Sora, sans-serif" }}>
            Hoş Geldiniz
          </h2>
          <p className="text-slate-500 text-sm">Hesabınıza giriş yapın</p>
        </div>

        {/* Google SSO — prominent at top */}
        <button
          className="w-full h-11 rounded-xl border text-sm font-medium text-slate-700 flex items-center justify-center gap-2.5 mb-5 transition-colors hover:bg-slate-50"
          style={{
            borderColor: "#e2e8f0",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
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

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">veya e-posta ile</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Form fields */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-posta adresi</label>
            <input
              type="email"
              placeholder="ornek@firma.com"
              className="w-full h-10 px-3.5 rounded-lg text-sm placeholder-slate-400 outline-none"
              style={{
                border: "1px solid #e2e8f0",
                background: "rgba(248,250,252,0.8)",
                color: "#1e293b",
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
              className="w-full h-10 px-3.5 rounded-lg text-sm placeholder-slate-400 outline-none"
              style={{ border: "1px solid #e2e8f0", background: "rgba(248,250,252,0.8)" }}
              readOnly
            />
          </div>

          <button
            className="w-full h-11 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 mt-1"
            style={{
              background: "linear-gradient(135deg, #2C46D8 0%, #4055c8 100%)",
              boxShadow: "0 4px 14px rgba(44,70,216,0.35)",
            }}
          >
            Giriş Yap →
          </button>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Hesabınız yok mu?{" "}
          <a className="font-semibold" style={{ color: "#2C46D8" }}>Kayıt olun</a>
        </p>
      </div>

      {/* Trust signals below card */}
      <div className="relative z-10 flex items-center gap-6 mt-7">
        {[
          { icon: "🏢", label: "500+ Firma" },
          { icon: "🔒", label: "SSL Güvenli" },
          { icon: "⚡", label: "Anlık Eşleşme" },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-1.5">
            <span className="text-sm">{t.icon}</span>
            <span className="text-xs text-slate-500 font-medium">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
