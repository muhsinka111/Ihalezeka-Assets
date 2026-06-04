import { useState, useEffect, useCallback } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Link, useSearch, useLocation } from "wouter";
import {
  IconSearch, IconFilter, IconMapPin, IconCalendar, IconBuilding,
  IconRefresh, IconX, IconChevronDown, IconChevronUp, IconArrowsSort,
  IconCurrencyLira, IconClock, IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const ILLER = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya",
  "Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik",
  "Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum",
  "Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir",
  "Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul",
  "İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis",
  "Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa",
  "Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize",
  "Sakarya","Samsun","Şanlıurfa","Siirt","Sinop","Şırnak","Sivas","Tekirdağ",
  "Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak",
];

const TYPES = ["Hizmet Alımı", "Yapım İşleri", "Mal Alımı", "Danışmanlık"];
const METHODS = ["Açık İhale", "Belli İstekliler Arasında İhale", "Pazarlık Usulü"];

const STATUS_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "awarded", label: "Sonuçlandırıldı" },
  { value: "cancelled", label: "İptal Edildi" },
];

const SORT_OPTIONS = [
  { value: "deadline_asc", label: "Son Başvuru (Yakın → Uzak)" },
  { value: "deadline_desc", label: "Son Başvuru (Uzak → Yakın)" },
  { value: "estimatedValue_desc", label: "Bütçe (Yüksek → Düşük)" },
  { value: "estimatedValue_asc", label: "Bütçe (Düşük → Yüksek)" },
  { value: "createdAt_desc", label: "En Yeni Eklenen" },
];

interface Filters {
  q?: string;
  il?: string;
  tur?: string;
  usul?: string;
  idare?: string;
  minBedel?: number;
  maxBedel?: number;
  durum?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  source?: string;
  sortBy?: string;
  sortDir?: string;
}

function parseUrlFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: p.get("q") || undefined,
    il: p.get("il") || undefined,
    tur: p.get("tur") || undefined,
    usul: p.get("usul") || undefined,
    idare: p.get("idare") || undefined,
    minBedel: p.get("minBedel") ? Number(p.get("minBedel")) : undefined,
    maxBedel: p.get("maxBedel") ? Number(p.get("maxBedel")) : undefined,
    durum: p.get("durum") || undefined,
    deadlineFrom: p.get("deadlineFrom") || undefined,
    deadlineTo: p.get("deadlineTo") || undefined,
    source: p.get("source") || undefined,
    sortBy: p.get("sortBy") || undefined,
    sortDir: p.get("sortDir") || undefined,
  };
}

function filtersToUrlParams(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.il) p.set("il", f.il);
  if (f.tur) p.set("tur", f.tur);
  if (f.usul) p.set("usul", f.usul);
  if (f.idare) p.set("idare", f.idare);
  if (f.minBedel) p.set("minBedel", String(f.minBedel));
  if (f.maxBedel) p.set("maxBedel", String(f.maxBedel));
  if (f.durum) p.set("durum", f.durum);
  if (f.deadlineFrom) p.set("deadlineFrom", f.deadlineFrom);
  if (f.deadlineTo) p.set("deadlineTo", f.deadlineTo);
  if (f.source) p.set("source", f.source);
  if (f.sortBy) p.set("sortBy", f.sortBy);
  if (f.sortDir) p.set("sortDir", f.sortDir);
  return p.toString();
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "ekap") {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">EKAP</span>;
  }
  if (source === "ilan_gov") {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">ilan.gov.tr</span>;
  }
  return null;
}

function StatusBadge({ status }: { status?: string | null }) {
  if (status === "awarded") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">Sonuçlandı</span>;
  if (status === "cancelled") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">İptal</span>;
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Aktif</span>;
}

function useScraperStatus() {
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${base}/api/admin/scraper/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.lastRunAt) setLastRunAt(data.lastRunAt); })
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
  return `${Math.floor(hrs / 24)} gün önce`;
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1"
    >
      {title}
      {open ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function IhaleAramaPage() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();

  const initialFilters = parseUrlFilters(rawSearch);

  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);

  useEffect(() => {
    const parsed = parseUrlFilters(rawSearch);
    setDraft(parsed);
    setApplied(parsed);
  }, [rawSearch]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [secTemel, setSecTemel] = useState(true);
  const [secButce, setSecButce] = useState(true);
  const [secTarih, setSecTarih] = useState(true);
  const [secKaynak, setSecKaynak] = useState(true);

  const { lastRunAt, loading: statusLoading } = useScraperStatus();

  const apiParams: any = {
    q: applied.q,
    il: applied.il,
    tur: applied.tur,
    usul: applied.usul,
    idare: applied.idare,
    minBedel: applied.minBedel,
    maxBedel: applied.maxBedel,
    durum: applied.durum,
    deadlineFrom: applied.deadlineFrom,
    deadlineTo: applied.deadlineTo,
    source: applied.source,
    sortBy: applied.sortBy,
    sortDir: applied.sortDir,
  };
  Object.keys(apiParams).forEach(k => apiParams[k] === undefined && delete apiParams[k]);

  const { data, isLoading } = useListTenders(apiParams);
  const tenders = data?.items ?? [];

  const applyFilters = useCallback((f: Filters) => {
    setApplied(f);
    const qs = filtersToUrlParams(f);
    navigate(`/ihale-arama${qs ? `?${qs}` : ""}`);
  }, [navigate]);

  const handleApply = () => applyFilters(draft);

  const clearAll = () => {
    const empty: Filters = {};
    setDraft(empty);
    applyFilters(empty);
  };

  const removeChip = (key: keyof Filters) => {
    const next = { ...applied };
    delete next[key];
    if (key === "sortBy") delete next.sortDir;
    if (key === "deadlineFrom") delete next.deadlineTo;
    if (key === "deadlineTo") delete next.deadlineFrom;
    setDraft(next);
    applyFilters(next);
  };

  const currentSort = applied.sortBy && applied.sortDir
    ? `${applied.sortBy}_${applied.sortDir}`
    : "deadline_asc";

  const handleSortChange = (val: string) => {
    const [sortBy, sortDir] = val.split("_") as [string, string];
    const next = { ...applied, sortBy, sortDir };
    setDraft(next);
    applyFilters(next);
  };

  const setDeadlineQuick = (days: number) => {
    const from = new Date().toISOString().split("T")[0];
    const to = new Date(Date.now() + days * 86400_000).toISOString().split("T")[0];
    setDraft(d => ({ ...d, deadlineFrom: from, deadlineTo: to }));
  };

  const activeChips: { key: keyof Filters; label: string }[] = [];
  if (applied.q) activeChips.push({ key: "q", label: `"${applied.q}"` });
  if (applied.il) activeChips.push({ key: "il", label: applied.il });
  if (applied.tur) activeChips.push({ key: "tur", label: applied.tur });
  if (applied.usul) activeChips.push({ key: "usul", label: applied.usul });
  if (applied.idare) activeChips.push({ key: "idare", label: `İdare: ${applied.idare}` });
  if (applied.minBedel) activeChips.push({ key: "minBedel", label: `Min ₺${applied.minBedel.toLocaleString("tr-TR")}` });
  if (applied.maxBedel) activeChips.push({ key: "maxBedel", label: `Max ₺${applied.maxBedel.toLocaleString("tr-TR")}` });
  if (applied.durum) activeChips.push({ key: "durum", label: STATUS_OPTIONS.find(s => s.value === applied.durum)?.label ?? applied.durum });
  if (applied.deadlineFrom || applied.deadlineTo) activeChips.push({ key: "deadlineFrom", label: `Tarih: ${applied.deadlineFrom ?? "…"} → ${applied.deadlineTo ?? "…"}` });
  if (applied.source) activeChips.push({ key: "source", label: applied.source === "ekap" ? "EKAP" : "ilan.gov.tr" });

  const FilterPanel = () => (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <SectionHeader title="Temel Filtreler" open={secTemel} onToggle={() => setSecTemel(v => !v)} />
        {secTemel && (
          <div className="mt-2 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">İl</label>
              <Select value={draft.il ?? "all"} onValueChange={v => setDraft(d => ({ ...d, il: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm İller" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm İller</SelectItem>
                  {ILLER.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">İhale Türü</label>
              <Select value={draft.tur ?? "all"} onValueChange={v => setDraft(d => ({ ...d, tur: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm Türler" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Türler</SelectItem>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">İhale Usulü</label>
              <Select value={draft.usul ?? "all"} onValueChange={v => setDraft(d => ({ ...d, usul: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm Usuller" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Usuller</SelectItem>
                  {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Durum</label>
              <Select value={draft.durum ?? "all"} onValueChange={v => setDraft(d => ({ ...d, durum: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm Durumlar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">İdare Adı</label>
              <Input
                className="h-8 text-xs"
                placeholder="İdare adı ile ara…"
                value={draft.idare ?? ""}
                onChange={e => setDraft(d => ({ ...d, idare: e.target.value || undefined }))}
                onKeyDown={e => e.key === "Enter" && handleApply()}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <SectionHeader title="Bütçe" open={secButce} onToggle={() => setSecButce(v => !v)} />
        {secButce && (
          <div className="mt-2 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Min. Tahmini Bedel (₺)</label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="0"
                value={draft.minBedel ?? ""}
                onChange={e => setDraft(d => ({ ...d, minBedel: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max. Tahmini Bedel (₺)</label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="Sınırsız"
                value={draft.maxBedel ?? ""}
                onChange={e => setDraft(d => ({ ...d, maxBedel: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <SectionHeader title="Son Başvuru Tarihi" open={secTarih} onToggle={() => setSecTarih(v => !v)} />
        {secTarih && (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Bu hafta", days: 7 },
                { label: "Bu ay", days: 30 },
                { label: "3 ay", days: 90 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setDeadlineQuick(days)}
                  className="px-2 py-0.5 rounded-full border text-[11px] hover:bg-primary hover:text-white hover:border-primary transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Başlangıç Tarihi</label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={draft.deadlineFrom ?? ""}
                onChange={e => setDraft(d => ({ ...d, deadlineFrom: e.target.value || undefined }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bitiş Tarihi</label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={draft.deadlineTo ?? ""}
                onChange={e => setDraft(d => ({ ...d, deadlineTo: e.target.value || undefined }))}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <SectionHeader title="Kaynak" open={secKaynak} onToggle={() => setSecKaynak(v => !v)} />
        {secKaynak && (
          <div className="mt-2">
            <Select value={draft.source ?? "all"} onValueChange={v => setDraft(d => ({ ...d, source: v === "all" ? undefined : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm Kaynaklar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                <SelectItem value="ekap">EKAP</SelectItem>
                <SelectItem value="ilan_gov">ilan.gov.tr</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2 pt-1">
        <Button size="sm" onClick={handleApply} className="w-full gap-1.5">
          <IconFilter className="h-3.5 w-3.5" /> Filtrele
        </Button>
        {activeChips.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearAll} className="w-full text-xs text-muted-foreground">
            Filtreleri Temizle
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">İhale Arama</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <IconRefresh className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {statusLoading ? "Güncelleme kontrol ediliyor…" : lastRunAt ? `Son güncelleme: ${formatRelativeTime(lastRunAt)}` : "Henüz güncelleme yapılmadı"}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="İhale başlığı, idare adı veya konu ile arayın…"
            value={draft.q ?? ""}
            onChange={e => setDraft(d => ({ ...d, q: e.target.value || undefined }))}
            onKeyDown={e => e.key === "Enter" && handleApply()}
          />
        </div>
        <Button onClick={handleApply} className="gap-2 shrink-0">
          <IconSearch className="h-4 w-4" /> Ara
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setMobileSidebarOpen(v => !v)}
        >
          <IconAdjustmentsHorizontal className="h-4 w-4" />
          {activeChips.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
              {activeChips.length}
            </span>
          )}
        </Button>
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {activeChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => removeChip(chip.key)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              {chip.label}
              <IconX className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            Tümünü temizle
          </button>
        </div>
      )}

      {/* Main Layout: sidebar + results */}
      <div className="flex gap-6 items-start">

        {/* Desktop Sidebar */}
        <div className={cn(
          "hidden md:block shrink-0 transition-all duration-200",
          sidebarOpen ? "w-56" : "w-0 overflow-hidden"
        )}>
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <IconAdjustmentsHorizontal className="h-3.5 w-3.5" /> Filtreler
                </span>
                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
              <FilterPanel />
            </CardContent>
          </Card>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-background shadow-xl overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">Filtreler</span>
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <IconX className="h-5 w-5" />
                </button>
              </div>
              <FilterPanel />
            </div>
          </div>
        )}

        {/* Results Column */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Sort + count bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)} className="gap-1.5 text-xs hidden md:flex">
                  <IconAdjustmentsHorizontal className="h-3.5 w-3.5" /> Filtreler
                  {activeChips.length > 0 && (
                    <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{activeChips.length}</Badge>
                  )}
                </Button>
              )}
              {!isLoading && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{data?.total ?? tenders.length}</span> ihale bulundu
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <IconArrowsSort className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={currentSort} onValueChange={handleSortChange}>
                <SelectTrigger className="h-8 text-xs w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : tenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <IconSearch className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">Arama kriterlerinize uygun ihale bulunamadı.</p>
              <p className="text-xs text-muted-foreground">Filtreleri değiştirerek tekrar deneyin.</p>
              {activeChips.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {tenders.map((tender: any) => {
                const daysLeft = Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400_000);
                const urgency = daysLeft <= 0 ? "text-destructive font-semibold" : daysLeft <= 3 ? "text-red-500 font-semibold" : daysLeft <= 7 ? "text-amber-500 font-semibold" : "";
                return (
                  <Card key={tender.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-3.5 pb-3.5">
                      <div className="flex items-start gap-3">
                        <AgencyLogo name={tender.agencyName} logoUrl={tender.agencyLogoUrl} className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <p className="text-[11px] text-muted-foreground font-mono">{tender.ikn}</p>
                                <SourceBadge source={tender.sourceSystem} />
                                <StatusBadge status={tender.status} />
                              </div>
                              <Link href={`/ihale/${tender.id}`}>
                                <p className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors line-clamp-2">{tender.title}</p>
                              </Link>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs whitespace-nowrap">{tender.type}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[180px]">
                              <IconBuilding className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{tender.agencyName}</span>
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <IconMapPin className="h-3.5 w-3.5 shrink-0" />{tender.il}
                            </span>
                            <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", urgency)}>
                              <IconClock className="h-3.5 w-3.5 shrink-0" />
                              {daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süresi geçti"}
                            </span>
                            {tender.estimatedValue > 0 && (
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-foreground">
                                <IconCurrencyLira className="h-3.5 w-3.5 shrink-0" />
                                {tender.estimatedValue.toLocaleString("tr-TR")}
                              </span>
                            )}
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
    </div>
  );
}
