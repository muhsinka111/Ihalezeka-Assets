import { useState, useEffect, useCallback, useRef } from "react";
import { useListTenders, useGetTenderFacets, useCreatePipelineItem } from "@workspace/api-client-react";
import type { SavedSearchCriteria } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AgencyLogo } from "@/components/AgencyLogo";
import { SavedSearchesBar } from "@/components/SavedSearchesBar";
import { Link, useSearch, useLocation } from "wouter";
import {
  IconSearch, IconFilter, IconMapPin, IconCalendar, IconBuilding,
  IconRefresh, IconX, IconChevronDown, IconChevronUp, IconArrowsSort,
  IconCurrencyLira, IconClock, IconAdjustmentsHorizontal, IconSparkles,
  IconLayoutKanban, IconCheck,
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

// value = stable canonical key the API maps to forgiving prefix matches over the
// messy underlying `type` column; label = what the user sees.
const TYPES = [
  { value: "mal", label: "Mal Alımı" },
  { value: "hizmet", label: "Hizmet Alımı" },
  { value: "yapim", label: "Yapım İşleri" },
  { value: "danismanlik", label: "Danışmanlık" },
];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.value, t.label]));
const METHODS = ["Açık İhale", "Belli İstekliler Arasında İhale", "Pazarlık Usulü"];

const STATUS_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "awarded", label: "Sonuçlandırıldı" },
  { value: "cancelled", label: "İptal Edildi" },
];

const SORT_OPTIONS = [
  { value: "relevance_desc", label: "En Alakalı" },
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
  sector?: string;
  usul?: string;
  idare?: string;
  minBedel?: number;
  maxBedel?: number;
  durum?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  source?: string;
  category?: string;
  sortBy?: string;
  sortDir?: string;
}

function parseUrlFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: p.get("q") || undefined,
    il: p.get("il") || undefined,
    tur: p.get("tur") || undefined,
    sector: p.get("sector") || undefined,
    usul: p.get("usul") || undefined,
    idare: p.get("idare") || undefined,
    minBedel: p.get("minBedel") ? Number(p.get("minBedel")) : undefined,
    maxBedel: p.get("maxBedel") ? Number(p.get("maxBedel")) : undefined,
    durum: p.get("durum") || undefined,
    deadlineFrom: p.get("deadlineFrom") || undefined,
    deadlineTo: p.get("deadlineTo") || undefined,
    source: p.get("source") || undefined,
    category: p.get("category") || undefined,
    sortBy: p.get("sortBy") || undefined,
    sortDir: p.get("sortDir") || undefined,
  };
}

function filtersToUrlParams(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.il) p.set("il", f.il);
  if (f.tur) p.set("tur", f.tur);
  if (f.sector) p.set("sector", f.sector);
  if (f.usul) p.set("usul", f.usul);
  if (f.idare) p.set("idare", f.idare);
  if (f.minBedel) p.set("minBedel", String(f.minBedel));
  if (f.maxBedel) p.set("maxBedel", String(f.maxBedel));
  if (f.durum) p.set("durum", f.durum);
  if (f.deadlineFrom) p.set("deadlineFrom", f.deadlineFrom);
  if (f.deadlineTo) p.set("deadlineTo", f.deadlineTo);
  if (f.source) p.set("source", f.source);
  if (f.category) p.set("category", f.category);
  if (f.sortBy) p.set("sortBy", f.sortBy);
  if (f.sortDir) p.set("sortDir", f.sortDir);
  return p.toString();
}

function appliedToCriteria(f: Filters): SavedSearchCriteria {
  const c: SavedSearchCriteria = {};
  if (f.q) c.q = f.q;
  if (f.il) c.il = f.il;
  if (f.tur) c.tur = f.tur;
  if (f.sector) c.sector = f.sector;
  if (f.usul) c.usul = f.usul;
  if (f.idare) c.idare = f.idare;
  if (f.minBedel) c.minBedel = f.minBedel;
  if (f.maxBedel) c.maxBedel = f.maxBedel;
  if (f.durum) c.durum = f.durum as SavedSearchCriteria["durum"];
  if (f.deadlineFrom) c.deadlineFrom = f.deadlineFrom;
  if (f.deadlineTo) c.deadlineTo = f.deadlineTo;
  if (f.source) c.source = f.source as SavedSearchCriteria["source"];
  if (f.category) c.category = f.category as SavedSearchCriteria["category"];
  return c;
}

const PIPELINE_STAGES = [
  { id: "discovery", label: "Fırsat Keşfi" },
  { id: "preparation", label: "Teklif Hazırlığı" },
  { id: "applied", label: "Başvuru Yapıldı" },
  { id: "evaluation", label: "Değerlendirme" },
  { id: "won", label: "Kazanıldı" },
];

const SOURCE_META: Record<string, { label: string; className: string }> = {
  ekap:            { label: "EKAP",           className: "bg-blue-100 text-blue-700 border-blue-200" },
  ilan_gov:        { label: "ilan.gov.tr",    className: "bg-amber-100 text-amber-700 border-amber-200" },
  ted:             { label: "TED AB",         className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  worldbank:       { label: "Dünya Bankası",  className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  ebrd:            { label: "EBRD",           className: "bg-purple-100 text-purple-700 border-purple-200" },
  kit:             { label: "KİT",            className: "bg-slate-100 text-slate-700 border-slate-200" },
  tubitak:         { label: "TÜBİTAK",       className: "bg-orange-100 text-orange-700 border-orange-200" },
  kosgeb:          { label: "KOSGEB",         className: "bg-lime-100 text-lime-700 border-lime-200" },
  kalkinma_ajansi: { label: "Kalkınma",       className: "bg-teal-100 text-teal-700 border-teal-200" },
};

function SourceBadge({ source }: { source?: string | null }) {
  const meta = SOURCE_META[source ?? "ekap"] ?? SOURCE_META["ekap"];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function MatchBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  // word_similarity (0–1) + field boosts (title +0.5, agency +0.2).
  const tier =
    score >= 0.7 ? { label: "Çok ilgili", className: "bg-emerald-100 text-emerald-700 border-emerald-200" } :
    score >= 0.4 ? { label: "İlgili", className: "bg-blue-100 text-blue-700 border-blue-200" } :
    null;
  if (!tier) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tier.className}`}>
      <IconSparkles className="h-2.5 w-2.5" />
      {tier.label}
    </span>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-violet-100 text-violet-700 border-violet-200">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
      Canlı
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (status === "awarded") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">Sonuçlandı</span>;
  if (status === "cancelled") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">İptal</span>;
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Aktif</span>;
}

interface SourceHealth {
  source: string;
  status: string;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  recordsFetched: number;
  recordsInserted: number;
  consecutiveFailures: number;
  errorMessage: string | null;
}

function useScraperStatus(onFinished?: () => void) {
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [perSource, setPerSource] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const wasRunning = useRef(false);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const r = await fetch(`${base}/api/admin/scraper/status`);
        if (!r.ok) return;
        const data = await r.json();
        if (data?.lastRunAt) setLastRunAt(data.lastRunAt);
        if (Array.isArray(data?.perSource)) setPerSource(data.perSource);
        const running = Boolean(data?.isRunning);
        setIsRunning(running);
        if (wasRunning.current && !running) {
          onFinished?.();
        }
        wasRunning.current = running;
        if (running) {
          timer = setTimeout(poll, 3000);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }

    poll();
    return () => clearTimeout(timer);
  }, []);

  return { lastRunAt, isRunning, perSource, loading };
}

const SOURCE_LABELS: Record<string, string> = {
  ekap: "EKAP",
  ilan_gov: "ilan.gov.tr",
  ted: "TED (AB)",
  worldbank: "Dünya Bankası",
  ebrd: "EBRD",
  kit: "KİT",
  tubitak: "TÜBİTAK",
  kosgeb: "KOSGEB",
  kalkinma_ajansi: "Kalkınma Ajansları",
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  success: { label: "Çalışıyor", dot: "bg-green-500", text: "text-green-700" },
  empty: { label: "Boş (0 kayıt)", dot: "bg-amber-500", text: "text-amber-700" },
  error: { label: "Hata", dot: "bg-red-500", text: "text-red-700" },
  disabled: { label: "Devre dışı", dot: "bg-gray-400", text: "text-gray-500" },
  never_run: { label: "Hiç çalışmadı", dot: "bg-gray-300", text: "text-gray-400" },
};

function SourceHealthPanel({ perSource }: { perSource: SourceHealth[] }) {
  const [open, setOpen] = useState(false);
  if (perSource.length === 0) return null;

  const problems = perSource.filter((s) => s.status === "error" || s.status === "empty").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={cn("h-2 w-2 rounded-full", problems > 0 ? "bg-red-500" : "bg-green-500")} />
        Kaynak durumu{problems > 0 ? ` (${problems} sorun)` : ""}
        {open ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-80 rounded-lg border bg-card shadow-lg p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
            Veri Kaynakları
          </div>
          <div className="space-y-0.5 max-h-80 overflow-auto">
            {perSource.map((s) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.never_run;
              return (
                <div key={s.source} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                  <span className={cn("h-2 w-2 rounded-full mt-1 shrink-0", meta.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{SOURCE_LABELS[s.source] ?? s.source}</span>
                      <span className={cn("text-[11px] font-medium shrink-0", meta.text)}>{meta.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {s.lastSuccessfulRunAt
                        ? `Son başarılı: ${formatRelativeTime(s.lastSuccessfulRunAt)} • ${s.recordsFetched} kayıt`
                        : "Henüz başarılı çekim yok"}
                      {s.consecutiveFailures > 0 ? ` • ${s.consecutiveFailures} ardışık başarısız` : ""}
                    </div>
                    {s.errorMessage && (s.status === "error" || s.status === "empty") && (
                      <div className="text-[11px] text-red-600 mt-0.5 line-clamp-2">{s.errorMessage}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  const queryClient = useQueryClient();
  const createPipeline = useCreatePipelineItem();
  const [pipelinePopover, setPipelinePopover] = useState<number | null>(null);
  const [pipelineSuccessIds, setPipelineSuccessIds] = useState<Set<number>>(new Set());

  const initialFilters = parseUrlFilters(rawSearch);

  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Pagination & active-filter state
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [showExpired, setShowExpired] = useState(false);

  // Live search state — ephemeral results from EKAP/İlan APIs (no DB write)
  const [liveItems, setLiveItems] = useState<any[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);

  // Resets pagination and accumulated items when filters or showExpired change.
  // We use a version counter so the effect that clears items runs synchronously
  // before the new data arrives.
  const filterVersion = useRef(0);

  const [secSektor, setSecSektor] = useState(true);
  const [secTemel, setSecTemel] = useState(true);
  const [secButce, setSecButce] = useState(true);
  const [secTarih, setSecTarih] = useState(true);
  const [secKaynak, setSecKaynak] = useState(true);

  // Default to showing only active/upcoming tenders (deadline >= today OR no deadline)
  // unless the user explicitly opts into showing expired ones.
  const todayStr = new Date().toISOString().split("T")[0];
  const effectiveDeadlineFrom = applied.deadlineFrom ?? (showExpired ? undefined : todayStr);

  const apiParams: any = {
    q: applied.q,
    il: applied.il,
    tur: applied.tur,
    sector: applied.sector,
    usul: applied.usul,
    idare: applied.idare,
    minBedel: applied.minBedel,
    maxBedel: applied.maxBedel,
    durum: applied.durum,
    deadlineFrom: effectiveDeadlineFrom,
    deadlineTo: applied.deadlineTo,
    source: applied.source,
    category: applied.category,
    sortBy: applied.sortBy,
    sortDir: applied.sortDir,
    page,
    limit: 50,
  };
  Object.keys(apiParams).forEach(k => apiParams[k] === undefined && delete apiParams[k]);

  const { data, isLoading, isFetching, refetch } = useListTenders(apiParams);
  const total = data?.total ?? 0;

  // Sector facet counts honour every active filter EXCEPT sector itself, so the
  // user sees how many tenders fall into each industry given their other choices.
  const facetParams: any = {
    q: applied.q,
    il: applied.il,
    tur: applied.tur,
    usul: applied.usul,
    idare: applied.idare,
    minBedel: applied.minBedel,
    maxBedel: applied.maxBedel,
    durum: applied.durum,
    deadlineFrom: effectiveDeadlineFrom,
    deadlineTo: applied.deadlineTo,
    source: applied.source,
    category: applied.category,
  };
  Object.keys(facetParams).forEach(k => facetParams[k] === undefined && delete facetParams[k]);
  const { data: facets } = useGetTenderFacets(facetParams);
  const sectorFacets = facets?.sectors ?? [];
  const sectorLabel = (id: string) => sectorFacets.find(s => s.id === id)?.label ?? id;

  // Accumulate items across pages; replace when page resets to 1.
  useEffect(() => {
    if (!data?.items) return;
    if (page === 1) {
      setAllItems(data.items);
    } else {
      setAllItems(prev => [...prev, ...data.items]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (pipelinePopover == null) return;
    const handler = () => setPipelinePopover(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [pipelinePopover]);

  const addToPipelineStage = useCallback(async (tenderId: number, stage: string) => {
    setPipelinePopover(null);
    try {
      await createPipeline.mutateAsync({ data: { tenderId, stage: stage as any } });
      setPipelineSuccessIds((prev) => new Set(prev).add(tenderId));
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    } catch {
    }
  }, [createPipeline, queryClient]);

  const { lastRunAt, perSource, loading: statusLoading } = useScraperStatus(
    useCallback(() => { refetch(); }, [refetch])
  );

  const resetPagination = useCallback(() => {
    filterVersion.current += 1;
    setPage(1);
    setAllItems([]);
    setLiveItems([]);
    setLiveTotal(0);
  }, []);

  // Sync filter state from the URL (deep links + the global top-bar search).
  // Reset pagination so a freshly submitted query never accumulates onto the
  // pages already loaded for the previous query.
  useEffect(() => {
    const parsed = parseUrlFilters(rawSearch);
    setDraft(parsed);
    setApplied(parsed);
    resetPagination();
  }, [rawSearch, resetPagination]);

  // Fire live search whenever the keyword query changes.
  // Runs in parallel with the DB query; results are merged by IKN to deduplicate.
  useEffect(() => {
    const q = applied.q?.trim();
    if (!q) {
      setLiveItems([]);
      setLiveTotal(0);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/tenders/live-search?q=${encodeURIComponent(q)}&take=20`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if (!cancelled) {
          setLiveItems(data.items ?? []);
          setLiveTotal((data.ekapTotal ?? 0) + (data.ilanTotal ?? 0));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLiveLoading(false); });
    return () => { cancelled = true; };
  }, [applied.q]);

  const applyFilters = useCallback((f: Filters) => {
    setApplied(f);
    resetPagination();
    const qs = filtersToUrlParams(f);
    navigate(`/ihale-arama${qs ? `?${qs}` : ""}`);
  }, [navigate, resetPagination]);

  const handleShowExpiredToggle = useCallback(() => {
    setShowExpired(v => !v);
    resetPagination();
  }, [resetPagination]);

  const handleApply = () => applyFilters(draft);

  const clearAll = () => {
    const empty: Filters = {};
    setDraft(empty);
    applyFilters(empty);
  };

  const applySavedSearch = useCallback((criteria: SavedSearchCriteria) => {
    const next: Filters = { ...(criteria as Filters) };
    setDraft(next);
    applyFilters(next);
  }, [applyFilters]);

  const removeChip = (key: keyof Filters) => {
    const next = { ...applied };
    delete next[key];
    if (key === "sortBy") delete next.sortDir;
    if (key === "deadlineFrom") delete next.deadlineTo;
    if (key === "deadlineTo") delete next.deadlineFrom;
    setDraft(next);
    applyFilters(next);
  };

  const loadMore = () => {
    setPage(p => p + 1);
  };

  const hasMore = allItems.length < total;
  const isLoadingMore = isFetching && page > 1;

  const currentSort = applied.sortBy && applied.sortDir
    ? `${applied.sortBy}_${applied.sortDir}`
    : applied.q
      ? "relevance_desc"
      : "deadline_asc";

  // Deduplicate live results — stored DB records take priority over live ones.
  // Then sort the merged list by the active sort criterion so live results slot
  // into the correct position rather than always appearing at the end.
  const storedIkns = new Set(allItems.map((t: any) => t.ikn).filter(Boolean));
  const uniqueLiveItems = liveItems.filter((t: any) => !storedIkns.has(t.ikn));
  const mergedItems: any[] = (() => {
    const raw = [...allItems, ...uniqueLiveItems];
    if (currentSort.startsWith("deadline")) {
      return raw.slice().sort((a, b) => {
        const aMs = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bMs = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return currentSort === "deadline_asc" ? aMs - bMs : bMs - aMs;
      });
    }
    if (currentSort.startsWith("estimatedValue")) {
      return raw.slice().sort((a, b) => {
        const aV = a.estimatedValue ?? -1;
        const bV = b.estimatedValue ?? -1;
        return currentSort === "estimatedValue_desc" ? bV - aV : aV - bV;
      });
    }
    return raw;
  })();

  const hasActiveFilters = Object.keys(appliedToCriteria(applied)).length > 0;

  const handleSortChange = (val: string) => {
    const [sortBy, sortDir] = val.split("_") as [string, string];
    const next = { ...applied, sortBy, sortDir };
    setDraft(next);
    applyFilters(next);
  };

  // Also reset page when URL-driven filter changes arrive from rawSearch
  const prevRawSearch = useRef(rawSearch);
  useEffect(() => {
    if (rawSearch !== prevRawSearch.current) {
      prevRawSearch.current = rawSearch;
      resetPagination();
    }
  }, [rawSearch, resetPagination]);

  const setDeadlineQuick = (days: number) => {
    const from = new Date().toISOString().split("T")[0];
    const to = new Date(Date.now() + days * 86400_000).toISOString().split("T")[0];
    setDraft(d => ({ ...d, deadlineFrom: from, deadlineTo: to }));
  };

  const activeChips: { key: keyof Filters; label: string }[] = [];
  if (applied.q) activeChips.push({ key: "q", label: `"${applied.q}"` });
  if (applied.il) activeChips.push({ key: "il", label: applied.il });
  if (applied.tur) activeChips.push({ key: "tur", label: TYPE_LABELS[applied.tur] ?? applied.tur });
  if (applied.sector) activeChips.push({ key: "sector", label: sectorLabel(applied.sector) });
  if (applied.usul) activeChips.push({ key: "usul", label: applied.usul });
  if (applied.idare) activeChips.push({ key: "idare", label: `İdare: ${applied.idare}` });
  if (applied.minBedel) activeChips.push({ key: "minBedel", label: `Min ₺${applied.minBedel.toLocaleString("tr-TR")}` });
  if (applied.maxBedel) activeChips.push({ key: "maxBedel", label: `Max ₺${applied.maxBedel.toLocaleString("tr-TR")}` });
  if (applied.durum) activeChips.push({ key: "durum", label: STATUS_OPTIONS.find(s => s.value === applied.durum)?.label ?? applied.durum });
  if (applied.deadlineFrom || applied.deadlineTo) activeChips.push({ key: "deadlineFrom", label: `Tarih: ${applied.deadlineFrom ?? "…"} → ${applied.deadlineTo ?? "…"}` });
  if (applied.source) activeChips.push({ key: "source", label: SOURCE_META[applied.source]?.label ?? applied.source });
  if (applied.category) activeChips.push({ key: "category", label: applied.category === "ihale" ? "İhale" : applied.category === "hibe" ? "Hibe / Destek" : "Uluslararası" });

  const FilterPanel = () => (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <SectionHeader title="Sektör" open={secSektor} onToggle={() => setSecSektor(v => !v)} />
        {secSektor && (
          <div className="mt-2 flex flex-col gap-1">
            <button
              onClick={() => setDraft(d => ({ ...d, sector: undefined }))}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left",
                !draft.sector ? "bg-primary text-white" : "hover:bg-muted"
              )}
            >
              <span>Tüm Sektörler</span>
            </button>
            {sectorFacets.map(s => (
              <button
                key={s.id}
                onClick={() => setDraft(d => ({ ...d, sector: d.sector === s.id ? undefined : s.id }))}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left",
                  draft.sector === s.id ? "bg-primary text-white font-medium" : "hover:bg-muted"
                )}
              >
                <span className="truncate">{s.label}</span>
                <span className={cn(
                  "shrink-0 tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                  draft.sector === s.id ? "bg-white/20" : "bg-muted text-muted-foreground"
                )}>
                  {s.count.toLocaleString("tr-TR")}
                </span>
              </button>
            ))}
            {sectorFacets.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2.5 py-1">Sektörler yükleniyor…</p>
            )}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <SectionHeader title="Temel Filtreler" open={secTemel} onToggle={() => setSecTemel(v => !v)} />
        {secTemel && (
          <div className="mt-2 space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">İl</label>
              <Select value={draft.il ?? "all"} onValueChange={v => setDraft(d => ({ ...d, il: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Tüm İller" /></SelectTrigger>
                <SelectContent className="max-h-64 min-w-[220px]">
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
                  {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
        <SectionHeader title="Kategori" open={secKaynak} onToggle={() => setSecKaynak(v => !v)} />
        {secKaynak && (
          <div className="mt-2 space-y-3">
            <div className="flex gap-1 flex-wrap">
              {[
                { value: undefined, label: "Tümü" },
                { value: "ihale", label: "İhale" },
                { value: "hibe", label: "Hibe / Destek" },
                { value: "uluslararasi", label: "Uluslararası" },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setDraft(d => ({ ...d, category: opt.value }))}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors",
                    draft.category === opt.value
                      ? "bg-primary text-white border-primary"
                      : "hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Kaynak</label>
              <Select value={draft.source ?? "all"} onValueChange={v => setDraft(d => ({ ...d, source: v === "all" ? undefined : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tüm Kaynaklar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                  <SelectItem value="ekap">EKAP</SelectItem>
                  <SelectItem value="ilan_gov">ilan.gov.tr</SelectItem>
                  <SelectItem value="ted">TED AB</SelectItem>
                  <SelectItem value="worldbank">Dünya Bankası</SelectItem>
                  <SelectItem value="ebrd">EBRD</SelectItem>
                  <SelectItem value="kit">KİT (TCDD, BOTAŞ…)</SelectItem>
                  <SelectItem value="tubitak">TÜBİTAK</SelectItem>
                  <SelectItem value="kosgeb">KOSGEB</SelectItem>
                  <SelectItem value="kalkinma_ajansi">Kalkınma Ajansları</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Show expired toggle */}
      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-muted-foreground">Süresi geçmiş ihaleler</span>
        <button
          onClick={handleShowExpiredToggle}
          className={cn(
            "relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors",
            showExpired ? "bg-primary" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform mt-[1px]",
              showExpired ? "translate-x-[18px]" : "translate-x-[1px]"
            )}
          />
        </button>
      </div>

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
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-1.5">
              <IconRefresh className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {statusLoading ? "Güncelleme kontrol ediliyor…" : lastRunAt ? `Son güncelleme: ${formatRelativeTime(lastRunAt)}` : "Henüz güncelleme yapılmadı"}
              </span>
            </div>
            <SourceHealthPanel perSource={perSource} />
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
        <SavedSearchesBar
          currentCriteria={appliedToCriteria(applied)}
          hasActiveFilters={hasActiveFilters}
          onApply={applySavedSearch}
        />
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
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
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
                  <span className="font-semibold text-foreground">{total.toLocaleString("tr-TR")}</span> ihale bulundu
                  {!showExpired && !applied.deadlineFrom && (
                    <span className="ml-1 text-xs text-muted-foreground">(aktif/yaklaşan)</span>
                  )}
                  {applied.q && liveTotal > 0 && (
                    <span className="ml-2 text-xs text-violet-600 font-medium">
                      + EKAP'ta {liveTotal.toLocaleString("tr-TR")} canlı sonuç
                    </span>
                  )}
                  {applied.q && liveLoading && (
                    <span className="ml-2 text-xs text-muted-foreground">EKAP'ta aranıyor…</span>
                  )}
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
          ) : mergedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <IconSearch className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">Arama kriterlerinize uygun ihale bulunamadı.</p>
              <p className="text-xs text-muted-foreground">Filtreleri değiştirerek tekrar deneyin.</p>
              {activeChips.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Filtreleri Temizle
                </Button>
              )}
              {!showExpired && (
                <Button variant="outline" size="sm" onClick={handleShowExpiredToggle}>
                  Süresi geçmiş ihaleler dahil et
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {mergedItems.map((tender: any) => {
                const hasDeadline = tender.deadline != null;
                const daysLeft = hasDeadline ? Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400_000) : null;
                const urgency = !hasDeadline ? "" : daysLeft! < 0 ? "text-destructive font-semibold" : daysLeft! === 0 ? "text-amber-600 font-semibold" : daysLeft! <= 3 ? "text-red-500 font-semibold" : daysLeft! <= 7 ? "text-amber-500 font-semibold" : "";
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
                                {tender._isLive ? <LiveBadge /> : <MatchBadge score={tender.relevance} />}
                              </div>
                              {tender._isLive ? (
                                <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  <p className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors line-clamp-2">{tender.title}</p>
                                </a>
                              ) : (
                                <Link href={`/ihale/${tender.id}`}>
                                  <p className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors line-clamp-2">{tender.title}</p>
                                </Link>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-xs whitespace-nowrap">{tender.type}</Badge>
                              {!tender._isLive && typeof tender.id === "number" && (
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                  {pipelineSuccessIds.has(tender.id) ? (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-medium border border-emerald-200">
                                      <IconCheck className="h-3 w-3" /> Eklendi
                                    </div>
                                  ) : (
                                    <button
                                      title="Boru Hattına Ekle"
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPipelinePopover(pipelinePopover === tender.id ? null : tender.id); }}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
                                    >
                                      <IconLayoutKanban className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Boru Hattı</span>
                                    </button>
                                  )}
                                  {pipelinePopover === tender.id && (
                                    <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border bg-card shadow-lg py-1">
                                      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aşama Seç</div>
                                      {PIPELINE_STAGES.map((s) => (
                                        <button
                                          key={s.id}
                                          onClick={() => addToPipelineStage(tender.id, s.id)}
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                                        >
                                          {s.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
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
                              {!hasDeadline ? "Tarih belirtilmemiş" : daysLeft! > 0 ? `${daysLeft} gün kaldı` : daysLeft! === 0 ? "Bugün son gün!" : "Süresi geçti"}
                            </span>
                            <span className={cn("flex items-center gap-0.5 text-xs", tender.estimatedValue != null ? "font-semibold text-foreground" : "text-muted-foreground")}>
                              <IconCurrencyLira className="h-3.5 w-3.5 shrink-0" />
                              {tender.estimatedValue != null ? tender.estimatedValue.toLocaleString("tr-TR") : "Belirtilmemiş"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Load More button */}
              {hasMore && (
                <div className="pt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="min-w-40 gap-2"
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Yükleniyor…
                      </span>
                    ) : (
                      <>
                        Daha Fazla Yükle
                        <span className="text-xs text-muted-foreground">({allItems.length}/{total.toLocaleString("tr-TR")})</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* All loaded indicator */}
              {!hasMore && allItems.length > 0 && total > 50 && (
                <p className="text-center text-xs text-muted-foreground pt-4">
                  Tüm {total.toLocaleString("tr-TR")} ihale gösterildi
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
