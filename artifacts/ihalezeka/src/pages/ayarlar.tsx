import { useState, useRef, useMemo, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useGetCompanyProfile, useUpsertCompanyProfile } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  IconUser,
  IconBuilding,
  IconLock,
  IconCamera,
  IconCheck,
  IconX,
  IconPlus,
  IconFolder,
  IconBriefcase,
  IconBrain,
  IconTrendingUp,
  IconMapPin,
  IconSearch,
  IconTargetArrow,
  IconRosette,
  IconBolt,
  IconScale,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { BelgelerimTab } from "@/pages/belgelerim";

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "TSE", "CE", "OHSAS 18001", "Mesleki Yeterlilik Belgesi",
  "Çevre Yönetim Belgesi", "Kalite Yönetim Belgesi",
];

type CodeSuggestion = { code: string; label: string };

const KEYWORD_SUGGESTIONS: {
  keywords: string[];
  sektor: string;
  nace: CodeSuggestion[];
  cpv: CodeSuggestion[];
}[] = [
  {
    keywords: ["inşaat", "insaat", "yol", "yapı", "yapi", "bina", "şantiye", "santiye", "altyapı"],
    sektor: "İnşaat",
    nace: [
      { code: "41.20", label: "İkamet amaçlı bina inşaatı" },
      { code: "42.11", label: "Otoyol, tünel ve köprü inşaatı" },
    ],
    cpv: [
      { code: "45000000", label: "İnşaat işleri" },
      { code: "45233000", label: "İnşaat, temel ve yüzey işleri" },
    ],
  },
  {
    keywords: ["yazılım", "yazilim", "bilişim", "bilisim", "bilgisayar", "bt", "it", "donanım"],
    sektor: "Bilgi Teknolojileri",
    nace: [
      { code: "62.01", label: "Bilgisayar programlama faaliyetleri" },
      { code: "62.02", label: "Bilgisayar danışmanlık faaliyetleri" },
    ],
    cpv: [
      { code: "72000000", label: "BT hizmetleri: danışmanlık, yazılım geliştirme" },
      { code: "48000000", label: "Yazılım paketi ve bilişim sistemleri" },
    ],
  },
  {
    keywords: ["tıbbi", "tibbi", "medikal", "sağlık", "saglik", "hastane", "cihaz"],
    sektor: "Sağlık / Medikal",
    nace: [
      { code: "46.46", label: "Cerrahi, tıbbi ve ortopedik alet ticareti" },
      { code: "32.50", label: "Tıbbi ve dişçilik araç ve gereçleri" },
    ],
    cpv: [
      { code: "33000000", label: "Tıbbi cihazlar, farmasötikler" },
      { code: "33100000", label: "Tıbbi donanımlar" },
    ],
  },
  {
    keywords: ["temizlik", "hijyen", "çöp", "cop", "tesis"],
    sektor: "Tesis Yönetimi",
    nace: [
      { code: "81.21", label: "Binaların genel temizliği" },
      { code: "81.22", label: "Diğer bina ve endüstriyel temizlik" },
    ],
    cpv: [
      { code: "90910000", label: "Temizlik hizmetleri" },
      { code: "90900000", label: "Temizlik ve sanitasyon hizmetleri" },
    ],
  },
  {
    keywords: ["gıda", "gida", "yemek", "catering", "yiyecek", "içecek", "icecek"],
    sektor: "Gıda / Catering",
    nace: [
      { code: "56.29", label: "Diğer yiyecek hizmeti faaliyetleri" },
      { code: "56.21", label: "Özel günlerde yiyecek sağlanması" },
    ],
    cpv: [
      { code: "55500000", label: "Kantin ve yemek sunum hizmetleri" },
      { code: "15000000", label: "Yiyecek, içecek ve ilgili ürünler" },
    ],
  },
  {
    keywords: ["güvenlik", "guvenlik", "koruma", "bekçi"],
    sektor: "Güvenlik",
    nace: [
      { code: "80.10", label: "Özel güvenlik faaliyetleri" },
    ],
    cpv: [
      { code: "79710000", label: "Güvenlik hizmetleri" },
    ],
  },
  {
    keywords: ["elektrik", "mekanik", "tesisat", "enerji"],
    sektor: "Elektrik & Mekanik",
    nace: [
      { code: "43.21", label: "Elektrik tesisatı" },
      { code: "43.22", label: "Sıhhi tesisat, ısıtma ve iklimlendirme" },
    ],
    cpv: [
      { code: "45310000", label: "Elektrik tesisatı işleri" },
      { code: "09300000", label: "Elektrik, ısıtma, güneş ve nükleer enerji" },
    ],
  },
  {
    keywords: ["araç", "arac", "kiralama", "lojistik", "ulaşım", "ulasim", "taşıma", "tasima"],
    sektor: "Araç Kiralama & Lojistik",
    nace: [
      { code: "77.11", label: "Otomobil ve hafif motorlu kara taşıtı kiralama" },
      { code: "49.41", label: "Karayolu ile yük taşımacılığı" },
    ],
    cpv: [
      { code: "60000000", label: "Ulaştırma hizmetleri" },
      { code: "34110000", label: "Binek otomobiller" },
    ],
  },
];

const CODE_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of KEYWORD_SUGGESTIONS) {
    for (const c of [...g.nace, ...g.cpv]) map[c.code] = c.label;
  }
  return map;
})();

const STRATEGIES = [
  {
    key: "aggressive",
    label: "Agresif",
    icon: IconBolt,
    desc: "Yüksek kırım (%15-25), hacim odaklı büyüme.",
    why: "Daha fazla ihaleye girmek isteyenler için. Yapay zeka düşük marjlı, büyük hacimli ihaleleri öne çıkarır.",
    active: "border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-300",
    idle: "border-border bg-background text-foreground hover:border-rose-300",
  },
  {
    key: "balanced",
    label: "Dengeli",
    icon: IconScale,
    desc: "Orta kırım (%8-12), sürdürülebilir denge.",
    why: "Karlılık ve hacim dengesi arayanlar için. En sık tercih edilen stratejidir.",
    active: "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-300",
    idle: "border-border bg-background text-foreground hover:border-blue-300",
  },
  {
    key: "conservative",
    label: "Muhafazakâr",
    icon: IconShieldCheck,
    desc: "Düşük kırım (%3-7), yüksek kar marjı.",
    why: "Seçici davranıp yüksek kar hedefleyenler için. Yapay zeka yalnızca güçlü uyumlu ihaleleri önerir.",
    active: "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-300",
    idle: "border-border bg-background text-foreground hover:border-emerald-300",
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

function CircularProgress({ value, size = 132, strokeWidth = 11 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value < 30 ? "stroke-rose-500" : value < 70 ? "stroke-amber-500" : value < 100 ? "stroke-primary" : "stroke-emerald-500";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle className="stroke-muted" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className={`${color} transition-all duration-700 ease-out`}
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
        <span className="text-3xl font-bold tracking-tight">%{Math.round(value)}</span>
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Doğruluk</span>
      </div>
    </div>
  );
}

const ALLOWED_COMPANY_KEYS = [
  "companyName", "taxNumber", "mersisNumber", "ekapNumber",
  "naceCodes", "cpvCodes", "experienceCeiling", "certifications",
  "personnelCount", "annualRevenue", "preferredProvinces",
  "excludedProvinces", "discountStrategy", "aiBrief",
  "automationEnabled", "completionStep",
] as const;

function sanitizeCompanyPayload(raw: Record<string, any>): { companyName: string; taxNumber: string; [k: string]: any } {
  const out: Record<string, any> = {
    companyName: raw.companyName ?? "",
    taxNumber: raw.taxNumber ?? "",
  };
  for (const key of ALLOWED_COMPANY_KEYS) {
    if (key === "companyName" || key === "taxNumber") continue;
    const val = raw[key];
    if (val === null || val === undefined) continue;
    out[key] = val;
  }
  return out as { companyName: string; taxNumber: string };
}

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

function ChipSelector({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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

function ProfilTab() {
  const { user, isLoaded } = useUser();
  const { data: profile } = useGetCompanyProfile();
  const mutation = useUpsertCompanyProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!isLoaded) return <Skeleton className="h-64 w-full" />;

  const displayFirstName = firstName ?? user?.firstName ?? "";
  const displayLastName = lastName ?? user?.lastName ?? "";
  const displayBio = bio ?? (profile as any)?.aiBrief ?? "";

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await user?.setProfileImage({ file });
      toast.success("Profil fotoğrafı güncellendi.");
    } catch {
      toast.error("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveName = async () => {
    if (savingName) return;
    setSavingName(true);
    try {
      await user?.update({
        firstName: displayFirstName,
        lastName: displayLastName,
      });
      toast.success("İsim güncellendi.");
    } catch {
      toast.error("İsim güncellenemedi.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveBio = async () => {
    if (savingBio) return;
    setSavingBio(true);
    try {
      const existingProfile = profile as any;
      await mutation.mutateAsync({
        data: {
          companyName: existingProfile?.companyName ?? "",
          taxNumber: existingProfile?.taxNumber ?? "",
          aiBrief: displayBio,
        },
      });
      toast.success("Firma özeti güncellendi.");
    } catch {
      toast.error("Firma özeti kaydedilemedi.");
    } finally {
      setSavingBio(false);
    }
  };

  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() || "U";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil Fotoğrafı</CardTitle>
          <CardDescription>JPEG veya PNG, en fazla 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <div className="relative group">
            <div className="h-20 w-20 rounded-full bg-[#2D5BFF] flex items-center justify-center text-2xl font-bold text-white overflow-hidden shadow-md">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <IconCamera className="h-5 w-5 text-white" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" size="sm" onClick={handleAvatarClick} disabled={uploadingAvatar}>
            {uploadingAvatar ? "Yükleniyor…" : "Fotoğraf Değiştir"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad Soyad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ad</Label>
              <Input
                value={displayFirstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={handleSaveName}
                placeholder="Adınız"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Soyad</Label>
              <Input
                value={displayLastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={handleSaveName}
                placeholder="Soyadınız"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Alandan çıktığınızda otomatik kaydedilir.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Firma Özeti / AI Bağlamı</CardTitle>
          <CardDescription>Bu metin yapay zeka asistanının firmanızı tanımasını sağlar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Textarea
              rows={5}
              maxLength={500}
              value={displayBio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={handleSaveBio}
              placeholder="Örn: İnşaat sektöründe 15 yıllık deneyimimiz var. ISO 9001 belgemiz mevcut…"
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Alandan çıktığınızda otomatik kaydedilir.</p>
              <p className="text-xs text-muted-foreground">{displayBio.length} / 500</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WhyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[12px] leading-relaxed text-blue-800">
      <IconSparkles className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
      <span>{children}</span>
    </div>
  );
}

function CodeFinder({
  type,
  selected,
  onToggle,
}: {
  type: "nace" | "cpv";
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    const groups = KEYWORD_SUGGESTIONS.filter((g) =>
      g.keywords.some((k) => k.includes(q) || q.includes(k)) || g.sektor.toLowerCase().includes(q),
    );
    const out: { code: string; label: string; sektor: string }[] = [];
    for (const g of groups) {
      for (const c of g[type]) out.push({ ...c, sektor: g.sektor });
    }
    return out;
  }, [q, type]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sektör veya anahtar kelime yazın (örn: inşaat, yazılım, temizlik)"
          className="pl-9"
        />
      </div>

      {q && matches.length === 0 && (
        <p className="text-xs text-muted-foreground">Eşleşen kod bulunamadı. Aşağıdan elle de ekleyebilirsiniz.</p>
      )}

      {matches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {matches.map((m) => {
            const isSel = selected.includes(m.code);
            return (
              <button
                key={`${type}-${m.code}`}
                type="button"
                onClick={() => onToggle(m.code)}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  isSel ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${isSel ? "bg-primary text-primary-foreground" : "border border-muted-foreground/40"}`}>
                  {isSel && <IconCheck className="h-3 w-3" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold">{m.code}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-[15px]">{m.sektor}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-xs font-medium pl-2 pr-1 py-1">
              <span className="font-mono">{code}</span>
              {CODE_LABELS[code] && <span className="text-primary/70 font-normal max-w-[160px] truncate">· {CODE_LABELS[code]}</span>}
              <button type="button" onClick={() => onToggle(code)} className="rounded hover:bg-primary/20 p-0.5">
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SirketTab() {
  const { data: profile, isLoading } = useGetCompanyProfile();
  const mutation = useUpsertCompanyProfile();

  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const [aiExpertise, setAiExpertise] = useState<string[]>([]);
  const [aiStrengths, setAiStrengths] = useState<string[]>([]);
  const [aiAvoid, setAiAvoid] = useState<string[]>([]);
  const [aiExpYears, setAiExpYears] = useState<number>(0);
  const [aiNotes, setAiNotes] = useState<string>("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const data: Record<string, any> = { ...profile, ...form };
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const arr = (k: string): string[] => data[k] ?? [];
  const toggleArr = (k: string, val: string) => {
    const current: string[] = arr(k);
    set(k, current.includes(val) ? current.filter((x) => x !== val) : [...current, val]);
  };
  const toggleLocal = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
  ) => setter((c) => (c.includes(val) ? c.filter((x) => x !== val) : [...c, val]));

  const aiBriefComposed = buildAiBrief(aiExpertise, aiStrengths, aiExpYears, aiAvoid, aiNotes);
  const effectiveBrief = (data.aiBrief ?? "").trim() || aiBriefComposed;

  const score = (() => {
    let s = 0;
    if ((data.companyName ?? "").trim()) s += 15;
    if (arr("naceCodes").length > 0) s += 15;
    if (arr("cpvCodes").length > 0) s += 15;
    if (data.annualRevenue || data.experienceCeiling) s += 8;
    if (data.personnelCount) s += 7;
    if (effectiveBrief.length >= 40) s += 20;
    else if (effectiveBrief.length > 0) s += 8;
    if (arr("certifications").length > 0) s += 10;
    if (arr("preferredProvinces").length > 0) s += 5;
    if ((data.discountStrategy ?? "").trim()) s += 5;
    return Math.min(100, s);
  })();

  const checklist = [
    { label: "Firma adı", done: !!(data.companyName ?? "").trim() },
    { label: "NACE & CPV kodları", done: arr("naceCodes").length > 0 && arr("cpvCodes").length > 0 },
    { label: "Finansal kapasite", done: !!(data.annualRevenue || data.experienceCeiling) },
    { label: "Yapay zeka firma özeti", done: effectiveBrief.length >= 40 },
    { label: "Sertifikalar", done: arr("certifications").length > 0 },
    { label: "Strateji & iller", done: !!(data.discountStrategy ?? "").trim() },
  ];

  const composeBrief = () => {
    if (!aiBriefComposed) {
      toast.error("Önce uzmanlık veya güçlü yön seçin.");
      return;
    }
    set("aiBrief", aiBriefComposed);
    toast.success("Firma özeti oluşturuldu. Dilerseniz düzenleyebilirsiniz.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...data, aiBrief: effectiveBrief };
      await mutation.mutateAsync({ data: sanitizeCompanyPayload(payload) });
      toast.success("Şirket profili güncellendi.");
    } catch {
      toast.error("Kayıt başarısız. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* ── Main column ─────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Temel kimlik */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconBuilding className="h-4 w-4 text-primary" /> Firma Kimliği
            </CardTitle>
            <CardDescription>Yapay zekanın sizi tanıması için temel bilgiler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Firma Adı</Label>
              <Input
                defaultValue={data.companyName ?? ""}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Örn: ABC Yapı Ltd. Şti."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Yıllık Ciro (₺)</Label>
                <Input
                  type="number"
                  defaultValue={data.annualRevenue ?? ""}
                  onChange={(e) => set("annualRevenue", parseFloat(e.target.value) || null)}
                  placeholder="10000000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Personel Sayısı</Label>
                <Input
                  type="number"
                  defaultValue={data.personnelCount ?? ""}
                  onChange={(e) => set("personnelCount", parseInt(e.target.value) || null)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>İş Deneyim Tavanı (₺)</Label>
                <Input
                  type="number"
                  defaultValue={data.experienceCeiling ?? ""}
                  onChange={(e) => set("experienceCeiling", parseFloat(e.target.value) || null)}
                  placeholder="50000000"
                />
              </div>
            </div>
            <WhyBox>
              Ciro ve iş deneyim tavanı, bir ihalenin yaklaşık maliyetine göre <strong>yeterlilik
              sınırınızı</strong> belirler. Böylece yapay zeka boyu aşan ihaleleri elemenize yardımcı olur.
            </WhyBox>
          </CardContent>
        </Card>

        {/* NACE / CPV finder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconTargetArrow className="h-4 w-4 text-primary" /> Faaliyet Alanları (NACE & CPV)
            </CardTitle>
            <CardDescription>Ne iş yaptığınızı yazın, doğru kodları sizin için bulalım.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">NACE Kodları</Label>
              <CodeFinder type="nace" selected={arr("naceCodes")} onToggle={(c) => toggleArr("naceCodes", c)} />
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Kodu elle eklemek istiyorum</summary>
                <div className="pt-2">
                  <TagInput value={arr("naceCodes")} onChange={(v) => set("naceCodes", v)} placeholder="Örn: 41.20 — Enter ile ekle" />
                </div>
              </details>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-xs font-semibold text-muted-foreground">CPV Kodları</Label>
              <CodeFinder type="cpv" selected={arr("cpvCodes")} onToggle={(c) => toggleArr("cpvCodes", c)} />
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Kodu elle eklemek istiyorum</summary>
                <div className="pt-2">
                  <TagInput value={arr("cpvCodes")} onChange={(v) => set("cpvCodes", v)} placeholder="Örn: 45000000 — Enter ile ekle" />
                </div>
              </details>
            </div>
            <WhyBox>
              NACE ve CPV kodları ihale eşleştirmesinin <strong>en güçlü sinyalidir</strong>. Doğru kodlar,
              size uygun ihalelerin kaçırılmadan önünüze gelmesini sağlar.
            </WhyBox>
          </CardContent>
        </Card>

        {/* Guided AI questions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconBrain className="h-4 w-4 text-primary" /> Yapay Zeka Profili
            </CardTitle>
            <CardDescription>Birkaç soruyu yanıtlayın; eşleşme doğruluğunuz belirgin şekilde artar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><IconBriefcase className="h-3.5 w-3.5" /> Uzmanlık alanlarınız</Label>
              <ChipSelector options={AI_EXPERTISE_OPTIONS} selected={aiExpertise} onToggle={(v) => toggleLocal(setAiExpertise, v)} />
              <WhyBox>En iyi olduğunuz alanları seçin; yapay zeka bu alanlardaki ihaleleri öne çıkarır.</WhyBox>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><IconTrendingUp className="h-3.5 w-3.5" /> Rekabet avantajlarınız</Label>
              <ChipSelector options={AI_STRENGTH_OPTIONS} selected={aiStrengths} onToggle={(v) => toggleLocal(setAiStrengths, v)} />
              <WhyBox>Kazanma şansınızı artıran yönleriniz, kazanma olasılığı tahminini iyileştirir.</WhyBox>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5"><IconRosette className="h-3.5 w-3.5" /> Sektör deneyiminiz: <span className="font-semibold text-primary">{aiExpYears} yıl{aiExpYears >= 20 ? "+" : ""}</span></Label>
              <Slider value={[aiExpYears]} onValueChange={(v) => setAiExpYears(v[0])} min={0} max={20} step={1} />
              <WhyBox>Deneyim, benzer büyüklükteki işlerde güvenilirliğinizin bir göstergesidir.</WhyBox>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><IconX className="h-3.5 w-3.5" /> Tercih etmediğiniz ihale tipleri</Label>
              <ChipSelector options={AI_AVOID_OPTIONS} selected={aiAvoid} onToggle={(v) => toggleLocal(setAiAvoid, v)} />
              <WhyBox>Girmek istemediğiniz işler; gereksiz bildirimleri ve düşük uyumlu önerileri azaltır.</WhyBox>
            </div>

            <div className="space-y-2">
              <Label>Yapay Zeka Firma Özeti</Label>
              <Textarea
                rows={4}
                value={data.aiBrief ?? aiBriefComposed}
                onChange={(e) => set("aiBrief", e.target.value)}
                placeholder="Firmanızı birkaç cümleyle anlatın. Yukarıdaki seçimlerden otomatik oluşturabilir, sonra düzenleyebilirsiniz."
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={composeBrief}>
                  <IconSparkles className="h-3.5 w-3.5" /> Seçimlerden özet oluştur
                </Button>
                <span className="text-[11px] text-muted-foreground">{(data.aiBrief ?? aiBriefComposed).length}/500 karakter</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ek notlar (opsiyonel)</Label>
              <Textarea
                rows={2}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="Özetin sonuna eklenmesini istediğiniz serbest açıklama."
              />
            </div>
          </CardContent>
        </Card>

        {/* Strategy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconScale className="h-4 w-4 text-primary" /> Fiyatlama Stratejisi
            </CardTitle>
            <CardDescription>Yapay zekanın önerilerini iştahınıza göre ayarlar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STRATEGIES.map((s) => {
                const Icon = s.icon;
                const isSel = data.discountStrategy === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set("discountStrategy", s.key)}
                    className={`rounded-xl border p-3 text-left transition-all ${isSel ? s.active : s.idle}`}
                  >
                    <Icon className="h-5 w-5 mb-1.5" />
                    <div className="font-semibold text-sm">{s.label}</div>
                    <div className="text-[11px] opacity-80 mt-0.5 leading-snug">{s.desc}</div>
                  </button>
                );
              })}
            </div>
            {STRATEGIES.find((s) => s.key === data.discountStrategy) && (
              <WhyBox>{STRATEGIES.find((s) => s.key === data.discountStrategy)!.why}</WhyBox>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary" /> Sertifikalar & Belgeler
            </CardTitle>
            <CardDescription>Sahip olduğunuz kalite ve uyumluluk belgelerini işaretleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChipSelector options={CERTIFICATIONS} selected={arr("certifications")} onToggle={(v) => toggleArr("certifications", v)} />
            <WhyBox>Birçok ihale belirli belgeleri şart koşar. Belgeleriniz, yeterlilik filtrelemesini netleştirir.</WhyBox>
          </CardContent>
        </Card>

        {/* Provinces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconMapPin className="h-4 w-4 text-primary" /> Tercih Edilen İller
            </CardTitle>
            <CardDescription>Boş bırakırsanız tüm Türkiye kapsanır.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChipSelector options={TR_PROVINCES} selected={arr("preferredProvinces")} onToggle={(v) => toggleArr("preferredProvinces", v)} />
          </CardContent>
        </Card>

        <div className="flex justify-end pt-1">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Kaydediliyor…" : "Profili Kaydet"}
          </Button>
        </div>
      </div>

      {/* ── Sticky score sidebar ────────────────────────────── */}
      <div className="lg:sticky lg:top-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconBrain className="h-4 w-4 text-primary" /> AI Doğruluk Skoru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center">
              <CircularProgress value={score} />
              <p className="text-xs text-center text-muted-foreground mt-3 leading-relaxed">
                Profiliniz ne kadar eksiksizse, ihale eşleşmeleriniz o kadar isabetli olur.
              </p>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${c.done ? "bg-emerald-500 text-white" : "border border-muted-foreground/30"}`}>
                    {c.done && <IconCheck className="h-3 w-3" />}
                  </span>
                  <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                </div>
              ))}
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
              {saving ? "Kaydediliyor…" : "Profili Kaydet"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuvenlikTab() {
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Yeni şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifre ve onay şifresi eşleşmiyor.");
      return;
    }

    setSaving(true);
    try {
      await user?.updatePassword({ currentPassword, newPassword });
      toast.success("Şifreniz başarıyla güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? err?.message ?? "Şifre güncellenemedi.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Şifre Değiştir</CardTitle>
        <CardDescription>Hesabınızın güvenliği için güçlü bir şifre kullanın.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Mevcut Şifre</Label>
            <Input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">Yeni Şifre</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Yeni Şifre (Tekrar)</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Güncelleniyor…" : "Şifreyi Güncelle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const VALID_TABS = ["profil", "sirket", "belgeler", "guvenlik"] as const;

export default function AyarlarPage() {
  const [location, navigate] = useLocation();

  const tabFromUrl = (() => {
    const qIndex = location.indexOf("?");
    const search = qIndex >= 0 ? location.slice(qIndex + 1) : (typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "");
    const t = new URLSearchParams(search).get("tab");
    return t && (VALID_TABS as readonly string[]).includes(t) ? t : "profil";
  })();

  const [tab, setTab] = useState<string>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const onTabChange = (v: string) => {
    setTab(v);
    navigate(`/ayarlar?tab=${v}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground text-sm">Profil, şirket bilgilerinizi, belgelerinizi ve şifrenizi yönetin.</p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="profil" className="gap-2">
            <IconUser className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="sirket" className="gap-2">
            <IconBuilding className="h-4 w-4" />
            Şirket
          </TabsTrigger>
          <TabsTrigger value="belgeler" className="gap-2">
            <IconFolder className="h-4 w-4" />
            Belgelerim
          </TabsTrigger>
          <TabsTrigger value="guvenlik" className="gap-2">
            <IconLock className="h-4 w-4" />
            Güvenlik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <ProfilTab />
        </TabsContent>
        <TabsContent value="sirket">
          <SirketTab />
        </TabsContent>
        <TabsContent value="belgeler">
          <BelgelerimTab />
        </TabsContent>
        <TabsContent value="guvenlik">
          <GuvenlikTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
