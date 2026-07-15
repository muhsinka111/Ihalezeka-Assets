import { useState } from "react";
import { useLocation } from "wouter";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function AdminLogin() {
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/admin/dev-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Giriş başarısız");
      }
      await refresh();
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2D5BFF]/10 text-[#2D5BFF]">
        <Shield className="w-6 h-6" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Hoş Geldiniz</h3>
        <p className="text-sm text-slate-500">Sayın admin, hızlı erişim</p>
      </div>

      <div className="w-full space-y-2 text-sm">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500">E-posta</span>
          <span className="font-medium text-slate-900">admin@admin.com</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-500">Yöntem</span>
          <span className="font-medium text-slate-900">Tek tıkla giriş</span>
        </div>
      </div>

      {error && (
        <div className="w-full px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full h-11 rounded-lg text-white font-semibold text-sm transition-colors disabled:opacity-50"
        style={{ background: "#2D5BFF" }}
      >
        {loading ? "Giriş yapılıyor..." : "Admin olarak giriş yap →"}
      </button>

      <a
        href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/sign-in`}
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        Normal giriş sayfasına dön
      </a>
    </div>
  );
}
