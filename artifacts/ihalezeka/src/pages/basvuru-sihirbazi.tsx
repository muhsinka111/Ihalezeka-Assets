import { useState, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useGetCompanyProfile, useUpsertCompanyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconBuilding,
  IconChartBar,
  IconCoin,
  IconUsers,
  IconBolt,
  IconBrain,
  IconX,
  IconPlus,
} from "@tabler/icons-react";
import { useLocation } from "wouter";

const STEPS = [
  { id: 1, label: "Firma Kimliği", icon: IconBuilding },
  { id: 2, label: "Faaliyet Alanları", icon: IconChartBar },
  { id: 3, label: "Mali Yeterlilik", icon: IconCoin },
  { id: 4, label: "Deneyim & Personel", icon: IconUsers },
  { id: 5, label: "Teklif Stratejisi", icon: IconBolt },
  { id: 6, label: "AI Bağlamı", icon: IconBrain },
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

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "TSE", "CE", "OHSAS 18001", "Mesleki Yeterlilik Belgesi",
  "Çevre Yönetim Belgesi", "Kalite Yönetim Belgesi",
];

const SECTORS = [
  "İnşaat", "Bilişim", "Yazılım", "Danışmanlık", "Hizmet", "Temizlik",
  "Güvenlik", "Elektrik", "Mekanik", "Tıbbi Cihaz", "Araç Kiralama",
  "Yemek", "Peyzaj", "Ulaşım", "Enerji", "Telekomünikasyon",
  "Tarım", "Sağlık", "Eğitim", "Çevre",
];

const STRATEGIES = [
  {
    key: "aggressive",
    label: "Agresif",
    emoji: "⚡",
    desc: "Yüksek kırım oranı (%15-25), hacim odaklı büyüme stratejisi.",
    color: "border-red-400 bg-red-50 text-red-800",
    activeColor: "border-red-500 bg-red-100 ring-2 ring-red-400",
  },
  {
    key: "balanced",
    label: "Dengeli",
    emoji: "⚖️",
    desc: "Orta kırım (%8-12), sürdürülebilir büyüme ve karlılık dengesi.",
    color: "border-blue-400 bg-blue-50 text-blue-800",
    activeColor: "border-blue-500 bg-blue-100 ring-2 ring-blue-400",
  },
  {
    key: "conservative",
    label: "Muhafazakâr",
    emoji: "🛡️",
    desc: "Düşük kırım (%3-7), yüksek kar marjı ve seçici ihale stratejisi.",
    color: "border-emerald-400 bg-emerald-50 text-emerald-800",
    activeColor: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400",
  },
];

function ChipSelector({
  options,
  selected,
  onToggle,
  className,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all select-none ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            {active && <IconCheck className="inline h-3 w-3 mr-1 -mt-0.5" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  label?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div
        className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-md border border-input bg-background cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.filter(Boolean).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              className="hover:text-destructive"
            >
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            className="flex-1 border-0 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
            placeholder={placeholder ?? "Ekle ve Enter'a bas…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
              if (e.key === "Backspace" && !input && value.length > 0) {
                remove(value[value.length - 1]);
              }
            }}
          />
          {input.trim() && (
            <button type="button" onClick={add} className="text-primary">
              <IconPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Enter veya virgül ile ekleyin.</p>
    </div>
  );
}

export default function BasvuruSihirbazPage() {
  const { userId } = useAuth();
  const { data: profile, isLoading } = useGetCompanyProfile();
  const mutation = useUpsertCompanyProfile();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleArr = (k: string, val: string) => {
    const current: string[] = form[k] ?? (profile as any)?.[k] ?? [];
    const next = current.includes(val)
      ? current.filter((x: string) => x !== val)
      : [...current, val];
    set(k, next);
  };
  const data = { ...profile, ...form };
  const arr = (k: string): string[] => data[k] ?? [];

  const save = async () => {
    setSaving(true);
    await mutation.mutateAsync({ data: { ...data, completionStep: step } });
    setSaving(false);
    if (step < 6) setStep(step + 1);
  };

  const handleSkip = () => {
    if (userId) {
      localStorage.setItem(`ihale_onboarding_skipped_${userId}`, "1");
    }
    navigate("/ihale-arama");
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Başvuru Sihirbazı</h1>
          <p className="text-muted-foreground text-sm">Firma profilinizi tamamlayarak yapay zeka destekli ihale eşleştirmesini etkinleştirin.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground shrink-0">
          Şimdi Atla
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Step sidebar */}
        <div className="space-y-1">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = s.id < step;
            const active = s.id === step;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left
                  ${active ? "bg-primary text-primary-foreground" : done ? "text-emerald-600 hover:bg-muted" : "text-muted-foreground hover:bg-muted"}`}
              >
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs
                  ${active ? "border-primary-foreground" : done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"}`}>
                  {done ? <IconCheck className="h-3.5 w-3.5" /> : s.id}
                </div>
                <Icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="lg:col-span-3">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Adım {step} / {STEPS.length}</span>
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <div key={s.id} className={`h-1.5 w-8 rounded-full transition-colors ${s.id <= step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{STEPS[step - 1]?.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ── Step 1: Firma Kimliği ── */}
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Firma Adı *</Label>
                    <Input defaultValue={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Örn: ABC Yapı Ltd. Şti." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vergi Numarası *</Label>
                    <Input defaultValue={data.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} placeholder="1234567890" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>MERSİS Numarası</Label>
                    <Input defaultValue={data.mersisNumber} onChange={(e) => set("mersisNumber", e.target.value)} placeholder="Opsiyonel" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>EKAP Numarası</Label>
                    <Input defaultValue={data.ekapNumber} onChange={(e) => set("ekapNumber", e.target.value)} placeholder="Opsiyonel" />
                  </div>
                </div>
              )}

              {/* ── Step 2: Faaliyet Alanları ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <TagInput
                    label="NACE Kodları"
                    value={arr("naceCodes")}
                    onChange={(v) => set("naceCodes", v)}
                    placeholder="Örn: 41.20 — Enter ile ekle"
                  />
                  <TagInput
                    label="CPV Kodları"
                    value={arr("cpvCodes")}
                    onChange={(v) => set("cpvCodes", v)}
                    placeholder="Örn: 45000000 — Enter ile ekle"
                  />
                  <div className="space-y-2">
                    <Label>Tercih Edilen İller</Label>
                    <p className="text-xs text-muted-foreground">Çalışmak istediğiniz illeri seçin. Hiç seçmezseniz tüm Türkiye kapsanır.</p>
                    <ChipSelector
                      options={TR_PROVINCES}
                      selected={arr("preferredProvinces")}
                      onToggle={(v) => toggleArr("preferredProvinces", v)}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 3: Mali Yeterlilik ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>İş Deneyim Tavanı (₺)</Label>
                      <Input
                        type="number"
                        defaultValue={data.experienceCeiling}
                        onChange={(e) => set("experienceCeiling", parseFloat(e.target.value))}
                        placeholder="Örn: 50000000"
                      />
                      <p className="text-xs text-muted-foreground">Bu tutarın üzerindeki ihaleleri filtrelemek için kullanılır.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Yıllık Ciro (₺)</Label>
                      <Input
                        type="number"
                        defaultValue={data.annualRevenue}
                        onChange={(e) => set("annualRevenue", parseFloat(e.target.value))}
                        placeholder="Örn: 10000000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sertifikalar & Belgeler</Label>
                    <p className="text-xs text-muted-foreground">Sahip olduğunuz sertifikaları işaretleyin.</p>
                    <ChipSelector
                      options={CERTIFICATIONS}
                      selected={arr("certifications")}
                      onToggle={(v) => toggleArr("certifications", v)}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 4: Deneyim & Personel ── */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>
                      Toplam Personel Sayısı:{" "}
                      <span className="font-bold text-primary">{data.personnelCount ?? 10}</span>
                    </Label>
                    <Slider
                      min={1}
                      max={500}
                      step={1}
                      value={[data.personnelCount ?? 10]}
                      onValueChange={([v]) => set("personnelCount", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>50</span>
                      <span>100</span>
                      <span>250</span>
                      <span>500+</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sektör Deneyimleri</Label>
                    <p className="text-xs text-muted-foreground">Firmanızın faaliyet gösterdiği sektörleri seçin.</p>
                    <ChipSelector
                      options={SECTORS}
                      selected={arr("sectorExperience")}
                      onToggle={(v) => toggleArr("sectorExperience", v)}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 5: Teklif Stratejisi ── */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">İhale tekliflerinizde genel olarak hangi stratejiyi izliyorsunuz?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STRATEGIES.map((s) => {
                      const selected = (form.discountStrategy ?? data.discountStrategy) === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => set("discountStrategy", s.key)}
                          className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center ${
                            selected ? s.activeColor : `${s.color} hover:opacity-90`
                          }`}
                        >
                          <span className="text-3xl">{s.emoji}</span>
                          <span className="font-semibold text-sm">{s.label}</span>
                          <span className="text-xs opacity-80 leading-snug">{s.desc}</span>
                          {selected && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium">
                              <IconCheck className="h-3.5 w-3.5" /> Seçildi
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 6: AI Bağlamı ── */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <strong>Bu bilgi neden önemli?</strong> Yazdığınız özet, yapay zeka asistanımızın her sohbette firmanızı tanımasını sağlar. Sektörünüzü, güçlü yönlerinizi ve geçmiş deneyimlerinizi ekleyin.
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="aiBrief">Firma Özeti (en fazla 500 karakter)</Label>
                    <Textarea
                      id="aiBrief"
                      rows={6}
                      maxLength={500}
                      placeholder="Örn: İnşaat sektöründe 15 yıllık deneyimimiz var. Kamuya ait altyapı projeleri, yol yapımı ve okul inşaatlarında referanslarımız bulunmaktadır. ISO 9001 ve ISO 14001 belgelerimiz mevcut. Özellikle Marmara ve İç Anadolu bölgelerinde aktifiz."
                      defaultValue={data.aiBrief ?? ""}
                      onChange={(e) => set("aiBrief", e.target.value)}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {(form.aiBrief ?? data.aiBrief ?? "").length} / 500
                    </p>
                  </div>
                  {data.completionStep >= 6 && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                      <IconCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-700 font-medium">Profiliniz tamamlandı! Eşleşme sistemi aktif.</p>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          <div className="flex justify-between mt-4">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)} className="gap-2">
              <IconArrowLeft className="h-4 w-4" /> Önceki
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? "Kaydediliyor…" : step === 6 ? "Tamamla" : "Kaydet ve Devam Et"}
              {step < 6 && <IconArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
