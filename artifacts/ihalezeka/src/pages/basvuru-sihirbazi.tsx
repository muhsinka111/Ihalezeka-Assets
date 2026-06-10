import { useState } from "react";
import { useGetCompanyProfile, useUpsertCompanyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { IconCheck, IconArrowRight, IconArrowLeft, IconBuilding, IconChartBar, IconCoin, IconUsers, IconBolt, IconBrain } from "@tabler/icons-react";

const STEPS = [
  { id: 1, label: "Firma Kimliği", icon: IconBuilding },
  { id: 2, label: "Faaliyet Alanları", icon: IconChartBar },
  { id: 3, label: "Mali Yeterlilik", icon: IconCoin },
  { id: 4, label: "Deneyim & Personel", icon: IconUsers },
  { id: 5, label: "Teklif Stratejisi", icon: IconBolt },
  { id: 6, label: "AI Bağlamı", icon: IconBrain },
];

export default function BasvuruSihirbazPage() {
  const { data: profile, isLoading } = useGetCompanyProfile();
  const mutation = useUpsertCompanyProfile();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const data = { ...profile, ...form };

  const save = async () => {
    setSaving(true);
    await mutation.mutateAsync({ data: { ...data, completionStep: step } });
    setSaving(false);
    if (step < 6) setStep(step + 1);
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Başvuru Sihirbazı</h1>
        <p className="text-muted-foreground text-sm">Firma profilinizi tamamlayarak yapay zeka destekli ihale eşleştirmesini etkinleştirin.</p>
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
            <CardContent className="space-y-4">
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Firma Adı</Label>
                      <Input defaultValue={data.companyName} onChange={(e) => set("companyName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vergi Numarası</Label>
                      <Input defaultValue={data.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>MERSİS Numarası</Label>
                      <Input defaultValue={data.mersisNumber} onChange={(e) => set("mersisNumber", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>EKAP Numarası</Label>
                      <Input defaultValue={data.ekapNumber} onChange={(e) => set("ekapNumber", e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>NACE Kodları (virgülle ayırın)</Label>
                    <Input defaultValue={data.naceCodes?.join(", ")} onChange={(e) => set("naceCodes", e.target.value.split(",").map((s: string) => s.trim()))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPV Kodları (virgülle ayırın)</Label>
                    <Input defaultValue={data.cpvCodes?.join(", ")} onChange={(e) => set("cpvCodes", e.target.value.split(",").map((s: string) => s.trim()))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tercih Edilen İller</Label>
                    <Input defaultValue={data.preferredProvinces?.join(", ")} onChange={(e) => set("preferredProvinces", e.target.value.split(",").map((s: string) => s.trim()))} />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>İş Deneyim Tavanı (₺)</Label>
                      <Input type="number" defaultValue={data.experienceCeiling} onChange={(e) => set("experienceCeiling", parseFloat(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Yıllık Ciro (₺)</Label>
                      <Input type="number" defaultValue={data.annualRevenue} onChange={(e) => set("annualRevenue", parseFloat(e.target.value))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sertifikalar (virgülle ayırın)</Label>
                    <Input defaultValue={data.certifications?.join(", ")} onChange={(e) => set("certifications", e.target.value.split(",").map((s: string) => s.trim()))} />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Toplam Personel Sayısı</Label>
                    <Input type="number" defaultValue={data.personnelCount} onChange={(e) => set("personnelCount", parseInt(e.target.value))} />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Kırım Stratejisi</Label>
                    <Input defaultValue={data.discountStrategy} onChange={(e) => set("discountStrategy", e.target.value)} placeholder="Örn: Standart kırım: %8-12" />
                  </div>
                </div>
              )}

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
