import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconRefresh,
  IconDatabase,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconLoader2,
  IconCircleX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface SourceStatus {
  source: string;
  status: string;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  recordsFetched: number;
  recordsInserted: number;
  consecutiveFailures: number;
  errorMessage: string | null;
}

interface ScraperStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  tenderCount: number;
  perSource: SourceStatus[];
}

const SOURCE_LABELS: Record<string, string> = {
  ekap: "EKAP",
  ilan_gov: "ilan.gov.tr",
  ted: "TED (AB İhaleleri)",
  worldbank: "Dünya Bankası",
  ebrd: "EBRD",
  kit: "KİT",
  tcdd: "TCDD",
  botas: "BOTAŞ",
  tpao: "TPAO",
  dhmi: "DHMİ",
  toki: "TOKİ",
  dsi: "DSİ",
  tubitak: "TÜBİTAK",
  kosgeb: "KOSGEB",
  kalkinma_ajansi: "Kalkınma Ajansları",
};

const PRIMARY_SOURCES = ["ekap", "ilan_gov"];

function fmt(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
      <IconCheck className="h-3 w-3" /> Başarılı
    </Badge>
  );
  if (status === "error") return (
    <Badge className="gap-1 bg-rose-100 text-rose-700 border-rose-200">
      <IconCircleX className="h-3 w-3" /> Hata
    </Badge>
  );
  if (status === "empty") return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200">
      <IconAlertTriangle className="h-3 w-3" /> Boş
    </Badge>
  );
  if (status === "never_run") return (
    <Badge variant="outline" className="text-muted-foreground">Hiç çalışmadı</Badge>
  );
  if (status === "disabled") return (
    <Badge variant="outline" className="text-muted-foreground">Devre dışı</Badge>
  );
  return <Badge variant="outline">{status}</Badge>;
}

interface RunState {
  loading: boolean;
  result: { inserted: number; fetched: number } | null;
  error: string | null;
}

export default function AdminPage() {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/scraper/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Durum alınamadı");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const runScraper = async (source: string) => {
    setRunStates((prev) => ({ ...prev, [source]: { loading: true, result: null, error: null } }));
    try {
      const res = await fetch(`${API_BASE}/admin/scraper/run?source=${source}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      let inserted = 0;
      let fetched = 0;
      if (source === "both" || source === "all") {
        inserted = (data.ekap?.result?.inserted ?? 0) + (data.ilan_gov?.result?.inserted ?? 0);
        fetched = (data.ekap?.result?.fetched ?? 0) + (data.ilan_gov?.result?.fetched ?? 0);
      } else {
        inserted = data.result?.inserted ?? data.result?.recordsInserted ?? 0;
        fetched = data.result?.fetched ?? data.result?.recordsFetched ?? 0;
      }
      setRunStates((prev) => ({ ...prev, [source]: { loading: false, result: { inserted, fetched }, error: null } }));
    } catch (err) {
      setRunStates((prev) => ({
        ...prev,
        [source]: { loading: false, result: null, error: err instanceof Error ? err.message : "Hata" },
      }));
    } finally {
      await fetchStatus();
    }
  };

  const anyRunning = Object.values(runStates).some((s) => s.loading);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <IconLoader2 className="h-5 w-5 animate-spin" />
        <span>Yükleniyor…</span>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <div className="text-destructive font-medium">Yönetim paneli yüklenemedi</div>
        <div className="text-sm text-muted-foreground">{statusError}</div>
        <Button variant="outline" onClick={fetchStatus}>Tekrar Dene</Button>
      </div>
    );
  }

  const primarySources = status?.perSource.filter((s) => PRIMARY_SOURCES.includes(s.source)) ?? [];
  const otherSources = status?.perSource.filter((s) => !PRIMARY_SOURCES.includes(s.source)) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Yönetim Paneli</h1>
          <p className="text-sm text-muted-foreground mt-1">Veri kaynaklarını görüntüle ve yenile</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={fetchStatus}
          disabled={anyRunning}
        >
          <IconRefresh className={cn("h-4 w-4", anyRunning && "animate-spin")} />
          Durumu Yenile
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <IconDatabase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam İhale</p>
                <p className="text-2xl font-bold tabular-nums">{(status?.tenderCount ?? 0).toLocaleString("tr-TR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <IconClock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Son Çalışma</p>
                <p className="text-sm font-semibold leading-tight">{fmt(status?.lastRunAt ?? null)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center",
                status?.isRunning ? "bg-amber-100" : "bg-muted"
              )}>
                {status?.isRunning
                  ? <IconLoader2 className="h-5 w-5 text-amber-600 animate-spin" />
                  : <IconCheck className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Durum</p>
                <p className="text-sm font-semibold">{status?.isRunning ? "Çalışıyor…" : "Boşta"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh all */}
      <Card>
        <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Tüm Kaynakları Güncelle</p>
            <p className="text-xs text-muted-foreground mt-0.5">EKAP ve ilan.gov.tr verilerini şimdi çek</p>
          </div>
          <RunButton
            source="both"
            label="Tümünü Güncelle"
            runState={runStates["both"]}
            onRun={runScraper}
            anyRunning={anyRunning}
          />
        </CardContent>
      </Card>

      {/* Primary sources */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ana Kaynaklar</h2>
        <div className="space-y-3">
          {primarySources.map((src) => (
            <SourceCard
              key={src.source}
              src={src}
              runState={runStates[src.source]}
              onRun={runScraper}
              anyRunning={anyRunning}
            />
          ))}
        </div>
      </div>

      {/* Other sources */}
      {otherSources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Diğer Kaynaklar</h2>
          <div className="space-y-3">
            {otherSources.map((src) => (
              <SourceCard
                key={src.source}
                src={src}
                runState={runStates[src.source]}
                onRun={runScraper}
                anyRunning={anyRunning}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  src,
  runState,
  onRun,
  anyRunning,
}: {
  src: SourceStatus;
  runState: RunState | undefined;
  onRun: (source: string) => void;
  anyRunning: boolean;
}) {
  const label = SOURCE_LABELS[src.source] ?? src.source;
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{label}</span>
              <StatusBadge status={src.status} />
              {src.consecutiveFailures > 0 && (
                <span className="text-[11px] text-rose-600">({src.consecutiveFailures} ardışık hata)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">{src.recordsFetched}</span> kayıt çekildi</span>
              <span><span className="font-medium text-foreground">{src.recordsInserted}</span> yeni eklendi</span>
              <span>Son çalışma: {fmt(src.lastRunAt)}</span>
            </div>
            {src.errorMessage && (
              <p className="text-xs text-rose-600 font-mono truncate max-w-md" title={src.errorMessage}>
                {src.errorMessage}
              </p>
            )}
            {runState?.result && (
              <p className="text-xs text-emerald-600 font-medium">
                ✓ Tamamlandı — {runState.result.fetched} çekildi, {runState.result.inserted} eklendi
              </p>
            )}
            {runState?.error && (
              <p className="text-xs text-rose-600">Hata: {runState.error}</p>
            )}
          </div>
          <RunButton
            source={src.source}
            label="Güncelle"
            runState={runState}
            onRun={onRun}
            anyRunning={anyRunning}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RunButton({
  source,
  label,
  runState,
  onRun,
  anyRunning,
}: {
  source: string;
  label: string;
  runState: RunState | undefined;
  onRun: (source: string) => void;
  anyRunning: boolean;
}) {
  const loading = runState?.loading ?? false;
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-2 shrink-0"
      onClick={() => onRun(source)}
      disabled={loading || anyRunning}
    >
      {loading
        ? <><IconLoader2 className="h-3.5 w-3.5 animate-spin" />Çalışıyor…</>
        : <><IconRefresh className="h-3.5 w-3.5" />{label}</>
      }
    </Button>
  );
}
