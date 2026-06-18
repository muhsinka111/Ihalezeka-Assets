import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconSend,
  IconRobot,
  IconUser,
  IconFileText,
  IconCopy,
  IconCheck,
  IconX,
  IconChevronDown,
  IconArrowBackUp,
  IconSparkles,
} from "@tabler/icons-react";
import { useAiChat } from "@/hooks/useAiChat";
import { useGetDashboardTopMatches } from "@workspace/api-client-react";

const INITIAL_PROPOSAL = `# Teklif Mektubu

**Konu:** Hizmet Alımı Teklifi

Sayın İhale Komisyonu,

Şirketimiz **Teknova Bilişim A.Ş.**, yukarıda belirtilen ihale kapsamındaki hizmetleri sunmak için hazırladığımız teklifimizi sunmaktan memnuniyet duyarız.

## Firma Tanıtımı
2012 yılından bu yana faaliyet gösteren şirketimiz, kurumsal bilişim hizmetleri alanında 42 uzman çalışanı ile öncü konumdadır. ISO 9001:2015 ve ISO 27001:2013 sertifikalarına sahip firmamız, 60'ı aşkın kamu kurumuna başarıyla hizmet vermiştir.

## Teknik Yaklaşımımız
Proje kapsamı ve teknik şartnameye tam uyum sağlayacak biçimde tasarlanan hizmet modelimiz aşağıdaki bileşenleri içermektedir:

1. **Proje Yönetimi:** Deneyimli proje yöneticisi koordinasyonunda haftalık ilerleme raporları
2. **Teknik Uygulama:** Mevcut altyapıyla kesintisiz entegrasyon
3. **Kalite Güvencesi:** Her aşamada bağımsız kalite kontrol
4. **Destek & Eğitim:** 7/24 teknik destek ve kullanıcı eğitimleri

## Fiyat Teklifi
Teklifimiz sözleşme süresince sabit birim fiyat esasına dayanmaktadır. Detaylı birim fiyat listesi ektedir.

## Sonuç
Şirketimizin deneyimi, teknik kapasitesi ve güçlü referanslarıyla bu hizmeti en üst kalitede sunacağımıza dair taahhüdümüzü bildiririz.

Saygılarımızla,
**Teknova Bilişim A.Ş.**`;

export default function TeklifOlusturucuPage() {
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState(INITIAL_PROPOSAL);
  const [previousProposal, setPreviousProposal] = useState<string | null>(null);
  const [patchApplied, setPatchApplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: topMatchesRaw } = useGetDashboardTopMatches();
  const topMatches = Array.isArray(topMatchesRaw) ? topMatchesRaw : [];

  const selectedMatch = useMemo(
    () => topMatches.find((m: any) => m.id === selectedMatchId) ?? (topMatches[0] as any ?? null),
    [topMatches, selectedMatchId]
  );

  const aiContext = useMemo(() => {
    if (!selectedMatch) return { mode: "proposal" as const, currentDraft: proposal };
    return {
      mode: "proposal" as const,
      currentDraft: proposal,
      tender: {
        title: selectedMatch.tender?.title ?? undefined,
        agency: selectedMatch.tender?.agencyName ?? undefined,
        estimatedValue: selectedMatch.tender?.estimatedValue ?? null,
        deadline: selectedMatch.tender?.deadline ?? null,
        aiSummary: selectedMatch.tender?.aiSummary ?? null,
        type: selectedMatch.tender?.tenderType ?? null,
      },
    };
  }, [selectedMatch, proposal]);

  const handleProposalPatch = useCallback((newDraft: string) => {
    setPreviousProposal((prev) => prev ?? proposal);
    setProposal(newDraft);
    setPatchApplied(true);

    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(() => {
      setPatchApplied(false);
      setPreviousProposal(null);
    }, 30000);
  }, [proposal]);

  const handleUndo = useCallback(() => {
    if (previousProposal !== null) {
      setProposal(previousProposal);
      setPreviousProposal(null);
      setPatchApplied(false);
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    }
  }, [previousProposal]);

  const { messages, isStreaming, elapsedMs, streamDone, sendMessage, cancelStream } = useAiChat(
    "Merhaba! Teklif taslağınızı birlikte hazırlayalım. \"Fiyat bölümünü güncelle\", \"giriş paragrafını yaz\" gibi komutlarla taslağı doğrudan düzenleyebilirsiniz.",
    aiContext,
    handleProposalPatch
  );

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (topMatches.length > 0 && !selectedMatchId) {
      setSelectedMatchId((topMatches[0] as any).id);
    }
  }, [topMatches, selectedMatchId]);

  useEffect(() => {
    return () => {
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const copyProposal = () => {
    navigator.clipboard.writeText(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Teklif Oluşturucu</h1>
          <p className="text-muted-foreground text-sm">Yapay zeka ile teklif taslağınızı oluşturun ve düzenleyin.</p>
        </div>
      </div>

      {/* Tender selector */}
      {topMatches.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-lg">
          <IconChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground shrink-0">Aktif İhale:</span>
          <Select value={selectedMatchId || (topMatches[0] as any)?.id} onValueChange={setSelectedMatchId}>
            <SelectTrigger className="h-8 text-sm max-w-[480px]">
              <SelectValue placeholder="İhale seçin…" />
            </SelectTrigger>
            <SelectContent>
              {topMatches.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-medium">{m.tender?.title}</span>
                  <span className="text-muted-foreground ml-2 text-xs">— {m.tender?.agencyName} · %{m.fitScore} uyum</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMatch && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {selectedMatch.tender?.estimatedValue && (
                <Badge variant="secondary" className="text-xs">
                  ₺{(selectedMatch.tender.estimatedValue / 1_000_000).toFixed(1)}M
                </Badge>
              )}
              {selectedMatch.tender?.deadline && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  Son: {new Date(selectedMatch.tender.deadline).toLocaleDateString("tr-TR")}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
        {/* Chat */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconRobot className="h-5 w-5 text-primary" />
              Yapay Zeka Asistanı
              {selectedMatch && (
                <span className="text-xs font-normal text-muted-foreground truncate max-w-[180px]">
                  — {selectedMatch.tender?.title}
                </span>
              )}
              {elapsedMs !== null && (
                <span className={`ml-auto text-[11px] text-muted-foreground transition-opacity duration-500 ${streamDone ? "opacity-60" : "opacity-100"}`}>
                  {isStreaming ? `yanıtlanıyor… ${(elapsedMs / 1000).toFixed(1)}s` : `${(elapsedMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                  {msg.role === "user" ? <IconUser className="h-4 w-4" /> : <IconRobot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none"}`}>
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-flex gap-0.5 ml-1 align-middle">
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEnd} />
          </CardContent>
          <div className="p-4 border-t flex gap-2">
            <Input
              placeholder="Teklif hakkında bir şey sorun…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSend()}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={cancelStream} title="Durdur">
                <IconX className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                <IconSend className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        {/* Preview */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconFileText className="h-5 w-5 text-primary" />
                Teklif Önizlemesi
              </CardTitle>
              <div className="flex items-center gap-2">
                {patchApplied && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                      <IconSparkles className="h-3 w-3" />
                      AI güncelledi
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={handleUndo}
                    >
                      <IconArrowBackUp className="h-3 w-3" />
                      Geri Al
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="gap-2" onClick={copyProposal}>
                  {copied ? <IconCheck className="h-4 w-4 text-emerald-500" /> : <IconCopy className="h-4 w-4" />}
                  {copied ? "Kopyalandı" : "Kopyala"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            <Textarea
              value={proposal}
              onChange={(e) => {
                setProposal(e.target.value);
                setPatchApplied(false);
                setPreviousProposal(null);
              }}
              className="w-full h-full min-h-[400px] font-mono text-xs leading-relaxed resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </CardContent>
          <div className="p-4 border-t flex gap-2">
            <Button className="flex-1">Teklifi Kaydet</Button>
            <Button variant="outline">PDF İndir</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
