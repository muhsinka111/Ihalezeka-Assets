import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconBell,
  IconMail,
  IconCheck,
  IconSend,
  IconAlertCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NotificationPrefs {
  id?: number;
  businessId?: string;
  emailEnabled: boolean;
  emailAddress: string | null;
  inAppEnabled: boolean;
  minFitScore: number;
  sources: string[];
  categories: string[];
}

interface EmailStatus {
  configured: boolean;
  provider: "resend" | "smtp" | null;
}

async function loadPrefs(): Promise<NotificationPrefs> {
  const res = await fetch(`${BASE}/api/notification-preferences`);
  if (!res.ok) return { emailEnabled: false, emailAddress: null, inAppEnabled: true, minFitScore: 60, sources: ["ekap", "ilan_gov"], categories: [] };
  return res.json();
}

async function savePrefs(prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const res = await fetch(`${BASE}/api/notification-preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  return res.json();
}

async function loadEmailStatus(): Promise<EmailStatus> {
  const res = await fetch(`${BASE}/api/email-status`);
  if (!res.ok) return { configured: false, provider: null };
  return res.json();
}

async function sendTestEmail(): Promise<{ ok: boolean; error?: string; to?: string }> {
  const res = await fetch(`${BASE}/api/notification-preferences/test-email`, { method: "POST" });
  const body = await res.json();
  if (!res.ok) return { ok: false, error: body.error ?? "Bilinmeyen hata" };
  return { ok: true, to: body.to };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const SCORE_OPTIONS = [
  { value: 40, label: "40+", desc: "Çoğu eşleşme" },
  { value: 60, label: "60+", desc: "İyi eşleşmeler" },
  { value: 75, label: "75+", desc: "Yalnızca güçlü eşleşmeler" },
  { value: 90, label: "90+", desc: "Yalnızca mükemmel eşleşmeler" },
];

const SOURCE_OPTIONS = [
  { value: "ekap", label: "EKAP", desc: "Kamu İhale Kurumu" },
  { value: "ilan_gov", label: "İlan.gov.tr", desc: "Devlet ilanları" },
];

const CATEGORY_OPTIONS = [
  { value: "Yapım", label: "Yapım İşleri", desc: "İnşaat ve yapım projeleri" },
  { value: "Mal Alımı", label: "Mal Alımı", desc: "Ekipman ve malzeme" },
  { value: "Hizmet Alımı", label: "Hizmet Alımı", desc: "Hizmet ihaleleri" },
  { value: "Danışmanlık", label: "Danışmanlık", desc: "Danışmanlık hizmetleri" },
  { value: "İhale", label: "Genel İhale", desc: "Diğer ihale türleri" },
];

export function NotificationPrefsModal({ open, onClose }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailEnabled: false,
    emailAddress: null,
    inAppEnabled: true,
    minFitScore: 60,
    sources: ["ekap", "ilan_gov"],
    categories: [],
  });
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (open) {
      loadPrefs().then(setPrefs);
      loadEmailStatus().then(setEmailStatus);
      setSaved(false);
      setTestState("idle");
      setTestMessage("");
    }
  }, [open]);

  const toggleSource = (src: string) => {
    setPrefs((p) => ({
      ...p,
      sources: p.sources.includes(src)
        ? p.sources.filter((s) => s !== src)
        : [...p.sources, src],
    }));
  };

  const toggleCategory = (cat: string) => {
    setPrefs((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    await savePrefs({
      emailEnabled: prefs.emailEnabled,
      emailAddress: prefs.emailAddress || undefined,
      inAppEnabled: prefs.inAppEnabled,
      minFitScore: prefs.minFitScore,
      sources: prefs.sources,
      categories: prefs.categories,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleTestEmail = async () => {
    if (!prefs.emailAddress) return;
    setTestState("sending");
    setTestMessage("");
    const result = await sendTestEmail();
    if (result.ok) {
      setTestState("sent");
      setTestMessage(`Test e-postası ${result.to ?? prefs.emailAddress} adresine gönderildi`);
    } else {
      setTestState("error");
      setTestMessage(result.error ?? "Gönderim başarısız");
    }
  };

  const providerLabel =
    emailStatus?.provider === "resend"
      ? "Resend"
      : emailStatus?.provider === "smtp"
      ? "SMTP"
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <IconBell className="h-5 w-5 text-primary" />
            Bildirim Tercihleri
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* In-app notifications */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Uygulama Bildirimleri</p>
              <p className="text-xs text-muted-foreground mt-0.5">Yeni eşleşmeler için bildirim al</p>
            </div>
            <button
              onClick={() => setPrefs((p) => ({ ...p, inAppEnabled: !p.inAppEnabled }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                prefs.inAppEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                prefs.inAppEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {/* Email notifications */}
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                  E-posta Bildirimleri
                </p>
                {emailStatus ? (
                  emailStatus.configured ? (
                    <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                      <IconCircleCheck className="h-3 w-3" />
                      {providerLabel} üzerinden aktif
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <IconAlertCircle className="h-3 w-3" />
                      E-posta sağlayıcısı yapılandırılmamış
                    </p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Durum kontrol ediliyor…</p>
                )}
              </div>
              <button
                onClick={() => setPrefs((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                  prefs.emailEnabled ? "bg-primary" : "bg-muted"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                  prefs.emailEnabled ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>
            {prefs.emailEnabled && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-posta Adresi</Label>
                  <Input
                    type="email"
                    placeholder="ornek@firma.com"
                    value={prefs.emailAddress ?? ""}
                    onChange={(e) => setPrefs((p) => ({ ...p, emailAddress: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                {prefs.emailAddress && emailStatus?.configured && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={testState === "sending"}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconSend className="h-3 w-3" />
                      {testState === "sending" ? "Gönderiliyor…" : "Test e-postası gönder"}
                    </button>
                    {testState === "sent" && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <IconCircleCheck className="h-3 w-3" />
                        {testMessage}
                      </p>
                    )}
                    {testState === "error" && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <IconAlertCircle className="h-3 w-3" />
                        {testMessage}
                      </p>
                    )}
                  </div>
                )}
                {prefs.emailEnabled && !emailStatus?.configured && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    E-posta göndermek için sunucuda <code className="font-mono">RESEND_API_KEY</code> ortam değişkenini ayarlayın.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Min fit score */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground">Minimum Uyum Skoru</p>
            <div className="grid grid-cols-2 gap-2">
              {SCORE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrefs((p) => ({ ...p, minFitScore: opt.value }))}
                  className={cn(
                    "px-3 py-2.5 rounded-lg border text-left transition-all",
                    prefs.minFitScore === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className="text-sm font-bold">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground">Kaynaklar</p>
            <div className="space-y-2">
              {SOURCE_OPTIONS.map((src) => {
                const active = prefs.sources.includes(src.value);
                return (
                  <button
                    key={src.value}
                    onClick={() => toggleSource(src.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold">{src.label}</div>
                      <div className="text-[11px] text-muted-foreground">{src.desc}</div>
                    </div>
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      active ? "border-primary bg-primary" : "border-muted-foreground"
                    )}>
                      {active && <IconCheck className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">İhale Kategorileri</p>
              <p className="text-xs text-muted-foreground mt-0.5">Boş bırakırsanız tüm kategoriler dahil edilir</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const active = prefs.categories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40 hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>İptal</Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {saved ? (
              <>
                <IconCheck className="h-4 w-4" />
                Kaydedildi
              </>
            ) : loading ? (
              "Kaydediliyor..."
            ) : (
              "Kaydet"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
