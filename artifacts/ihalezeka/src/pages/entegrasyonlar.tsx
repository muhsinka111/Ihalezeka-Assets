import { useState } from "react";
import { useListApiKeys, useCreateApiKey, useDeleteApiKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTrash, IconCheck, IconPlus, IconLock, IconPlugConnected, IconWebhook, IconKey } from "@tabler/icons-react";

const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI (GPT-4o)", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { id: "gemini", label: "Google Gemini", placeholder: "AIza..." },
];

const DATA_SOURCES = [
  { id: "ekap", label: "EKAP (Kamu İhale Kurumu)", active: true },
  { id: "kibis", label: "KİBİS Sistemi", active: false },
  { id: "turkstat", label: "TÜİK Veri Servisi", active: false },
  { id: "hazine", label: "Hazine Banka Verileri", active: false },
];

export default function EntegrasyonlarPage() {
  const { data: keys, isLoading, refetch } = useListApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const saveKey = async (provider: string) => {
    const key = inputs[provider];
    if (!key?.trim()) return;
    setSaving(provider);
    await createMutation.mutateAsync({ data: { provider: provider as any, key } });
    setSaving(null);
    setSaved(provider);
    setInputs((p) => ({ ...p, [provider]: "" }));
    setTimeout(() => setSaved(null), 2500);
    refetch();
  };

  const deleteKey = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    refetch();
  };

  const keysByProvider = (provider: string) => (keys ?? []).filter((k: any) => k.provider === provider);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Entegrasyonlar</h1>
        <p className="text-muted-foreground text-sm">Yapay zeka API anahtarları, veri kaynakları ve otomasyon bağlantıları.</p>
      </div>

      {/* AI API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconKey className="h-5 w-5 text-primary" /> Yapay Zeka API Anahtarları
          </CardTitle>
          <CardDescription>Kendi anahtarlarınızla GPT-4o, Claude veya Gemini kullanın.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <Skeleton className="h-32 w-full" /> : AI_PROVIDERS.map((p) => {
            const existing = keysByProvider(p.id);
            return (
              <div key={p.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{p.label}</Label>
                  {existing.length > 0 && <Badge variant="outline" className="text-emerald-600 border-emerald-200">Bağlı</Badge>}
                </div>
                {existing.map((k: any) => (
                  <div key={k.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <IconLock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm flex-1 text-muted-foreground">{k.maskedKey}</span>
                    <span className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString("tr-TR")}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteKey(k.id)}>
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={p.placeholder}
                    value={inputs[p.id] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    onClick={() => saveKey(p.id)}
                    disabled={!inputs[p.id]?.trim() || saving === p.id}
                    className="gap-2 shrink-0"
                  >
                    {saved === p.id ? <><IconCheck className="h-4 w-4 text-emerald-500" />Kaydedildi</> : saving === p.id ? "Kaydediliyor…" : <><IconPlus className="h-4 w-4" />Ekle</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconPlugConnected className="h-5 w-5 text-primary" /> Veri Kaynakları
          </CardTitle>
          <CardDescription>İhale verilerinin toplandığı sistemler. EKAP her zaman aktiftir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DATA_SOURCES.map((src) => (
            <div key={src.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium text-sm">{src.label}</p>
                <p className="text-xs text-muted-foreground">{src.active ? "Bağlı ve aktif" : "Yakında kullanılabilir"}</p>
              </div>
              <div className="flex items-center gap-3">
                {!src.active && <Badge variant="outline" className="text-xs">Yakında</Badge>}
                <Switch checked={src.active} disabled={!src.active} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconWebhook className="h-5 w-5 text-primary" /> Webhook & REST API
          </CardTitle>
          <CardDescription>Zapier, Make veya kendi sistemlerinizle entegre edin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">İhaleZeka REST API</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">https://api.ihalezeka.com/v1</p>
            </div>
            <Badge variant="outline">Yakında</Badge>
          </div>
          <div className="mt-3 p-4 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Zapier Entegrasyonu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Yeni ihale eşleşmesinde otomatik akış tetikleyin</p>
            </div>
            <Badge variant="outline">Yakında</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
