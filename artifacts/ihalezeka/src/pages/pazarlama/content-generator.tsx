import React, { useState } from "react";
import {
  IconSparkles,
  IconLoader2,
  IconBrandLinkedin,
  IconBrandX,
  IconBrandFacebook,
  IconBrandYoutube,
  IconBrandInstagram,
  IconPhoto,
  IconFileText,
  IconShare,
  IconDeviceFloppy,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const TOPIC_PRESETS = [
  "Platformu tanıtın",
  "AI eşleştirme nasıl çalışır?",
  "Haftanın öne çıkan ihaleleri",
  "KOBİ'ler için ihale rehberi",
  "Kamu alımlarında dijital dönüşüm",
  "İhale kazanma stratejileri",
];

const PLATFORMS = [
  { key: "linkedin", name: "LinkedIn", icon: IconBrandLinkedin, color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10", border: "border-[#0A66C2]/30" },
  { key: "twitter", name: "X / Twitter", icon: IconBrandX, color: "text-foreground", bg: "bg-foreground/10", border: "border-border" },
  { key: "facebook", name: "Facebook", icon: IconBrandFacebook, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10", border: "border-[#1877F2]/30" },
  { key: "instagram", name: "Instagram", icon: IconBrandInstagram, color: "text-[#E1306C]", bg: "bg-[#E1306C]/10", border: "border-[#E1306C]/30" },
  { key: "youtube", name: "YouTube", icon: IconBrandYoutube, color: "text-[#FF0000]", bg: "bg-[#FF0000]/10", border: "border-[#FF0000]/30" },
];

interface GeneratedContent {
  caption: string;
  blogTitle: string;
  blogBody: string;
  imagePrompt: string;
  imageUrl: string | null;
  metaDescription: string;
}

export default function ContentGeneratorPage() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("linkedin");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const [editedBlogBody, setEditedBlogBody] = useState("");

  async function handleGenerate() {
    const topic = customTopic || selectedTopic;
    if (!topic) return;

    setIsGenerating(true);
    setError(null);
    setGenerated(null);
    setSaved(false);

    try {
      const res = await fetch(`${API_BASE}/marketing/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, customTopic, platform: selectedPlatform }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string; detail?: string };
        throw new Error(err.detail ?? err.error ?? "İçerik üretimi başarısız oldu");
      }

      const data = await res.json() as GeneratedContent;
      setGenerated(data);
      setEditedCaption(data.caption);
      setEditedBlogBody(data.blogBody);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave(status: "draft" | "published") {
    if (!generated) return;
    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE}/marketing/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generated.blogTitle,
          body: editedCaption,
          blogBody: editedBlogBody,
          imageUrl: generated.imageUrl,
          imagePrompt: generated.imagePrompt,
          platforms: [selectedPlatform],
          status,
          topic: customTopic || selectedTopic,
          metaDescription: generated.metaDescription,
        }),
      });

      if (!res.ok) throw new Error("Kaydetme başarısız");
      setSaved(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  const topic = customTopic || selectedTopic;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">AI İçerik Üretici</h1>
        <p className="text-muted-foreground">Konu ve platform seçin, AI sizin için optimize edilmiş içerik oluştursun.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <IconSparkles className="h-4 w-4 text-[#2D5BFF]" />
            İçerik Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Konu Seçin</Label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_PRESETS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setSelectedTopic(t); setCustomTopic(""); }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    selectedTopic === t && !customTopic
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Veya özel konu yazın</Label>
            <Textarea
              placeholder="Örn: EKAP'ta yeni bir müşavir kadrosu ilanı çıktı, nasıl fırsata çevrilebilir?"
              value={customTopic}
              onChange={(e) => { setCustomTopic(e.target.value); setSelectedTopic(""); }}
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Hedef Platform</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const isSelected = selectedPlatform === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPlatform(p.key)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                      isSelected
                        ? `${p.bg} ${p.border} ${p.color} shadow-sm`
                        : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? p.color : ""}`} />
                    <span className="text-xs">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!topic || isGenerating}
            className="gap-2 w-full sm:w-auto"
          >
            {isGenerating ? (
              <><IconLoader2 className="h-4 w-4 animate-spin" />Üretiliyor…</>
            ) : (
              <><IconSparkles className="h-4 w-4" />İçerik Üret</>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="py-12 text-center">
            <IconLoader2 className="h-8 w-8 animate-spin text-[#2D5BFF] mx-auto mb-3" />
            <p className="text-sm font-medium">AI içerik üretiyor…</p>
            <p className="text-xs text-muted-foreground mt-1">Gönderi metni, blog yazısı ve görsel hazırlanıyor.</p>
          </CardContent>
        </Card>
      )}

      {generated && !isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Üretilen İçerik</h2>
            {saved && (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/25">
                <IconCheck className="h-3 w-3" />
                Kaydedildi
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconShare className="h-4 w-4 text-primary" />
                  Sosyal Medya Gönderisi
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {PLATFORMS.find((p) => p.key === selectedPlatform)?.name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedCaption}
                  onChange={(e) => setEditedCaption(e.target.value)}
                  className="min-h-[180px] text-sm resize-none font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">{editedCaption.length} karakter</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconPhoto className="h-4 w-4 text-emerald-500" />
                  Üretilen Görsel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generated.imageUrl ? (
                  <img
                    src={generated.imageUrl}
                    alt="Üretilen görsel"
                    className="w-full aspect-square object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-full aspect-square bg-muted rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2">
                    <IconPhoto className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Görsel üretilemedi</p>
                    {generated.imagePrompt && (
                      <p className="text-[11px] text-muted-foreground/70 px-4 text-center">{generated.imagePrompt}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <IconFileText className="h-4 w-4 text-blue-500" />
                Blog Yazısı
                <Badge variant="secondary" className="text-[10px] ml-auto">SEO</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Başlık</Label>
                <p className="text-sm font-semibold mt-0.5">{generated.blogTitle}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta Açıklama (SEO)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{generated.metaDescription}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">İçerik</Label>
                <Textarea
                  value={editedBlogBody}
                  onChange={(e) => setEditedBlogBody(e.target.value)}
                  className="min-h-[200px] text-xs resize-y font-mono"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleSave("draft")}
              disabled={isSaving || saved}
            >
              {isSaving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4" />}
              Taslak Kaydet
            </Button>
            <Button
              className="gap-2"
              onClick={() => handleSave("draft")}
              disabled={isSaving || saved}
            >
              {isSaving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconShare className="h-4 w-4" />}
              Takvime Ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
