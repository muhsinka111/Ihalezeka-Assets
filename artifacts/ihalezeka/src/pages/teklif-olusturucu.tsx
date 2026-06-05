import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IconSend, IconRobot, IconUser, IconFileText, IconCopy, IconCheck, IconX } from "@tabler/icons-react";
import { useAiChat } from "@/hooks/useAiChat";

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
  const [copied, setCopied] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, sendMessage, cancelStream } = useAiChat(
    "Merhaba! Teklif taslağınızı birlikte hazırlayalım. Teknik yaklaşım, referans projeler veya fiyat stratejisi hakkında sorularınızı yazabilirsiniz.",
    { mode: "proposal" }
  );

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        <Badge variant="outline" className="text-primary border-primary/30">BETA</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-220px)]">
        {/* Chat */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconRobot className="h-5 w-5 text-primary" />
              Yapay Zeka Asistanı
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
              <Button variant="ghost" size="sm" className="gap-2" onClick={copyProposal}>
                {copied ? <IconCheck className="h-4 w-4 text-emerald-500" /> : <IconCopy className="h-4 w-4" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            <Textarea
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
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
