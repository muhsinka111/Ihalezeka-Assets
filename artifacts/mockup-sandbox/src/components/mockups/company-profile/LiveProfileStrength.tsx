import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  Search,
  Plus,
  X,
  Target,
  FileText,
  BadgeCheck,
  MapPin,
  Save,
  Briefcase
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- MOCK DATA ---

const KEYWORD_SUGGESTIONS = [
  {
    keywords: ["inşaat", "yol", "yapı", "bina", "şantiye"],
    sektor: "İnşaat",
    nace: [{ code: "41.20", label: "İkamet amaçlı bina inşaatı" }, { code: "42.11", label: "Otoyol, tünel ve köprü inşaatı" }],
    cpv: [{ code: "45000000", label: "İnşaat işleri" }, { code: "45233000", label: "İnşaat, temel ve yüzey işleri" }]
  },
  {
    keywords: ["yazılım", "bilişim", "yazilim", "bilgisayar", "bt", "it"],
    sektor: "Bilgi Teknolojileri",
    nace: [{ code: "62.01", label: "Bilgisayar programlama faaliyetleri" }, { code: "62.02", label: "Bilgisayar danışmanlık faaliyetleri" }],
    cpv: [{ code: "72000000", label: "BT hizmetleri: danışmanlık, yazılım geliştirme" }, { code: "48000000", label: "Yazılım paketi ve bilişim sistemleri" }]
  },
  {
    keywords: ["tıbbi", "medikal", "sağlık", "hastane", "cihaz"],
    sektor: "Sağlık/Medikal",
    nace: [{ code: "46.46", label: "Cerrahi, tıbbi ve ortopedik alet" }, { code: "32.50", label: "Tıbbi ve dişçilik araç ve gereçleri" }],
    cpv: [{ code: "33000000", label: "Tıbbi cihazlar, farmasötikler" }, { code: "33100000", label: "Tıbbi donanımlar" }]
  },
  {
    keywords: ["temizlik", "hijyen", "çöp", "tesis"],
    sektor: "Tesis Yönetimi",
    nace: [{ code: "81.21", label: "Binaların genel temizliği" }, { code: "81.22", label: "Diğer bina ve endüstriyel temizlik" }],
    cpv: [{ code: "90910000", label: "Temizlik hizmetleri" }, { code: "90900000", label: "Temizlik ve sanitasyon hizmetleri" }]
  },
  {
    keywords: ["gıda", "yemek", "catering", "yiyecek", "içecek"],
    sektor: "Gıda/Catering",
    nace: [{ code: "56.29", label: "Diğer yiyecek hizmeti faaliyetleri" }, { code: "56.21", label: "Özel günlerde yiyecek sağlanması" }],
    cpv: [{ code: "55500000", label: "Kantin ve yemek sunum hizmetleri" }, { code: "15000000", label: "Yiyecek, içecek, tütün ve ilgili ürünler" }]
  }
];

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "TSE", "CE", "OHSAS 18001", "Mesleki Yeterlilik Belgesi",
];

const TR_PROVINCES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik",
  "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum",
  "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
  "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis",
  "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa",
  "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize",
  "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ",
  "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];

// --- HELPERS ---

function CircularProgress({ value, size = 120, strokeWidth = 10 }: { value: number, size?: number, strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  // Color transitions based on completion
  const getColor = () => {
    if (value < 30) return "stroke-destructive";
    if (value < 70) return "stroke-amber-500";
    if (value < 100) return "stroke-primary";
    return "stroke-green-500";
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${getColor()} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold font-mono tracking-tighter">{Math.round(value)}%</span>
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Doğruluk</span>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---

export function LiveProfileStrength() {
  const [data, setData] = useState({
    companyName: "",
    taxNumber: "",
    mersisNumber: "",
    ekapNumber: "",
    annualRevenue: "",
    personnelCount: "",
    experienceCeiling: "",
    certifications: [] as string[],
    naceCodes: [] as { code: string; label: string }[],
    cpvCodes: [] as { code: string; label: string }[],
    preferredProvinces: [] as string[],
    aiBrief: ""
  });

  const [aiKeywords, setAiKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  // Score calculation
  const scores = useMemo(() => {
    let total = 0;
    const max = 100;
    
    // Core info: 20%
    const hasCore = data.companyName && data.taxNumber;
    const coreScore = hasCore ? 20 : (data.companyName ? 10 : 0) + (data.taxNumber ? 10 : 0);
    
    // Financials: 15%
    const hasFinancials = data.annualRevenue || data.experienceCeiling;
    const finScore = hasFinancials ? 15 : 0;
    
    // Certs: 10%
    const certScore = data.certifications.length > 0 ? 10 : 0;
    
    // Domain Expertise (NACE/CPV): 30%
    const hasNace = data.naceCodes.length > 0;
    const hasCpv = data.cpvCodes.length > 0;
    const domainScore = (hasNace ? 15 : 0) + (hasCpv ? 15 : 0);
    
    // Location: 5%
    const locScore = data.preferredProvinces.length > 0 ? 5 : 0;
    
    // AI Brief: 20%
    const briefScore = data.aiBrief.length > 50 ? 20 : (data.aiBrief.length > 10 ? 10 : 0);
    
    return {
      core: coreScore,
      financials: finScore,
      certs: certScore,
      domain: domainScore,
      location: locScore,
      brief: briefScore,
      total: coreScore + finScore + certScore + domainScore + locScore + briefScore
    };
  }, [data]);

  // Suggestions based on AI Keywords
  const suggestions = useMemo(() => {
    if (!aiKeywords.trim() || aiKeywords.length < 3) return null;
    const inputWords = aiKeywords.toLowerCase().split(/[,\s]+/);
    
    const matched = KEYWORD_SUGGESTIONS.filter(group => 
      group.keywords.some(kw => inputWords.some(iw => kw.includes(iw) || iw.includes(kw)))
    );
    
    return matched.length > 0 ? matched : null;
  }, [aiKeywords]);

  const toggleArray = (field: "certifications" | "preferredProvinces", value: string) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].includes(value) 
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const addCode = (field: "naceCodes" | "cpvCodes", item: { code: string; label: string }) => {
    setData(prev => {
      if (prev[field].some(existing => existing.code === item.code)) return prev;
      return { ...prev, [field]: [...prev[field], item] };
    });
  };

  const removeCode = (field: "naceCodes" | "cpvCodes", code: string) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item.code !== code)
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Profil başarıyla güncellendi!", {
        description: `Yapay zeka eşleştirme doğruluğunuz %${scores.total} seviyesine ulaştı.`
      });
    }, 800);
  };

  const CheckIndicator = ({ achieved, points }: { achieved: boolean; points: number }) => (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border transition-colors ${
      achieved 
        ? "bg-green-500/10 text-green-700 border-green-500/20" 
        : "bg-muted/50 text-muted-foreground border-transparent"
    }`}>
      {achieved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
      {achieved ? "Tamamlandı" : `+${points}% Doğruluk`}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 selection:bg-primary/20">
      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Yapay Zeka Şirket Profili</h1>
              <p className="text-xs text-muted-foreground">İhaleZeka</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">Profil Gücü: %{scores.total}</p>
              <Progress value={scores.total} className="w-32 h-2 mt-1" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Kaydediliyor..." : "Profili Kaydet"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-8 flex flex-col md:flex-row gap-8 items-start">
        
        {/* MAIN CONTENT */}
        <div className="flex-1 space-y-6">
          
          <div className="mb-8">
            <h2 className="text-3xl font-bold font-serif tracking-tight text-slate-900 mb-2">
              Yapay zekanın sizi daha iyi tanımasını sağlayın.
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl leading-relaxed">
              Ne kadar çok ve doğru bilgi sağlarsanız, yapay zeka algoritmalarımız o kadar isabetli ihale eşleşmeleri bulur. Her bölüm, yapay zekanın firmanızın kapasitesini anlaması için bir ipucudur.
            </p>
          </div>

          {/* 1. KİMLİK */}
          <Card className={`border-l-4 transition-all duration-500 ${scores.core === 20 ? 'border-l-green-500 shadow-sm' : 'border-l-primary shadow-md'}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="w-5 h-5 text-primary" />
                    Temel Kimlik
                  </CardTitle>
                  <CardDescription className="mt-1">Resmi firma bilgilerinizi eksiksiz girin.</CardDescription>
                </div>
                <CheckIndicator achieved={scores.core === 20} points={20} />
              </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma Adı <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Tam ticari unvan" 
                  value={data.companyName}
                  onChange={e => setData({...data, companyName: e.target.value})}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Vergi Kimlik No <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="10 Haneli VKN" 
                  maxLength={10}
                  value={data.taxNumber}
                  onChange={e => setData({...data, taxNumber: e.target.value})}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>MERSİS Numarası</Label>
                <Input 
                  placeholder="İsteğe bağlı" 
                  value={data.mersisNumber}
                  onChange={e => setData({...data, mersisNumber: e.target.value})}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>EKAP Kayıt Numarası</Label>
                <Input 
                  placeholder="İsteğe bağlı" 
                  value={data.ekapNumber}
                  onChange={e => setData({...data, ekapNumber: e.target.value})}
                  className="bg-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. UZMANLIK & NACE (THE SMART SECTION) */}
          <Card className={`border-l-4 transition-all duration-500 overflow-hidden ${scores.domain === 30 ? 'border-l-green-500' : 'border-l-amber-500'}`}>
            <div className="bg-amber-50/50 p-4 border-b border-amber-100 flex gap-3">
              <BrainCircuit className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 text-sm">Yapay Zeka Destekli Alan Analizi</h4>
                <p className="text-amber-800/80 text-sm mt-0.5 leading-relaxed">
                  Faaliyet alanlarınızı veya anahtar kelimelerinizi (örn: "inşaat", "yazılım") yazın, yapay zeka en uygun NACE ve CPV kodlarını önersin. Bu bölüm eşleşme başarısı için <b>en kritik</b> adımdır.
                </p>
              </div>
            </div>
            
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Briefcase className="w-5 h-5 text-amber-500" />
                    Faaliyet Alanı ve Kodlar
                  </CardTitle>
                </div>
                <CheckIndicator achieved={scores.domain === 30} points={30} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* SMART SEARCH */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner">
                <Label className="text-slate-700">Akıllı Kod Bulucu (Anahtar Kelime Yazın)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Örn: Yol yapımı, Hastane cihazları, Catering..." 
                    className="pl-9 bg-white border-slate-300 focus-visible:ring-amber-500"
                    value={aiKeywords}
                    onChange={e => setAiKeywords(e.target.value)}
                  />
                </div>

                {suggestions && (
                  <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yapay Zeka Önerileri:</p>
                    {suggestions.map((group, idx) => (
                      <div key={idx} className="p-3 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">{group.sektor}</Badge>
                          <span className="text-xs text-muted-foreground">sektörü ile ilgili kodlar:</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                              <Target className="w-3 h-3" /> Önerilen NACE Kodları:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.nace.map(nace => {
                                const isAdded = data.naceCodes.some(n => n.code === nace.code);
                                return (
                                  <Button 
                                    key={nace.code}
                                    variant={isAdded ? "default" : "outline"} 
                                    size="sm" 
                                    className={`h-auto py-1.5 px-3 text-xs justify-start ${isAdded ? 'bg-amber-600 hover:bg-amber-700' : 'hover:border-amber-500'}`}
                                    onClick={() => isAdded ? removeCode("naceCodes", nace.code) : addCode("naceCodes", nace)}
                                  >
                                    {isAdded ? <CheckCircle2 className="w-3 h-3 mr-1.5" /> : <Plus className="w-3 h-3 mr-1.5" />}
                                    <span className="font-mono mr-1.5">{nace.code}</span> {nace.label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                              <Target className="w-3 h-3" /> Önerilen CPV Kodları:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.cpv.map(cpv => {
                                const isAdded = data.cpvCodes.some(c => c.code === cpv.code);
                                return (
                                  <Button 
                                    key={cpv.code}
                                    variant={isAdded ? "default" : "outline"} 
                                    size="sm" 
                                    className={`h-auto py-1.5 px-3 text-xs justify-start ${isAdded ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:border-indigo-500'}`}
                                    onClick={() => isAdded ? removeCode("cpvCodes", cpv.code) : addCode("cpvCodes", cpv)}
                                  >
                                    {isAdded ? <CheckCircle2 className="w-3 h-3 mr-1.5" /> : <Plus className="w-3 h-3 mr-1.5" />}
                                    <span className="font-mono mr-1.5">{cpv.code}</span> {cpv.label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SELECTED CHIPS */}
              <div className="grid sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Eklenen NACE Kodları</span>
                    <Badge variant="outline" className="text-xs font-normal">{data.naceCodes.length} seçildi</Badge>
                  </Label>
                  <div className="min-h-[80px] p-3 border rounded-md bg-white">
                    {data.naceCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center italic mt-2">Henüz NACE kodu eklenmedi.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.naceCodes.map(nace => (
                          <Badge key={nace.code} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-slate-100">
                            <span className="font-mono text-xs">{nace.code}</span>
                            <span className="text-xs max-w-[150px] truncate" title={nace.label}>{nace.label}</span>
                            <button onClick={() => removeCode("naceCodes", nace.code)} className="hover:bg-slate-200 p-0.5 rounded-full ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Eklenen CPV Kodları</span>
                    <Badge variant="outline" className="text-xs font-normal">{data.cpvCodes.length} seçildi</Badge>
                  </Label>
                  <div className="min-h-[80px] p-3 border rounded-md bg-white">
                    {data.cpvCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center italic mt-2">Henüz CPV kodu eklenmedi.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.cpvCodes.map(cpv => (
                          <Badge key={cpv.code} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-slate-100">
                            <span className="font-mono text-xs">{cpv.code}</span>
                            <span className="text-xs max-w-[150px] truncate" title={cpv.label}>{cpv.label}</span>
                            <button onClick={() => removeCode("cpvCodes", cpv.code)} className="hover:bg-slate-200 p-0.5 rounded-full ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* 3. A.I. BRIEF */}
          <Card className={`border-l-4 transition-all duration-500 ${scores.brief === 20 ? 'border-l-green-500' : 'border-l-primary'}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="w-5 h-5 text-primary" />
                    Yapay Zekaya Özel Firma Özeti
                  </CardTitle>
                  <CardDescription className="mt-1">
                    İhaleleri analiz ederken AI asistanımız bu metni "bağlam" olarak okur. 
                    En güçlü yönlerinizi ve odaklandığınız projeleri serbest metin olarak yazın.
                  </CardDescription>
                </div>
                <CheckIndicator achieved={scores.brief === 20} points={20} />
              </div>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Örn: 15 yıllık köklü bir inşaat şirketiyiz. Özellikle devlet hastaneleri ve eğitim binaları yapımında uzmanlaştık. Güçlü bir makine parkurumuz var. Hedefimiz 50M₺-200M₺ arası projeler..." 
                className="min-h-[150px] bg-white resize-y"
                value={data.aiBrief}
                onChange={e => setData({...data, aiBrief: e.target.value})}
              />
              <div className="flex justify-between items-center mt-2 text-xs">
                <span className={data.aiBrief.length > 50 ? 'text-green-600 font-medium' : 'text-amber-600'}>
                  {data.aiBrief.length < 50 ? 'Daha detaylı bir özet yapay zekanın başarısını artırır.' : 'Güçlü bir özet girdiniz.'}
                </span>
                <span className="text-muted-foreground">{data.aiBrief.length} karakter</span>
              </div>
            </CardContent>
          </Card>

          {/* 4. CAPACITY & FINANCIALS */}
          <Card className={`border-l-4 transition-all duration-500 ${scores.financials === 15 ? 'border-l-green-500' : 'border-l-primary'}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Kapasite ve Finansal Güç
                  </CardTitle>
                  <CardDescription className="mt-1">İhale yeterlilik kriterlerini hızlıca eşleştirmemize yarar.</CardDescription>
                </div>
                <CheckIndicator achieved={scores.financials === 15} points={15} />
              </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ortalama Yıllık Ciro (₺)</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    placeholder="Örn: 25000000" 
                    value={data.annualRevenue}
                    onChange={e => setData({...data, annualRevenue: e.target.value})}
                    className="bg-white pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground">₺</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Personel Sayısı</Label>
                <Input 
                  type="number" 
                  placeholder="Örn: 45" 
                  value={data.personnelCount}
                  onChange={e => setData({...data, personnelCount: e.target.value})}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>İş Deneyim Belgesi (₺)</Label>
                <div className="relative">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="w-4 h-4 absolute right-3 top-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Elinizdeki en yüksek iş bitirme belgesi tutarı</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input 
                    type="number" 
                    placeholder="Tutar" 
                    value={data.experienceCeiling}
                    onChange={e => setData({...data, experienceCeiling: e.target.value})}
                    className="bg-white pr-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. CERTS & LOCATION */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className={`border-l-4 transition-all duration-500 ${scores.certs === 10 ? 'border-l-green-500' : 'border-l-primary'}`}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    Sertifikalar
                  </CardTitle>
                  <CheckIndicator achieved={scores.certs === 10} points={10} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATIONS.map(cert => {
                    const active = data.certifications.includes(cert);
                    return (
                      <Badge 
                        key={cert}
                        variant={active ? "default" : "outline"}
                        className={`cursor-pointer transition-colors py-1 ${active ? 'bg-primary' : 'hover:bg-slate-100 bg-white text-slate-600'}`}
                        onClick={() => toggleArray("certifications", cert)}
                      >
                        {active && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                        {cert}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className={`border-l-4 transition-all duration-500 ${scores.location === 5 ? 'border-l-green-500' : 'border-l-primary'}`}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="w-5 h-5 text-primary" />
                      Tercih Edilen İller
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">Boş bırakılırsa tüm Türkiye aranır.</CardDescription>
                  </div>
                  <CheckIndicator achieved={scores.location === 5} points={5} />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[120px] w-full rounded-md border bg-white p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {TR_PROVINCES.map(prov => {
                      const active = data.preferredProvinces.includes(prov);
                      return (
                        <Badge 
                          key={prov}
                          variant={active ? "default" : "outline"}
                          className={`cursor-pointer transition-colors text-xs font-normal ${active ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:bg-slate-100'}`}
                          onClick={() => toggleArray("preferredProvinces", prov)}
                        >
                          {prov}
                        </Badge>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* SIDEBAR: STICKY PROGRESS */}
        <div className="w-full md:w-80 shrink-0 md:sticky md:top-24 space-y-6">
          <Card className="shadow-lg border-primary/20 bg-white/50 backdrop-blur overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-400 to-primary" />
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Profil Gücü</CardTitle>
              <CardDescription>Yapay Zeka Doğruluk Skoru</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4 pb-6">
              
              <CircularProgress value={scores.total} size={140} strokeWidth={12} />
              
              <div className="mt-8 space-y-3 w-full">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Temel Kimlik
                  </span>
                  <span className={`font-medium ${scores.core === 20 ? 'text-green-600' : 'text-slate-400'}`}>
                    {scores.core}/20
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" /> Faaliyet & Kodlar
                  </span>
                  <span className={`font-medium ${scores.domain === 30 ? 'text-green-600' : 'text-slate-400'}`}>
                    {scores.domain}/30
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> AI Firma Özeti
                  </span>
                  <span className={`font-medium ${scores.brief === 20 ? 'text-green-600' : 'text-slate-400'}`}>
                    {scores.brief}/20
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Finansal Güç
                  </span>
                  <span className={`font-medium ${scores.financials === 15 ? 'text-green-600' : 'text-slate-400'}`}>
                    {scores.financials}/15
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t pt-3">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4" /> Ekstra Bilgiler
                  </span>
                  <span className={`font-medium ${scores.certs + scores.location === 15 ? 'text-green-600' : 'text-slate-400'}`}>
                    {scores.certs + scores.location}/15
                  </span>
                </div>
              </div>
            </CardContent>
            
            <div className="p-4 bg-slate-50 border-t">
              <Button onClick={handleSave} disabled={saving} className="w-full h-11 text-base shadow-sm">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {saving ? "Kaydediliyor..." : "Profili Tamamla"}
              </Button>
              {scores.total < 50 && (
                <p className="text-center text-xs text-muted-foreground mt-3 leading-snug">
                  Profil gücünüz düşük. Yapay zekanın isabetli sonuçlar bulması için lütfen profilinizi doldurun.
                </p>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
