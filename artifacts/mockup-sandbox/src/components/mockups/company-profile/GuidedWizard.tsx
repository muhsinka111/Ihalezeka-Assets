import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Building,
  Briefcase,
  Award,
  MapPin,
  Bot,
  Search,
  Plus,
  X,
  Sparkles,
  Check,
  Info
} from "lucide-react";
import { toast } from "sonner";

const INDUSTRY_DATA = [
  { keywords: ["inşaat", "yol", "yapı", "beton", "müteahhit", "mimarlık"], sector: "İnşaat", nace: ["41.20", "42.11", "71.11"], cpv: ["45000000", "45233000", "71200000"] },
  { keywords: ["yazılım", "bilişim", "yazilim", "sistem", "uygulama", "web", "donanım", "sunucu"], sector: "Bilgi Teknolojileri", nace: ["62.01", "62.02"], cpv: ["72000000", "48000000"] },
  { keywords: ["tıbbi", "medikal", "sağlık", "hastane", "ilaç", "cihaz", "ameliyat"], sector: "Sağlık & Medikal", nace: ["46.46", "32.50"], cpv: ["33000000", "33100000"] },
  { keywords: ["temizlik", "hijyen", "çöp", "atık"], sector: "Tesis Yönetimi", nace: ["81.21"], cpv: ["90910000", "90500000"] },
  { keywords: ["gıda", "yemek", "catering", "lokanta", "kafeterya", "kumanya"], sector: "Gıda & Catering", nace: ["56.29", "10.89"], cpv: ["55500000", "15000000"] },
  { keywords: ["güvenlik", "koruma", "bekçi", "kamera"], sector: "Güvenlik Hizmetleri", nace: ["80.10", "80.20"], cpv: ["79710000", "35120000"] },
  { keywords: ["tekstil", "kumaş", "giyim", "kıyafet", "üniforma"], sector: "Tekstil & Giyim", nace: ["14.12", "14.13"], cpv: ["18000000", "18100000"] },
  { keywords: ["matbaa", "basım", "baskı", "kırtasiye"], sector: "Matbaa & Basım", nace: ["18.12", "18.13"], cpv: ["79800000", "22000000"] },
];

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "TSE", "CE", "Mesleki Yeterlilik Belgesi", "ÇED Raporu",
  "Hizmet Yeterlilik Belgesi (HYB)", "Sanayi Sicil Belgesi"
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

const STEPS = [
  { id: "kimlik", title: "Firma Kimliği", icon: Building },
  { id: "sektor", title: "Sektör & Kodlar", icon: Briefcase },
  { id: "kapasite", title: "Kapasite & Sertifikalar", icon: Award },
  { id: "bolge", title: "Bölge Tercihleri", icon: MapPin },
  { id: "ozet", title: "AI Bağlamı", icon: Bot },
];

export function GuidedWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: "",
    taxNumber: "",
    mersisNo: "",
    ekapNo: "",
    annualRevenue: "",
    personnelCount: "",
    experienceCeiling: "",
    certifications: [] as string[],
    naceCodes: [] as string[],
    cpvCodes: [] as string[],
    preferredProvinces: [] as string[],
    aiBrief: "",
  });

  const [keywordInput, setKeywordInput] = useState("");
  const [suggestions, setSuggestions] = useState<{sector: string, nace: string[], cpv: string[]}[]>([]);

  useEffect(() => {
    if (keywordInput.trim().length > 2) {
      const lowerInput = keywordInput.toLowerCase();
      const matches = INDUSTRY_DATA.filter(ind => 
        ind.keywords.some(kw => ind.sector.toLowerCase().includes(lowerInput) || kw.includes(lowerInput))
      );
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  }, [keywordInput]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: "certifications" | "preferredProvinces" | "naceCodes" | "cpvCodes", value: string) => {
    setFormData(prev => {
      const arr = prev[field];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...arr, value] };
      }
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Profiliniz başarıyla kaydedildi!", {
        description: "Yapay zeka eşleşmeleri artık profilinizle %40 daha isabetli sonuç verecek.",
        duration: 5000,
      });
    }, 1200);
  };

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans text-slate-900">
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Yapay Zeka Profil Rehberi</h1>
              <p className="text-sm text-muted-foreground">Ne kadar çok bilgi, o kadar isabetli ihale eşleşmesi.</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
            <div className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 ease-in-out z-0" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} />
            
            <div className="relative z-10 flex justify-between">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === currentStep;
                const isPast = idx < currentStep;
                
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${isActive ? "bg-primary text-white shadow-md ring-4 ring-primary/20" : isPast ? "bg-primary text-white" : "bg-slate-100 text-slate-400 border-2 border-slate-200"}`}>
                      {isPast ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${isActive ? "text-primary" : "text-slate-500"}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-10 transition-all">
          
          {currentStep === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Building className="h-6 w-6 text-primary" />
                  Temel Firma Bilgileri
                </h2>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 text-sm leading-relaxed">
                  <Info className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
                  <p>
                    <strong>Neden gerekli?</strong> İhale şartnamelerindeki "istekli olabilecekler" kriterleri genellikle 
                    vergi no ve kayıtlı firma unvanı üzerinden kontrol edilir. Bu bilgilerin doğruluğu, sizi uygun olmadığınız 
                    ihalelerden elemeye yardımcı olur.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Firma Resmi Unvanı</Label>
                  <Input 
                    id="companyName" 
                    placeholder="Örn: Acme İnşaat ve Ticaret A.Ş." 
                    value={formData.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxNumber">Vergi Numarası (VKN/TCKN)</Label>
                  <Input 
                    id="taxNumber" 
                    placeholder="10 Haneli Vergi No" 
                    value={formData.taxNumber}
                    onChange={(e) => updateField("taxNumber", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mersisNo">MERSİS Numarası</Label>
                  <Input 
                    id="mersisNo" 
                    placeholder="Opsiyonel" 
                    value={formData.mersisNo}
                    onChange={(e) => updateField("mersisNo", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ekapNo">EKAP Kayıt Numarası</Label>
                  <Input 
                    id="ekapNo" 
                    placeholder="Opsiyonel" 
                    value={formData.ekapNo}
                    onChange={(e) => updateField("ekapNo", e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary" />
                  Sektör, NACE ve CPV Kodları
                </h2>
                <div className="bg-purple-50 text-purple-900 p-4 rounded-lg flex gap-3 text-sm leading-relaxed">
                  <Sparkles className="h-5 w-5 flex-shrink-0 text-purple-600 mt-0.5" />
                  <p>
                    <strong>Sihirli Arama:</strong> Ne iş yaptığınızı birkaç kelimeyle yazın, 
                    yapay zeka size uygun <strong>NACE</strong> (Faaliyet) ve <strong>CPV</strong> (Ortak İhale Sözlüğü) kodlarını önersin. 
                    Bu kodlar eşleşmelerin kalbidir.
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-slate-50 border rounded-xl p-6">
                  <Label className="text-base font-semibold mb-3 block">Ne iş yapıyorsunuz? Anahtar kelimeler yazın...</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <Input 
                      placeholder="Örn: Yol yapımı, yazılım geliştirme, hastane temizliği..." 
                      className="h-12 pl-10 bg-white text-lg shadow-sm"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                    />
                  </div>

                  {suggestions.length > 0 && (
                    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
                      <p className="text-sm font-medium text-slate-500">Önerilen Sektör ve Kodlar:</p>
                      {suggestions.map((sug, i) => (
                        <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                          <div className="font-semibold text-primary mb-3 flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                              Sektör: {sug.sector}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Önerilen NACE Kodları</p>
                              <div className="flex flex-wrap gap-2">
                                {sug.nace.map(code => {
                                  const isSelected = formData.naceCodes.includes(code);
                                  return (
                                    <button
                                      key={code}
                                      onClick={() => toggleArrayItem("naceCodes", code)}
                                      className={`px-3 py-1.5 text-sm rounded-md border transition-all flex items-center gap-1.5 ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium ring-1 ring-indigo-500' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      {isSelected ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4 text-slate-400" />}
                                      {code}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Önerilen CPV Kodları</p>
                              <div className="flex flex-wrap gap-2">
                                {sug.cpv.map(code => {
                                  const isSelected = formData.cpvCodes.includes(code);
                                  return (
                                    <button
                                      key={code}
                                      onClick={() => toggleArrayItem("cpvCodes", code)}
                                      className={`px-3 py-1.5 text-sm rounded-md border transition-all flex items-center gap-1.5 ${isSelected ? 'bg-teal-50 border-teal-200 text-teal-700 font-medium ring-1 ring-teal-500' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      {isSelected ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4 text-slate-400" />}
                                      {code}
                                    </button>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Seçili NACE Kodlarınız</Label>
                    <div className="flex flex-wrap gap-2 min-h-[48px] p-3 border rounded-lg bg-slate-50/50">
                      {formData.naceCodes.length === 0 ? (
                        <span className="text-sm text-slate-400 italic">Henüz kod seçmediniz</span>
                      ) : (
                        formData.naceCodes.map(code => (
                          <Badge key={code} variant="secondary" className="bg-indigo-100 text-indigo-800 pr-1 py-1">
                            {code}
                            <button onClick={() => toggleArrayItem("naceCodes", code)} className="ml-1 hover:bg-indigo-200 rounded-full p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Seçili CPV Kodlarınız</Label>
                    <div className="flex flex-wrap gap-2 min-h-[48px] p-3 border rounded-lg bg-slate-50/50">
                      {formData.cpvCodes.length === 0 ? (
                        <span className="text-sm text-slate-400 italic">Henüz kod seçmediniz</span>
                      ) : (
                        formData.cpvCodes.map(code => (
                          <Badge key={code} variant="secondary" className="bg-teal-100 text-teal-800 pr-1 py-1">
                            {code}
                            <button onClick={() => toggleArrayItem("cpvCodes", code)} className="ml-1 hover:bg-teal-200 rounded-full p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Award className="h-6 w-6 text-primary" />
                  Kapasite & Sertifikalar
                </h2>
                <div className="bg-emerald-50 text-emerald-900 p-4 rounded-lg flex gap-3 text-sm leading-relaxed">
                  <Info className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                  <p>
                    <strong>Neden önemli?</strong> İhalelerin %80'i "Benzer İş Deneyimi", "Ciro" ve "Kalite Belgeleri" kriterleri barındırır. 
                    Sahip olduğunuz belgeleri işaretlediğinizde, yeterliliğinizin olmadığı ihaleleri otomatik olarak eleriz.
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="annualRevenue">Yıllık Ciro (₺)</Label>
                    <Input 
                      id="annualRevenue" 
                      type="number"
                      placeholder="Örn: 15000000" 
                      value={formData.annualRevenue}
                      onChange={(e) => updateField("annualRevenue", e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personnelCount">Personel Sayısı</Label>
                    <Input 
                      id="personnelCount" 
                      type="number"
                      placeholder="Örn: 45" 
                      value={formData.personnelCount}
                      onChange={(e) => updateField("personnelCount", e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experienceCeiling">İş Deneyim Tavanı (₺)</Label>
                    <Input 
                      id="experienceCeiling" 
                      type="number"
                      placeholder="Örn: 25000000" 
                      value={formData.experienceCeiling}
                      onChange={(e) => updateField("experienceCeiling", e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Sahip Olduğunuz Belgeler & Sertifikalar</Label>
                  <div className="flex flex-wrap gap-2.5">
                    {CERTIFICATIONS.map(cert => {
                      const isSelected = formData.certifications.includes(cert);
                      return (
                        <button
                          key={cert}
                          onClick={() => toggleArrayItem("certifications", cert)}
                          className={`px-4 py-2 text-sm rounded-full border transition-all flex items-center gap-2 ${isSelected ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700'}`}
                        >
                          {isSelected && <Check className="h-4 w-4" />}
                          {cert}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  Bölge ve İl Tercihleri
                </h2>
                <div className="bg-amber-50 text-amber-900 p-4 rounded-lg flex gap-3 text-sm leading-relaxed">
                  <Info className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    <strong>Nerelerde iş yapabilirsiniz?</strong> İlgilendiğiniz illeri seçin. 
                    Hiçbir il seçmezseniz, sistem <strong>Tüm Türkiye'de</strong> iş yapabileceğinizi varsayar.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <Label className="text-base font-semibold">Tercih Edilen İller</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => updateField("preferredProvinces", [])}
                    disabled={formData.preferredProvinces.length === 0}
                  >
                    Seçimleri Temizle
                  </Button>
                </div>
                
                <div className="bg-slate-50 border p-4 rounded-xl h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {TR_PROVINCES.map(province => {
                      const isSelected = formData.preferredProvinces.includes(province);
                      return (
                        <button
                          key={province}
                          onClick={() => toggleArrayItem("preferredProvinces", province)}
                          className={`px-3 py-2 text-sm rounded-md border text-left transition-all flex justify-between items-center ${isSelected ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'bg-white hover:bg-slate-100 text-slate-600 border-transparent hover:border-slate-200'}`}
                        >
                          {province}
                          {isSelected && <CheckCircle className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formData.preferredProvinces.length > 0 && (
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="font-semibold text-primary">{formData.preferredProvinces.length}</span> il seçildi. 
                    Yapay zeka öncelikle bu illerdeki ihaleleri karşınıza çıkaracak.
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Bot className="h-6 w-6 text-primary" />
                  Yapay Zeka Bağlamı
                </h2>
                <div className="bg-primary/5 border border-primary/20 text-primary-900 p-5 rounded-xl flex gap-4 text-sm leading-relaxed shadow-sm">
                  <Sparkles className="h-6 w-6 flex-shrink-0 text-primary mt-1" />
                  <div>
                    <p className="font-semibold text-base mb-1">Son dokunuş: Yapay Zekaya firmanızı kendi kelimelerinizle anlatın.</p>
                    <p className="opacity-90">
                      Resmi kodlar ve sayılar önemlidir, ancak firmanızın "ruhunu" ve niş yeteneklerini yapay zekanın anlaması 
                      için kısa bir özet yazın. Sistem, ihaleleri okurken bu metni baz alarak sizin adınıza düşünür.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="aiBrief" className="text-base font-semibold">Firma Özeti (Serbest Metin)</Label>
                  <Textarea 
                    id="aiBrief" 
                    placeholder="Örn: 20 yıldır Ankara'da özel hastane ve sağlık tesisleri inşaatı konusunda uzmanlaştık. Ameliyathane havalandırma sistemleri kurulumunda kendimize ait patentli teknolojilerimiz var..." 
                    value={formData.aiBrief}
                    onChange={(e) => updateField("aiBrief", e.target.value)}
                    className="h-40 p-4 text-base resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Ne kadar detaylı olursa o kadar iyi.</span>
                    <span>{formData.aiBrief.length} karakter</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-8">
                  <h3 className="font-bold text-lg mb-4">Profil Özeti</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">NACE Kodları</p>
                      <p className="font-semibold">{formData.naceCodes.length || 0} adet eklendi</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">CPV Kodları</p>
                      <p className="font-semibold">{formData.cpvCodes.length || 0} adet eklendi</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">Sertifikalar</p>
                      <p className="font-semibold">{formData.certifications.length || 0} adet eklendi</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">İl Tercihleri</p>
                      <p className="font-semibold">{formData.preferredProvinces.length > 0 ? formData.preferredProvinces.length + " il" : "Tüm Türkiye"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={handlePrev} 
              disabled={currentStep === 0 || saving}
              className="h-12 px-6"
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Geri
            </Button>
            
            {currentStep < STEPS.length - 1 ? (
              <Button 
                onClick={handleNext} 
                className="h-12 px-8 text-base"
              >
                Devam Et <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="h-12 px-10 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              >
                {saving ? "Kaydediliyor..." : "Profili Tamamla ve Kaydet"}
                {!saving && <CheckCircle className="ml-2 h-5 w-5" />}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
