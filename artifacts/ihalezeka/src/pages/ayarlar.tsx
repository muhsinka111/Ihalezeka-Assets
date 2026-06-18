import { useState, useRef } from "react";
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
import {
  IconUser,
  IconBuilding,
  IconLock,
  IconCamera,
  IconCheck,
  IconX,
  IconPlus,
  IconExternalLink,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Link } from "wouter";

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "TSE", "CE", "OHSAS 18001", "Mesleki Yeterlilik Belgesi",
  "Çevre Yönetim Belgesi", "Kalite Yönetim Belgesi",
];

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
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden shadow-md">
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

function SirketTab() {
  const { data: profile, isLoading } = useGetCompanyProfile();
  const mutation = useUpsertCompanyProfile();

  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const data: Record<string, any> = { ...profile, ...form };
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const arr = (k: string): string[] => data[k] ?? [];
  const toggleArr = (k: string, val: string) => {
    const current: string[] = arr(k);
    set(k, current.includes(val) ? current.filter((x) => x !== val) : [...current, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mutation.mutateAsync({ data: sanitizeCompanyPayload(data) });
      toast.success("Şirket bilgileri güncellendi.");
    } catch {
      toast.error("Kayıt başarısız. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temel Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Firma Adı</Label>
              <Input
                defaultValue={data.companyName ?? ""}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Örn: ABC Yapı Ltd. Şti."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vergi Numarası</Label>
              <Input
                defaultValue={data.taxNumber ?? ""}
                onChange={(e) => set("taxNumber", e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yıllık Ciro (₺)</Label>
              <Input
                type="number"
                defaultValue={data.annualRevenue ?? ""}
                onChange={(e) => set("annualRevenue", parseFloat(e.target.value) || null)}
                placeholder="Örn: 10000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Personel Sayısı</Label>
              <Input
                type="number"
                defaultValue={data.personnelCount ?? ""}
                onChange={(e) => set("personnelCount", parseInt(e.target.value) || null)}
                placeholder="Örn: 50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>İş Deneyim Tavanı (₺)</Label>
              <Input
                type="number"
                defaultValue={data.experienceCeiling ?? ""}
                onChange={(e) => set("experienceCeiling", parseFloat(e.target.value) || null)}
                placeholder="Örn: 50000000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sertifikalar & Belgeler</CardTitle>
          <CardDescription>Sahip olduğunuz kalite ve uyumluluk belgelerini işaretleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChipSelector
            options={CERTIFICATIONS}
            selected={arr("certifications")}
            onToggle={(v) => toggleArr("certifications", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CPV Kodları</CardTitle>
          <CardDescription>Faaliyet alanlarınıza ait CPV kodları.</CardDescription>
        </CardHeader>
        <CardContent>
          <TagInput
            value={arr("cpvCodes")}
            onChange={(v) => set("cpvCodes", v)}
            placeholder="Örn: 45000000 — Enter ile ekle"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tercih Edilen İller</CardTitle>
          <CardDescription>Boş bırakırsanız tüm Türkiye kapsanır.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChipSelector
            options={TR_PROVINCES}
            selected={arr("preferredProvinces")}
            onToggle={(v) => toggleArr("preferredProvinces", v)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Link href="/basvuru-sihirbazi">
          <a className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <IconExternalLink className="h-3.5 w-3.5" />
            Tam sihirbazı aç (gelişmiş ayarlar)
          </a>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
        </Button>
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

export default function AyarlarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground text-sm">Profil, şirket bilgilerinizi ve şifrenizi yönetin.</p>
      </div>

      <Tabs defaultValue="profil">
        <TabsList className="mb-6">
          <TabsTrigger value="profil" className="gap-2">
            <IconUser className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="sirket" className="gap-2">
            <IconBuilding className="h-4 w-4" />
            Şirket
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
        <TabsContent value="guvenlik">
          <GuvenlikTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
