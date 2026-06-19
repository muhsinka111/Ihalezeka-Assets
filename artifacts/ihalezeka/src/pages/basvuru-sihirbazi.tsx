import { useState, useRef } from "react";
import { toast } from "sonner";
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

const AI_EXPERTISE_OPTIONS = [
  "Yapım İşleri", "BT & Yazılım", "Danışmanlık", "Temizlik Hizmetleri",
  "Güvenlik Hizmetleri", "Sağlık & Tıbbi Cihaz", "Araç Kiralama & Lojistik",
  "Elektrik & Mekanik", "Yemek & Catering", "Peyzaj & Çevre",
  "Enerji & Telekomünikasyon", "Eğitim & Kurs",
];

const AI_STRENGTH_OPTIONS = [
  "Fiyat Rekabeti", "Teknik Yeterlilik", "Güçlü Referanslar",
  "Hızlı Teslimat", "Yerel Varlık", "Kalite Belgeleri",
  "Tecrübeli Ekip", "Geniş Alt Yüklenici Ağı",
];

const AI_AVOID_OPTIONS = [
  "Yurt Dışı İhaleleri", "Sağlık / Hastane İşleri", "Yemek / Catering",
  "Temizlik Hizmetleri", "Altyapı / Büyük Yapım",
  "Çok Kısa Süreli İhaleler", "Çok Düşük Bütçeli İhaleler",
];

function buildAiBrief(
  expertise: string[],
  strengths: string[],
  expYears: number,
  avoidTypes: string[],
  notes: string,
): string {
  const parts: string[] = [];
  if (expertise.length > 0) parts.push(`Uzmanlık: ${expertise.join(", ")}.`);
  if (expYears > 0) parts.push(`${expYears} yıllık sektör deneyimi.`);
  if (strengths.length > 0) parts.push(`Güçlü yönler: ${strengths.join(", ")}.`);
  if (avoidTypes.length > 0) parts.push(`Tercih edilmeyenler: ${avoidTypes.join(", ")}.`);
  if (notes.trim()) parts.push(notes.trim());
  return parts.join(" ").slice(0, 500);
}

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
    try {
      const payload: any = { ...data, completionStep: step };
      if (step === 6) {
        payload.aiBrief = buildAiBrief(
          form._aiExpertise ?? [],
          form._aiStrengths ?? [],
          form._aiExpYears ?? 0,
          form._aiAvoidTypes ?? [],
          form._aiNotes ?? (data.aiBrief ?? ""),
        );
      }
      await mutation.mutateAsync({ data: payload });
      if (step < 6) setStep(step + 1);
    } catch {
      toast.error("Kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
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

      {/* AI scoring notice */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <IconBrain className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Tüm alanlar isteğe bağlıdır</p>
          <p className="text-blue-700 leading-snug">
            Vergi numarası, MERSİS veya diğer hassas bilgilerinizi paylaşmak zorunda değilsiniz.
            Ancak doldurduğunuz her alan, yapay zeka motorumuzun size daha doğru ihale eşleştirmesi
            yapmasını sağlar — eksik alanlar skoru düşürür.
          </p>
        </div>
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Firma Adı</Label>
                      <Input defaultValue={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Örn: ABC Yapı Ltd. Şti." />
                      <p className="text-xs text-muted-foreground">AI eşleştirme ve raporlarda görünür.</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label>Vergi Numarası</Label>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">isteğe bağlı</span>
                      </div>
                      <Input defaultValue={data.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} placeholder="Paylaşmak istemiyorsanız boş bırakın" />
                      <p className="text-xs text-muted-foreground">Girmeniz halinde EKAP uyumluluk skoru artar.</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label>MERSİS Numarası</Label>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">isteğe bağlı</span>
                      </div>
                      <Input defaultValue={data.mersisNumber} onChange={(e) => set("mersisNumber", e.target.value)} placeholder="Paylaşmak istemiyorsanız boş bırakın" />
                      <p className="text-xs text-muted-foreground">Teklif hazırlama asistanı bu veriyi kullanır.</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label>EKAP Numarası</Label>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">isteğe bağlı</span>
                      </div>
                      <Input defaultValue={data.ekapNumber} onChange={(e) => set("ekapNumber", e.target.value)} placeholder="Paylaşmak istemiyorsanız boş bırakın" />
                      <p className="text-xs text-muted-foreground">Kazandığınız geçmiş ihalelere erişimi hızlandırır.</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground flex gap-2 items-start">
                    <span className="text-base leading-none mt-0.5">🔒</span>
                    <span>Vergi numarası ve MERSİS bilgileri şifreli saklanır ve yalnızca AI skoru hesaplamak için kullanılır. Üçüncü taraflarla paylaşılmaz.</span>
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
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <strong>Bu bilgi neden önemli?</strong> Aşağıdaki sorular, yapay zeka motorunun ihale–firma uyumunu çok daha doğru değerlendirmesini sağlar. Ne kadar çok doldurursanız eşleştirme o kadar isabetli olur.
                  </div>

                  {/* Uzmanlık Alanları */}
                  <div className="space-y-2">
                    <Label>Uzmanlık Alanları</Label>
                    <p className="text-xs text-muted-foreground">Firmanızın en güçlü olduğu iş alanlarını seçin (birden fazla seçebilirsiniz).</p>
                    <ChipSelector
                      options={AI_EXPERTISE_OPTIONS}
                      selected={form._aiExpertise ?? []}
                      onToggle={(v) => {
                        const cur: string[] = form._aiExpertise ?? [];
                        set("_aiExpertise", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
                      }}
                    />
                  </div>

                  {/* Rekabet Avantajı */}
                  <div className="space-y-2">
                    <Label>Rekabet Avantajlarınız</Label>
                    <p className="text-xs text-muted-foreground">Rakiplerinize kıyasla öne çıktığınız güçlü yönlerinizi seçin.</p>
                    <ChipSelector
                      options={AI_STRENGTH_OPTIONS}
                      selected={form._aiStrengths ?? []}
                      onToggle={(v) => {
                        const cur: string[] = form._aiStrengths ?? [];
                        set("_aiStrengths", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
                      }}
                    />
                  </div>

                  {/* Deneyim Yılı */}
                  <div className="space-y-3">
                    <Label>
                      Sektör Deneyimi:{" "}
                      <span className="font-bold text-primary">
                        {(form._aiExpYears ?? 0) === 0 ? "Belirtilmedi" : `${form._aiExpYears ?? 0} yıl`}
                      </span>
                    </Label>
                    <Slider
                      min={0}
                      max={35}
                      step={1}
                      value={[form._aiExpYears ?? 0]}
                      onValueChange={([v]) => set("_aiExpYears", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Belirtme</span>
                      <span>5 yıl</span>
                      <span>10 yıl</span>
                      <span>20 yıl</span>
                      <span>35+ yıl</span>
                    </div>
                  </div>

                  {/* Kaçınılan İhale Türleri */}
                  <div className="space-y-2">
                    <Label>Tercih Etmediğiniz İhale Türleri</Label>
                    <p className="text-xs text-muted-foreground">AI bu türdeki ihaleleri size önerirken daha düşük puan verir.</p>
                    <ChipSelector
                      options={AI_AVOID_OPTIONS}
                      selected={form._aiAvoidTypes ?? []}
                      onToggle={(v) => {
                        const cur: string[] = form._aiAvoidTypes ?? [];
                        set("_aiAvoidTypes", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
                      }}
                    />
                  </div>

                  {/* Serbest Notlar */}
                  <div className="space-y-1.5">
                    <Label htmlFor="aiNotes">Ek Notlar <span className="text-muted-foreground font-normal">(isteğe bağlı)</span></Label>
                    <Textarea
                      id="aiNotes"
                      rows={3}
                      maxLength={400}
                      placeholder="Örn: Özellikle okul ve kamu binası yapım ihalelerinde güçlüyüz. Marmara bölgesinde alt yüklenici ağımız geniş."
                      defaultValue={form._aiNotes ?? (data.aiBrief ?? "")}
                      onChange={(e) => set("_aiNotes", e.target.value)}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {(form._aiNotes ?? (data.aiBrief ?? "")).length} / 400
                    </p>
                  </div>

                  {data.completionStep != null && data.completionStep >= 6 && (
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
