import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInForm() {
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLocation("/ihale-arama");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1 font-heading">Hoş Geldiniz</h2>
      <p className="text-slate-500 text-sm mb-6">Hesabınıza giriş yapın</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signin-email">E-posta</Label>
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-10 rounded-lg border-[#e2e8f0] bg-[#f8fafc]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signin-password">Şifre</Label>
          <Input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-10 rounded-lg border-[#e2e8f0] bg-[#f8fafc]"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg font-semibold bg-[#2D5BFF] hover:bg-[#1E45D6]"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </Button>
      </form>
      <p className="text-sm text-slate-500 mt-4 text-center">
        Hesabınız yok mu?{" "}
        <a href={`${basePath}/sign-up`} className="text-[#2D5BFF] hover:text-[#1E45D6] font-semibold">
          Kayıt olun
        </a>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const { signUp } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    setLoading(true);
    const result = await signUp(email, password, name || undefined);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLocation("/ayarlar?tab=sirket");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1 font-heading">Hesap Oluşturun</h2>
      <p className="text-slate-500 text-sm mb-6">Hemen kullanmaya başlayın</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Ad Soyad</Label>
          <Input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="h-10 rounded-lg border-[#e2e8f0] bg-[#f8fafc]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-email">E-posta</Label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-10 rounded-lg border-[#e2e8f0] bg-[#f8fafc]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Şifre</Label>
          <Input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="h-10 rounded-lg border-[#e2e8f0] bg-[#f8fafc]"
          />
          <p className="text-xs text-slate-400">En az 8 karakter.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg font-semibold bg-[#2D5BFF] hover:bg-[#1E45D6]"
        >
          {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
        </Button>
      </form>
      <p className="text-sm text-slate-500 mt-4 text-center">
        Zaten hesabınız var mı?{" "}
        <a href={`${basePath}/sign-in`} className="text-[#2D5BFF] hover:text-[#1E45D6] font-semibold">
          Giriş yapın
        </a>
      </p>
    </div>
  );
}
