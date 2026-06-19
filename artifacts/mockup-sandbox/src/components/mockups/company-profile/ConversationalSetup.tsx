import React, { useState, useRef, useEffect } from "react";
import { 
  Building, 
  Send, 
  Bot, 
  User, 
  Check, 
  ChevronRight, 
  MapPin, 
  FileText,
  BadgeCheck,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Mock Data & Helpers ---

const KEYWORD_LOOKUP = [
  {
    keywords: ["inşaat", "yol", "yapı", "müteahhit", "şantiye"],
    sektor: "İnşaat",
    naceCodes: ["41.20 - İkamet amaçlı bina inşaatı", "42.11 - Kara yolları ve otoyolların inşaatı"],
    cpvCodes: ["45000000 - İnşaat işleri", "45233000 - Yapım, onarım ve hazırlık işleri"]
  },
  {
    keywords: ["yazılım", "bilişim", "yazilim", "bt", "bilgisayar", "sistem", "kod"],
    sektor: "Bilgi Teknolojileri",
    naceCodes: ["62.01 - Bilgisayar programlama faaliyetleri", "62.02 - Bilgisayar danışmanlık faaliyetleri"],
    cpvCodes: ["72000000 - BT hizmetleri: danışmanlık, yazılım geliştirme", "48000000 - Yazılım paketleri ve bilgi sistemleri"]
  },
  {
    keywords: ["tıbbi", "medikal", "sağlık", "hastane", "cihaz"],
    sektor: "Sağlık / Medikal",
    naceCodes: ["46.46 - Eczacılık ürünlerinin toptan ticareti", "32.50 - Tıbbi ve dişçilik ile ilgili araç gereç imalatı"],
    cpvCodes: ["33000000 - Tıbbi cihazlar, farmasötikler", "33100000 - Tıbbi donanımlar"]
  },
  {
    keywords: ["temizlik", "hijyen", "bakım", "tesis", "yönetim"],
    sektor: "Tesis Yönetimi",
    naceCodes: ["81.21 - Binaların genel temizliği", "81.22 - Binaların endüstriyel temizliği"],
    cpvCodes: ["90910000 - Temizlik hizmetleri", "90911200 - Bina temizleme hizmetleri"]
  },
  {
    keywords: ["gıda", "yemek", "catering", "mutfak", "restoran", "yiyecek"],
    sektor: "Gıda / Catering",
    naceCodes: ["56.29 - Diğer yiyecek hizmeti faaliyetleri", "10.89 - Diğer gıda maddelerinin imalatı"],
    cpvCodes: ["55500000 - Kantin ve catering hizmetleri", "15000000 - Yiyecek, içecek, tütün ve benzeri"]
  }
];

const PROVINCES = ["Ankara", "İstanbul", "İzmir", "Bursa", "Antalya", "Adana", "Konya"];
const CERTS = ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "TSE", "CE"];

// --- Types ---

type MessageType = "ai" | "user" | "ai_widget";

interface Message {
  id: string;
  type: MessageType;
  text?: string;
  widgetType?: "guessing" | "structured_fields" | "completed";
  widgetData?: any;
}

interface ProfileState {
  companyName: string;
  taxNumber: string;
  annualRevenue: string;
  personnelCount: string;
  experienceCeiling: string;
  certifications: string[];
  naceCodes: string[];
  cpvCodes: string[];
  preferredProvinces: string[];
  aiBrief: string;
  sektor: string;
}

// --- Component ---

export function ConversationalSetup() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      text: "Merhaba! Ben İhaleZeka asistanınız. Size en isabetli ihale eşleşmelerini sunabilmem için firmanızı biraz tanımam gerekiyor.\n\nBana kısaca ne iş yaptığınızdan, kaç yıllık deneyiminiz olduğundan ve öne çıkan özelliklerinizden bahsedebilir misiniz?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [profile, setProfile] = useState<ProfileState>({
    companyName: "Acme A.Ş.", // Pre-filled basics
    taxNumber: "1234567890",
    annualRevenue: "",
    personnelCount: "",
    experienceCeiling: "",
    certifications: [],
    naceCodes: [],
    cpvCodes: [],
    preferredProvinces: [],
    aiBrief: "",
    sektor: ""
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const userText = inputValue;
    const newUserMsg: Message = { id: Date.now().toString(), type: "user", text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue("");
    setProfile(prev => ({ ...prev, aiBrief: prev.aiBrief ? prev.aiBrief + "\n" + userText : userText }));
    
    setIsTyping(true);
    
    setTimeout(() => {
      processAiResponse(userText);
    }, 1500);
  };

  const processAiResponse = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Check for industry keywords
    let matchedGroup = KEYWORD_LOOKUP.find(group => 
      group.keywords.some(kw => lowerText.includes(kw))
    );

    setIsTyping(false);

    if (matchedGroup && !profile.sektor) {
      // First time matching industry
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          type: "ai",
          text: `Harika! Anladığım kadarıyla "${matchedGroup.sektor}" sektöründe faaliyet gösteriyorsunuz. Sizin için muhtemel NACE ve CPV kodlarını çıkardım.`
        },
        {
          id: (Date.now() + 1).toString(),
          type: "ai_widget",
          widgetType: "guessing",
          widgetData: matchedGroup
        }
      ]);
    } else if (profile.sektor && !profile.annualRevenue) {
      // Ask for structured data if we have sector but no financials
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          type: "ai",
          text: "Teşekkürler, bağlamı kaydettim. Yapay zekanın mali kapasite kriterlerini daha iyi eleyebilmesi için birkaç rakamsal ve resmi veriye daha ihtiyacımız var."
        },
        {
          id: (Date.now() + 1).toString(),
          type: "ai_widget",
          widgetType: "structured_fields"
        }
      ]);
    } else {
      // Generic acknowledgment
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          type: "ai",
          text: "Not aldım. Bu bilgiler eşleşme algoritmamızı daha hassas hale getirecek. Başka eklemek istediğiniz bir detay var mı?"
        }
      ]);
    }
  };

  const confirmGuess = (group: any) => {
    setProfile(prev => ({
      ...prev,
      sektor: group.sektor,
      naceCodes: [...new Set([...prev.naceCodes, ...group.naceCodes])],
      cpvCodes: [...new Set([...prev.cpvCodes, ...group.cpvCodes])]
    }));
    
    toast.success("Sektör bilgileri profile eklendi");
    
    setMessages(prev => [
      ...prev, 
      {
        id: Date.now().toString(),
        type: "ai",
        text: "Kodlarınızı onayladınız. Şimdi mali kapasite ve operasyonel büyüklüğünüzle ilgili birkaç detaya geçelim."
      },
      {
        id: (Date.now() + 1).toString(),
        type: "ai_widget",
        widgetType: "structured_fields"
      }
    ]);
  };

  const saveStructured = (data: any) => {
    setProfile(prev => ({ ...prev, ...data }));
    toast.success("Bilgiler kaydedildi");
    
    setMessages(prev => [
      ...prev, 
      {
        id: Date.now().toString(),
        type: "ai_widget",
        widgetType: "completed"
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Left Chat Area */}
      <div className="flex-1 flex flex-col h-full border-r bg-white relative">
        <header className="px-6 py-4 border-b bg-white z-10">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            Yapay zekanın sizi daha iyi tanımasını sağlayın
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ne kadar çok bilgi verirseniz, o kadar isabetli ihale eşleşmeleri alırsınız.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={cn(
              "flex max-w-3xl",
              msg.type === "user" ? "ml-auto justify-end" : ""
            )}>
              {msg.type === "ai" && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-indigo-600" />
                </div>
              )}
              
              <div className={cn(
                "rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed",
                msg.type === "user" 
                  ? "bg-indigo-600 text-white rounded-br-none" 
                  : "bg-slate-100 text-slate-800 rounded-tl-none",
                msg.type === "ai_widget" ? "bg-transparent p-0 w-full ml-11" : ""
              )}>
                {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
                
                {msg.widgetType === "guessing" && msg.widgetData && (
                  <Card className="border-indigo-100 shadow-sm overflow-hidden">
                    <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                      <BadgeCheck className="w-5 h-5 text-indigo-600" />
                      <span className="font-medium text-indigo-900">Şunları algıladım — onaylıyor musunuz?</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Önerilen Sektör</div>
                        <Badge variant="secondary" className="bg-white border-slate-200 text-slate-800 text-sm px-3 py-1">
                          {msg.widgetData.sektor}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Muhtemel NACE Kodları</div>
                          <div className="space-y-2">
                            {msg.widgetData.naceCodes.map((code: string, i: number) => (
                              <div key={i} className="text-sm bg-slate-50 border border-slate-100 rounded-md p-2 text-slate-700">
                                {code}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Muhtemel CPV Kodları</div>
                          <div className="space-y-2">
                            {msg.widgetData.cpvCodes.map((code: string, i: number) => (
                              <div key={i} className="text-sm bg-slate-50 border border-slate-100 rounded-md p-2 text-slate-700">
                                {code}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-2 flex justify-end gap-2">
                        <Button variant="outline" size="sm">Düzenle</Button>
                        <Button size="sm" onClick={() => confirmGuess(msg.widgetData)} className="bg-indigo-600 hover:bg-indigo-700">
                          <Check className="w-4 h-4 mr-2" />
                          Evet, Onaylıyorum
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {msg.widgetType === "structured_fields" && (
                  <Card className="border-slate-200 shadow-sm w-full max-w-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Mali ve Operasyonel Bilgiler</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Yıllık Ciro (₺)</label>
                        <Input placeholder="Örn: 15.000.000" className="bg-white" id="ciro-input" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Personel Sayısı</label>
                        <Input placeholder="Örn: 45" className="bg-white" id="personel-input" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">İş Deneyim Tavanı (₺)</label>
                        <Input placeholder="Örn: 50.000.000" className="bg-white" id="tavan-input" />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          const ciro = (document.getElementById('ciro-input') as HTMLInputElement)?.value || "15.000.000";
                          const personel = (document.getElementById('personel-input') as HTMLInputElement)?.value || "45";
                          const tavan = (document.getElementById('tavan-input') as HTMLInputElement)?.value || "50.000.000";
                          saveStructured({ annualRevenue: ciro, personnelCount: personel, experienceCeiling: tavan });
                        }}
                      >
                        Bilgileri Kaydet
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {msg.widgetType === "completed" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                      <Check className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-medium text-green-900 mb-1">Harika! Profiliniz Hazır</h3>
                    <p className="text-green-700 text-sm mb-4">
                      Yapay zeka artık firmanızı tanıyor. Size en uygun ihaleleri çok daha yüksek isabetle eşleştirebiliriz.
                    </p>
                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                      Eşleşmelere Git
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 shrink-0 mt-1">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-none px-5 py-4 flex gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t">
          <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Firmanızdan bahsedin (örn: '15 yıldır yol yapımı işleri yapıyoruz...')"
              className="resize-none min-h-[60px] max-h-[150px] bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-xl pr-12 text-[15px]"
              rows={1}
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="absolute right-2 bottom-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-all h-9 w-9"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-center mt-2">
            <span className="text-[11px] text-slate-400 font-medium">İpucu: Sektörünüzü ve ne ürettiğinizi/sattığınızı açıkça yazın.</span>
          </div>
        </div>
      </div>

      {/* Right Summary Panel */}
      <div className="w-full md:w-[380px] bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b bg-white shrink-0">
          <h2 className="font-semibold flex items-center gap-2 text-slate-800">
            <User className="w-4 h-4 text-slate-400" />
            Algılanan Profil
          </h2>
        </div>
        <ScrollArea className="flex-1 p-5">
          <div className="space-y-6">
            
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{profile.companyName}</h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5" /> 
                    VKN: {profile.taxNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Brief Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapay Zeka Bağlamı</h4>
              <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm text-slate-600 leading-relaxed min-h-[60px] italic">
                {profile.aiBrief ? `"${profile.aiBrief}"` : <span className="text-slate-400 not-italic">Henüz bir bağlam oluşturulmadı. Sohbet alanından firmanızı anlatın.</span>}
              </div>
            </div>

            {/* Sector & Codes */}
            {profile.sektor && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sektör</h4>
                  <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 font-medium px-2.5 py-1">
                    {profile.sektor}
                  </Badge>
                </div>
                
                {profile.naceCodes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                      NACE Kodları
                      <button className="text-indigo-600 hover:text-indigo-700 capitalize text-[10px] flex items-center">
                        Düzenle
                      </button>
                    </h4>
                    <div className="space-y-1.5">
                      {profile.naceCodes.map((code, i) => (
                        <div key={i} className="text-[13px] bg-white border border-slate-200 rounded p-1.5 px-2.5 text-slate-700 truncate" title={code}>
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {profile.cpvCodes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                      CPV Kodları
                      <button className="text-indigo-600 hover:text-indigo-700 capitalize text-[10px] flex items-center">
                        Düzenle
                      </button>
                    </h4>
                    <div className="space-y-1.5">
                      {profile.cpvCodes.map((code, i) => (
                        <div key={i} className="text-[13px] bg-white border border-slate-200 rounded p-1.5 px-2.5 text-slate-700 truncate" title={code}>
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financials */}
            {profile.annualRevenue && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kapasite</h4>
                <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm divide-y divide-slate-100">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Yıllık Ciro:</span>
                    <span className="font-medium text-slate-900">{profile.annualRevenue} ₺</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Personel:</span>
                    <span className="font-medium text-slate-900">{profile.personnelCount} Kişi</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Deneyim Tavanı:</span>
                    <span className="font-medium text-slate-900">{profile.experienceCeiling} ₺</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Call to action for empty state */}
            {!profile.annualRevenue && (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 mt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Profiliniz Eksik</p>
                    <p className="opacity-90 leading-relaxed">Yapay zeka asistanı ile sohbet ederek profilinizi zenginleştirin ve ihale eşleşme oranınızı artırın.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </div>

    </div>
  );
}
