import { useState, useEffect } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Link } from "wouter";
import { IconSearch, IconFilter, IconMapPin, IconCalendar, IconBuilding, IconRefresh } from "@tabler/icons-react";

const ILLER = [
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

const TYPES = ["Hizmet Alımı", "Yapım İşleri", "Mal Alımı", "Danışmanlık"];
const METHODS = ["Açık İhale", "Belli İstekliler Arasında İhale", "Pazarlık Usulü"];

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "ekap") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
        EKAP
      </span>
    );
  }
  if (source === "ilan_gov") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        ilan.gov.tr
      </span>
    );
  }
  return null;
}

function useScraperStatus() {
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${base}/api/admin/scraper/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.lastRunAt) setLastRunAt(data.lastRunAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { lastRunAt, loading };
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "az önce";
  if (mins < 60) return `${mins} dakika önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}

export default function IhaleAramaPage() {
  const [q, setQ] = useState("");
  const [il, setIl] = useState<string | undefined>();
  const [tur, setTur] = useState<string | undefined>();
  const [usul, setUsul] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [search, setSearch] = useState<{ q?: string; il?: string; tur?: string; usul?: string; source?: string }>({});

  const { data, isLoading } = useListTenders(search as any);
  const tenders = data?.items ?? [];
  const { lastRunAt, loading: statusLoading } = useScraperStatus();

  const handleSearch = () => {
    setSearch({
      q: q || undefined,
      il: il || undefined,
      tur: tur || undefined,
      usul: usul || undefined,
      source: source || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">İhale Arama</h1>
        <p className="text-muted-foreground text-sm">Tüm kamu ihalelerini filtreleyin ve keşfedin.</p>
        <div className="flex items-center gap-1.5 mt-1">
          <IconRefresh className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {statusLoading
              ? "Güncelleme kontrol ediliyor…"
              : lastRunAt
                ? `Son güncelleme: ${formatRelativeTime(lastRunAt)}`
                : "Henüz güncelleme yapılmadı"}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="İhale başlığı, idare adı veya konu ile arayın…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select value={il} onValueChange={(v) => setIl(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="İl seçin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm İller</SelectItem>
                {ILLER.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tur} onValueChange={(v) => setTur(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={usul} onValueChange={(v) => setUsul(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Usul" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Usuller</SelectItem>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => setSource(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Kaynak" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                <SelectItem value="ekap">EKAP</SelectItem>
                <SelectItem value="ilan_gov">ilan.gov.tr</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} className="gap-2">
              <IconFilter className="h-4 w-4" /> Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : tenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-muted-foreground">Arama kriterlerinize uygun ihale bulunamadı.</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch({}); setQ(""); setIl(undefined); setTur(undefined); setUsul(undefined); setSource(undefined); }}>
              Filtreleri Temizle
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data?.total ?? tenders.length} sonuç bulundu</p>
            {tenders.map((tender: any) => {
              const daysLeft = Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400_000);
              return (
                <Card key={tender.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      <AgencyLogo name={tender.agencyName} logoUrl={tender.agencyLogoUrl} className="h-10 w-10 rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xs text-muted-foreground font-mono">{tender.ikn}</p>
                              <SourceBadge source={tender.sourceSystem} />
                            </div>
                            <Link href={`/ihale/${tender.id}`}>
                              <p className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors line-clamp-2">{tender.title}</p>
                            </Link>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">{tender.type}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconBuilding className="h-3.5 w-3.5" />{tender.agencyName}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconMapPin className="h-3.5 w-3.5" />{tender.il}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconCalendar className="h-3.5 w-3.5" />
                            <span className={daysLeft <= 0 ? "text-destructive font-semibold" : daysLeft <= 7 ? "text-amber-500 font-semibold" : ""}>
                              {daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süresi geçti"}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-foreground">₺{tender.estimatedValue.toLocaleString("tr-TR")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
