import { useState } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Link } from "wouter";
import { IconSearch, IconFilter, IconMapPin, IconCalendar, IconBuilding } from "@tabler/icons-react";

const ILLER = ["Ankara", "İstanbul", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Kayseri"];
const TYPES = ["Hizmet Alımı", "Yapım İşleri", "Mal Alımı", "Danışmanlık"];
const METHODS = ["Açık İhale", "Belli İstekliler Arasında İhale", "Pazarlık Usulü"];

export default function IhaleAramaPage() {
  const [q, setQ] = useState("");
  const [il, setIl] = useState<string | undefined>();
  const [tur, setTur] = useState<string | undefined>();
  const [usul, setUsul] = useState<string | undefined>();
  const [search, setSearch] = useState<{ q?: string; il?: string; tur?: string; usul?: string }>({});

  const { data, isLoading } = useListTenders(search);
  const tenders = data?.items ?? [];

  const handleSearch = () => {
    setSearch({ q: q || undefined, il: il || undefined, tur: tur || undefined, usul: usul || undefined });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">İhale Arama</h1>
        <p className="text-muted-foreground text-sm">Tüm kamu ihalelerini filtreleyin ve keşfedin.</p>
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
            <Button variant="outline" size="sm" onClick={() => { setSearch({}); setQ(""); setIl(undefined); setTur(undefined); setUsul(undefined); }}>
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
                            <p className="text-xs text-muted-foreground font-mono mb-0.5">{tender.ikn}</p>
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
