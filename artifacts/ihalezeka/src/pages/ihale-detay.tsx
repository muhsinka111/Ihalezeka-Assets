import { useParams, Link } from "wouter";
import { useGetMatch, useGetTender, getGetMatchQueryKey, getGetTenderQueryKey, useCreatePipelineItem, useListPipelineItems } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlement } from "@/hooks/useEntitlement";
import { PaywallCard } from "@/components/PaywallOverlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AgencyLogo } from "@/components/AgencyLogo";
import { useState, useEffect, useRef } from "react";
import {
  IconArrowLeft, IconCheck, IconX, IconFileText, IconBolt,
  IconClipboardList, IconExternalLink, IconLoader2,
  IconChartBar, IconUsers, IconCurrencyLira, IconCalendar, IconAlertTriangle,
  IconBuildingBank, IconMapPin, IconPhone, IconMail, IconUser,
  IconEye, IconSend, IconMessage2, IconThumbUp, IconHelpCircle,
  IconLock, IconLayoutKanban, IconChevronDown,
} from "@tabler/icons-react";

type FitVerdict = "uygun" | "dikkat" | "uygun_degil";

interface TenderContact {
  authority: string | null;
  address: string | null;
  phone: string | null;
  fax?: string | null;
  email: string | null;
  contactPerson: string | null;
  sourceUrl?: string | null;
}

interface McpEnrichment {
  ikn: string;
  announcement: string;
  contact: TenderContact & { fax?: string | null };
  details: Record<string, unknown>;
}

interface AiAnalysis {
  summary: string;
  requiredTurnover: number | null;
  experienceYears: number | null;
  personnelCount: number | null;
  technicalSpecs: string[];
  scoringWeights: Record<string, number>;
  qualificationCriteria: Array<{ criterion: string; threshold: string | null }>;
  analyzedAt: string;
  fitVerdict?: FitVerdict | null;
  fitReason?: string | null;
  pros?: string[];
  risks?: string[];
  contact?: TenderContact | null;
  docsDownloaded?: number;
  docsTotal?: number;
  groundingSource?: "document" | "notice" | "source_page" | "metadata" | null;
  confidence?: "high" | "medium" | "low" | null;
}

const GROUNDING_META: Record<
  NonNullable<AiAnalysis["groundingSource"]>,
  { label: string; cls: string }
> = {
  document: { label: "Belge bazlı", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  notice: { label: "İlan bazlı", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  source_page: { label: "Kaynak sayfadan", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  metadata: { label: "Künye bazlı", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const VERDICT_META: Record<FitVerdict, { label: string; cls: string; box: string; icon: typeof IconCheck }> = {
  uygun: {
    label: "Uygun",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    box: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: IconCheck,
  },
  dikkat: {
    label: "Dikkat",
    cls: "bg-amber-100 text-amber-700 border-amber-200",
    box: "bg-amber-50 border-amber-200 text-amber-800",
    icon: IconAlertTriangle,
  },
  uygun_degil: {
    label: "Uygun Değil",
    cls: "bg-rose-100 text-rose-700 border-rose-200",
    box: "bg-rose-50 border-rose-200 text-rose-800",
    icon: IconX,
  },
};

function FitGauge({ score }: { score: number }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text x="70" y="68" textAnchor="middle" className="fill-foreground" style={{ fontSize: 28, fontWeight: 700, fontFamily: "Sora, sans-serif" }}>{score}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>/ 100</text>
      </svg>
      <span className="text-sm text-muted-foreground font-medium">Uyum Skoru</span>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Aktif</Badge>;
  }
  if (status === "cancelled") {
    return <Badge variant="destructive">İptal</Badge>;
  }
  if (status === "awarded") {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Sonuçlandı</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "ekap") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
        EKAP
      </span>
    );
  }
  if (source === "ilan_gov") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        ilan.gov.tr
      </span>
    );
  }
  return null;
}

function dedupeList(...lists: Array<string[] | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

// ── Document-grounded AI summary (verdict + reasoning + pros/risks) ──
function AiSummaryCard({
  analysis,
  loading,
  error,
  autoRunning,
  fallbackSummary,
  fallbackPros,
  fallbackRisks,
  onRun,
}: {
  analysis: AiAnalysis | null;
  loading: boolean;
  error: string | null;
  autoRunning: boolean;
  fallbackSummary: string;
  fallbackPros: string[];
  fallbackRisks: string[];
  onRun: () => void;
}) {
  const verdict = analysis?.fitVerdict ?? null;
  const vMeta = verdict ? VERDICT_META[verdict] : null;
  const pros = dedupeList(analysis?.pros, fallbackPros);
  const risks = dedupeList(analysis?.risks, fallbackRisks);
  const summary = analysis?.summary || fallbackSummary;
  const coverageIncomplete =
    analysis?.docsTotal != null &&
    analysis?.docsDownloaded != null &&
    analysis.docsDownloaded < analysis.docsTotal;
  const gMeta = analysis?.groundingSource ? GROUNDING_META[analysis.groundingSource] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <IconBolt className="h-5 w-5 text-primary" />
            Yapay Zeka Özeti
          </span>
          <div className="flex items-center gap-2">
            {gMeta && (
              <Badge variant="outline" className={`${gMeta.cls} gap-1 text-[11px] font-normal`}>
                {gMeta.label}
                {analysis?.confidence === "low" && " · sınırlı bilgi"}
              </Badge>
            )}
            {vMeta && (
              <Badge className={`${vMeta.cls} hover:${vMeta.cls} gap-1`}>
                <vMeta.icon className="h-3.5 w-3.5" />
                {vMeta.label}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRun}
              disabled={loading}
              className="text-xs gap-1 h-7"
            >
              {loading ? <IconLoader2 className="h-3 w-3 animate-spin" /> : <IconBolt className="h-3 w-3" />}
              {analysis ? "Yenile" : "Analiz Et"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && (loading || autoRunning) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <span>Belgeler indiriliyor ve yapay zeka ile analiz ediliyor…</span>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(analysis || (!loading && !autoRunning)) && (
          <>
            {vMeta && analysis?.fitReason && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm ${vMeta.box}`}>
                <vMeta.icon className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{analysis.fitReason}</p>
              </div>
            )}

            {summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
            )}

            {coverageIncomplete && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <IconAlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {analysis!.docsDownloaded}/{analysis!.docsTotal} belge indirilebildi — analiz eksik olabilir
                </span>
              </div>
            )}

            {(pros.length > 0 || risks.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Artılar</p>
                  <ul className="space-y-1">
                    {pros.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <IconCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                    {pros.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">Riskler</p>
                  <ul className="space-y-1">
                    {risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <IconX className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                    {risks.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Extracted requirement details (metrics / specs / weights) ──────
function AnalysisDetailsCard({ analysis }: { analysis: AiAnalysis }) {
  const hasMetrics = analysis.requiredTurnover || analysis.experienceYears || analysis.personnelCount;
  const hasWeights = Object.keys(analysis.scoringWeights ?? {}).length > 0;
  const hasSpecs = (analysis.technicalSpecs?.length ?? 0) > 0;

  if (!hasMetrics && !hasWeights && !hasSpecs) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconClipboardList className="h-5 w-5 text-primary" />
          Belge Gereksinimleri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasMetrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {analysis.requiredTurnover != null && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <IconCurrencyLira className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Gerekli Ciro</p>
                  <p className="text-sm font-semibold">₺{analysis.requiredTurnover.toLocaleString("tr-TR")}</p>
                </div>
              </div>
            )}
            {analysis.experienceYears != null && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <IconCalendar className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Deneyim</p>
                  <p className="text-sm font-semibold">{analysis.experienceYears} yıl</p>
                </div>
              </div>
            )}
            {analysis.personnelCount != null && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <IconUsers className="h-5 w-5 text-violet-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Min. Personel</p>
                  <p className="text-sm font-semibold">{analysis.personnelCount} kişi</p>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSpecs && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Teknik Gereksinimler
            </p>
            <ul className="space-y-1">
              {analysis.technicalSpecs.map((spec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <IconCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasWeights && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <IconChartBar className="h-3.5 w-3.5" />
              Değerlendirme Ağırlıkları
            </p>
            <div className="space-y-2">
              {Object.entries(analysis.scoringWeights).map(([key, weight]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm w-28 shrink-0">{key}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, weight)}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-10 text-right">{weight}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Analiz tarihi: {new Date(analysis.analyzedAt).toLocaleString("tr-TR")}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Contracting authority contact card ─────────────────────────────
function ContactCard({ contact, loading }: { contact: TenderContact; loading?: boolean }) {
  const rows: Array<{ icon: typeof IconUser; label: string; value: string; href?: string }> = [];
  if (contact.authority) rows.push({ icon: IconBuildingBank, label: "İdare", value: contact.authority });
  if (contact.contactPerson) rows.push({ icon: IconUser, label: "İrtibat Kişisi", value: contact.contactPerson });
  if (contact.address) rows.push({ icon: IconMapPin, label: "Adres", value: contact.address });
  if (contact.phone) rows.push({ icon: IconPhone, label: "Telefon", value: contact.phone, href: `tel:${contact.phone}` });
  if (contact.fax) rows.push({ icon: IconPhone, label: "Faks", value: contact.fax });
  if (contact.email) rows.push({ icon: IconMail, label: "E-posta", value: contact.email, href: `mailto:${contact.email}` });

  if (!loading && rows.length === 0 && !contact.sourceUrl) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconBuildingBank className="h-5 w-5 text-primary" />
          İdare İletişim Bilgileri
          {loading && <IconLoader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && rows.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-3">
            <r.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              {r.href ? (
                <a href={r.href} className="text-sm font-medium hover:text-primary break-words">{r.value}</a>
              ) : (
                <p className="text-sm font-medium break-words">{r.value}</p>
              )}
            </div>
          </div>
        ))}
        {contact.sourceUrl && (
          <a href={contact.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
            <Button variant="outline" size="sm" className="gap-2">
              <IconExternalLink className="h-3.5 w-3.5" />
              Resmi İlan Sayfası
            </Button>
          </a>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Detaylı iletişim bilgisi bulunamadı. Resmi ilan sayfasını kontrol edebilirsiniz.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Full EKAP announcement text from MCP ──────────────────────────
function AnnouncementCard({ text, loading }: { text: string; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!loading && !text) return null;

  const preview = text.slice(0, 600);
  const hasMore = text.length > 600;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFileText className="h-5 w-5 text-primary" />
          İhale İlanı
          {loading && <IconLoader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !text && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
        {text && (
          <>
            <pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed text-foreground">
              {expanded ? text : preview}
            </pre>
            {hasMore && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-3 text-xs text-primary hover:underline font-medium"
              >
                {expanded ? "Daha az göster ▲" : "Tamamını göster ▼"}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Documents list + in-app viewer ─────────────────────────────────
function DocumentsCard({
  tenderId,
  documents,
}: {
  tenderId: number;
  documents: Array<{ name: string; url: string; type: string }>;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const activeDoc = openIndex != null ? documents[openIndex] : null;
  const isPdf =
    activeDoc != null && /pdf/i.test(`${activeDoc.type ?? ""} ${activeDoc.name ?? ""}`);

  useEffect(() => {
    if (openIndex == null || activeDoc == null) return;
    if (isPdf) {
      setText(null);
      setTextError(null);
      return;
    }
    let cancelled = false;
    setTextLoading(true);
    setText(null);
    setTextError(null);
    fetch(`/api/tenders/${tenderId}/document-text?i=${openIndex}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Belge metni alınamadı");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const t = (data?.text ?? "").trim();
        setText(t.length > 0 ? t : "Bu belgeden okunabilir metin çıkarılamadı. Lütfen indirin.");
      })
      .catch((e) => {
        if (!cancelled) setTextError(e.message ?? "Belge görüntülenemedi");
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openIndex, isPdf, tenderId, activeDoc]);

  // Index `i` must stay aligned with the server's full documents array
  // (the proxy endpoints index into tender.documents[i]).
  if (!documents.some((d) => d.url)) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconFileText className="h-5 w-5 text-primary" />
            Belgeler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {documents.map((doc, i) => {
              if (!doc.url) return null;
              return (
              <li key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <IconFileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name || `Belge ${i + 1}`}</p>
                  {doc.type && <p className="text-xs text-muted-foreground">{doc.type}</p>}
                </div>
                {doc.url && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setOpenIndex(i)}
                    >
                      <IconEye className="h-3.5 w-3.5" />
                      Görüntüle
                    </Button>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <IconExternalLink className="h-3.5 w-3.5" />
                        İndir
                      </Button>
                    </a>
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={openIndex != null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            <DialogTitle className="text-base truncate pr-8">{activeDoc?.name ?? "Belge"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeDoc && isPdf && (
              <iframe
                title={activeDoc.name}
                src={`/api/tenders/${tenderId}/document?i=${openIndex}`}
                className="w-full h-full border-0"
              />
            )}
            {activeDoc && !isPdf && (
              <ScrollArea className="h-full">
                <div className="p-5">
                  {textLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
                      Belge yükleniyor…
                    </div>
                  )}
                  {textError && (
                    <div className="flex items-center gap-2 text-sm text-rose-600">
                      <IconAlertTriangle className="h-4 w-4" />
                      {textError}
                    </div>
                  )}
                  {text != null && (
                    <pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed">{text}</pre>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
          {activeDoc?.url && (
            <div className="px-5 py-3 border-t shrink-0 flex justify-end">
              <a href={activeDoc.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <IconExternalLink className="h-3.5 w-3.5" />
                  İndir
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Chat with the tender's documents ───────────────────────────────
interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Geçici teminat tutarı nedir?",
  "İhale tarihi ve saati nedir?",
  "Hangi yeterlilik belgeleri isteniyor?",
];

function DocumentChatCard({ tenderId, hasDocs }: { tenderId: number; hasDocs: boolean }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    const history = messages.slice(-6);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yanıt alınamadı");
      setMessages((m) => [...m, { role: "assistant", content: data.answer ?? "Yanıt üretilemedi." }]);
    } catch (e: any) {
      setError(e.message ?? "Bir hata oluştu");
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconMessage2 className="h-5 w-5 text-primary" />
          Belgelerle Sohbet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasDocs && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>Bu ihaleye ait indirilebilir belge bulunmuyor; yanıtlar sınırlı olabilir.</span>
          </div>
        )}

        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              İhale belgeleri hakkında soru sorun. Yanıtlar yalnızca belge içeriğine dayanır.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <IconHelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div ref={scrollRef} className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
                  Belgeler okunuyor…
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bir soru yazın…"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0">
            {loading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSend className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const PIPELINE_STAGES = [
  { id: "discovery", label: "Fırsat Keşfi" },
  { id: "preparation", label: "Teklif Hazırlığı" },
  { id: "applied", label: "Başvuru Yapıldı" },
  { id: "evaluation", label: "Değerlendirme" },
  { id: "won", label: "Kazanıldı" },
];

export default function IhaleDetayPage() {
  const { id } = useParams<{ id: string }>();
  const tenderId = parseInt(id ?? "0", 10);
  const { isPro, isLoading: entLoading } = useEntitlement();
  const queryClient = useQueryClient();
  const createPipeline = useCreatePipelineItem();
  const { data: pipelineItems } = useListPipelineItems();
  const existingPipelineItem = (pipelineItems as any[])?.find((item: any) => item.tender?.id === tenderId);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineAdded, setPipelineAdded] = useState(false);
  const [pipelineStage, setPipelineStage] = useState("");
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  useEffect(() => {
    if (existingPipelineItem) {
      setPipelineAdded(true);
      setPipelineStage(existingPipelineItem.stage ?? "");
    } else {
      setPipelineAdded(false);
      setPipelineStage("");
    }
  }, [existingPipelineItem?.id, existingPipelineItem?.stage]);

  // Pro users load the full match (tender + AI fields + contact). Free users
  // load only the masked basic tender record. Exactly one request fires.
  const { data: match, isLoading: matchLoading } = useGetMatch(tenderId, {
    query: { queryKey: getGetMatchQueryKey(tenderId), enabled: tenderId > 0 && isPro },
  });
  const { data: freeTender, isLoading: freeLoading } = useGetTender(tenderId, {
    query: { queryKey: getGetTenderQueryKey(tenderId), enabled: tenderId > 0 && !isPro },
  });

  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const [mcpData, setMcpData] = useState<McpEnrichment | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);

  const initialAnalysis: AiAnalysis | null = (match as any)?.aiSummary ?? null;

  useEffect(() => {
    setAnalysis(initialAnalysis);
    autoTriggered.current = false;
    setAnalysisError(null);
  }, [tenderId, initialAnalysis]);

  // Fetch live MCP announcement + contact whenever the tender changes (Pro only)
  useEffect(() => {
    if (!tenderId || !isPro) return;
    let cancelled = false;
    setMcpData(null);
    setMcpLoading(true);
    fetch(`/api/tenders/${tenderId}/mcp-enrichment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: McpEnrichment | null) => {
        if (!cancelled && data) setMcpData(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMcpLoading(false); });
    return () => { cancelled = true; };
  }, [tenderId, isPro]);

  async function runAnalysis() {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Analiz başarısız");
      setAnalysis(data.analysis);
    } catch (e: any) {
      setAnalysisError(e.message ?? "Analiz sırasında bir hata oluştu");
    } finally {
      setAnalysisLoading(false);
    }
  }

  const tenderAny = (isPro ? (match?.tender as any) : (freeTender as any)) ?? null;
  const documents: Array<{ name: string; url: string; type: string }> = tenderAny?.documents ?? [];
  const hasDocs = documents.some((d) => !!d.url);

  // Auto-trigger the fit verdict once on open when no analysis exists yet (Pro only).
  useEffect(() => {
    if (!isPro || !match || analysis || autoTriggered.current) return;
    if (!analysisLoading) {
      autoTriggered.current = true;
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, match, analysis]);

  // Merge contact: prefer MCP-sourced fields (richer) over AI-extracted ones
  const baseContact: TenderContact | null = (match as any)?.contact ?? null;
  const mergedContact: TenderContact | null = (() => {
    const mcp = mcpData?.contact ?? null;
    if (!mcp && !baseContact) return null;
    return {
      authority:     mcp?.authority     || baseContact?.authority     || null,
      address:       mcp?.address       || baseContact?.address       || null,
      phone:         mcp?.phone         || baseContact?.phone         || null,
      fax:           mcp?.fax           || null,
      email:         mcp?.email         || baseContact?.email         || null,
      contactPerson: mcp?.contactPerson || baseContact?.contactPerson || null,
      sourceUrl:     baseContact?.sourceUrl || mcp?.sourceUrl         || null,
    };
  })();

  const isLoading = entLoading || (isPro ? matchLoading : freeLoading);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!tenderAny) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">İhale bulunamadı.</p>
        <Link href="/ihale-arama">
          <Button variant="outline" size="sm"><IconArrowLeft className="h-4 w-4 mr-2" />Geri Dön</Button>
        </Link>
      </div>
    );
  }

  const tender = tenderAny;
  const hasDeadline = tender.deadline != null;
  const daysLeft = hasDeadline ? Math.ceil((new Date(tender.deadline as string).getTime() - Date.now()) / 86400_000) : null;
  const deadlineText = !hasDeadline ? "Tarih belirtilmemiş" : daysLeft! > 0 ? `${daysLeft} gün kaldı` : "Süresi geçti";
  const deadlineColor = !hasDeadline ? "text-muted-foreground" : daysLeft! <= 0 ? "text-destructive" : daysLeft! <= 7 ? "text-amber-500" : "text-emerald-600";
  const criteria = (match as any)?.criteriaCompliance ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isPro ? "/firsatlarim" : "/ihale-arama"}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <IconArrowLeft className="h-4 w-4" /> {isPro ? "Fırsatlarıma Dön" : "Aramaya Dön"}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
        <div className="flex items-start gap-4">
          <AgencyLogo name={tender.agencyName} logoUrl={tender.agencyLogoUrl} className="h-12 w-12 rounded-lg" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground font-mono">{tender.ikn}</p>
              <SourceBadge source={tenderAny.sourceSystem} />
            </div>
            <h1 className="text-xl font-bold font-heading leading-snug">{tender.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tender.agencyName} • {tender.il}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 items-center">
          <Badge variant="outline">{tender.type}</Badge>
          {tenderAny.procurementMethod && (
            <Badge variant="outline">{tenderAny.procurementMethod}</Badge>
          )}
          <StatusBadge status={tenderAny.status} />
          <span className={`text-sm font-semibold ${deadlineColor}`}>{deadlineText}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: AI summary + details + criteria + documents + chat (Pro) */}
        <div className="lg:col-span-2 space-y-6">
          {isPro ? (
            <>
              <AiSummaryCard
                analysis={analysis}
                loading={analysisLoading}
                error={analysisError}
                autoRunning={!analysis && !analysisError}
                fallbackSummary={match?.reasoning ?? ""}
                fallbackPros={match?.pros ?? []}
                fallbackRisks={match?.risks ?? []}
                onRun={runAnalysis}
              />

              {analysis && <AnalysisDetailsCard analysis={analysis} />}

              {/* Criteria Compliance */}
              {criteria.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <IconClipboardList className="h-5 w-5 text-primary" />
                      Yeterlilik Kriterleri Uyumu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {criteria.map((c: any, i: number) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${c.compliant === true ? 'bg-emerald-100 text-emerald-600' : c.compliant === false ? 'bg-rose-100 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
                            {c.compliant === true ? <IconCheck className="h-3 w-3" /> : c.compliant === false ? <IconX className="h-3 w-3" /> : "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.criterion}</p>
                            {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* İhale İlanı — full EKAP announcement text from MCP */}
              <AnnouncementCard
                text={mcpData?.announcement ?? ""}
                loading={mcpLoading}
              />

              {/* Documents + viewer */}
              <DocumentsCard tenderId={tenderId} documents={documents} />

              {/* Chat with documents */}
              <DocumentChatCard tenderId={tenderId} hasDocs={hasDocs} />

              {/* Required Documents (legacy field) */}
              {(tenderAny.documentsRequired?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <IconFileText className="h-5 w-5 text-primary" />
                      Gerekli Belgeler
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(tenderAny.documentsRequired ?? []).map((doc: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-lg">
                          <IconFileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Free: basic summary + paywalls for premium intelligence */}
              {tender.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <IconFileText className="h-5 w-5 text-primary" />
                      Özet
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tender.summary}</p>
                  </CardContent>
                </Card>
              )}

              <PaywallCard
                icon={IconChartBar}
                title="Yapay Zeka Uygunluk Analizi"
                description="Bu ihalenin firmanıza uygunluğunu, artılarını, risklerini ve yeterlilik kriterleri uyumunu yapay zeka ile saniyeler içinde değerlendirin."
              />
              <PaywallCard
                icon={IconFileText}
                title="İhale İlanı ve Belgeler"
                description="İhale ilanının tam metnini okuyun; şartname, idari ve teknik belgeleri görüntüleyip indirin."
              />
              <PaywallCard
                icon={IconMessage2}
                title="Belgelerle Sohbet"
                description="İhale dokümanları hakkında yapay zekaya soru sorun, anında ve kaynağa dayalı yanıtlar alın."
              />
            </>
          )}
        </div>

        {/* Right: Score + meta + contact + CTAs */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              {isPro ? (
                <FitGauge score={match!.fitScore} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="h-28 w-28 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                    <IconLock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center leading-snug">Uygunluk skoru<br />Pro üyelikte</p>
                </div>
              )}
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Tahmini Bedel</span>
                  <span className="font-semibold">{tender.estimatedValue != null ? `₺${tender.estimatedValue.toLocaleString("tr-TR")}` : "Belirtilmemiş"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">İl</span>
                  <span className="font-medium">{tender.il}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Usul</span>
                  <span className="font-medium">{tender.method}</span>
                </div>
                {tenderAny.procurementMethod && tenderAny.procurementMethod !== tender.method && (
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">İhale Usulü</span>
                    <span className="font-medium">{tenderAny.procurementMethod}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Durum</span>
                  <StatusBadge status={tenderAny.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Son Başvuru</span>
                  <span className={`font-semibold ${deadlineColor}`}>{hasDeadline ? new Date(tender.deadline as string).toLocaleDateString("tr-TR") : "Belirtilmemiş"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isPro ? (
            (mergedContact || mcpLoading) && (
              <ContactCard
                contact={mergedContact ?? { authority: null, address: null, phone: null, email: null, contactPerson: null }}
                loading={mcpLoading && !mergedContact}
              />
            )
          ) : (
            <PaywallCard
              icon={IconBuildingBank}
              title="İletişim Bilgileri"
              description="İhaleyi yapan idarenin yetkili kişi, telefon, e-posta ve adres bilgilerine erişin."
            />
          )}

          {tenderAny.sourceUrl && (
            <a href={tenderAny.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2">
                <IconExternalLink className="h-4 w-4" />
                Kaynakta Görüntüle
              </Button>
            </a>
          )}

          <div className="space-y-2">
            <Link href="/basvuru-sihirbazi">
              <Button className="w-full" size="lg">Benim Adıma Başvur</Button>
            </Link>
            <Link href="/teklif-olusturucu">
              <Button variant="outline" className="w-full" size="lg">Teklif Taslağı Oluştur</Button>
            </Link>
            {pipelineError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {pipelineError}
              </div>
            )}
            {pipelineAdded ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <IconCheck className="h-4 w-4 shrink-0" />
                  <span>{PIPELINE_STAGES.find(s => s.id === pipelineStage)?.label ?? "Boru Hattında"}</span>
                </div>
                <button
                  onClick={() => { setPipelineAdded(false); setPipelineError(null); }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-800 underline shrink-0"
                >
                  Taşı
                </button>
              </div>
            ) : (
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setPipelineOpen((o) => !o)}
                >
                  <IconLayoutKanban className="h-4 w-4" />
                  Boru Hattına Ekle
                  <IconChevronDown className="h-3.5 w-3.5 ml-auto" />
                </Button>
                {pipelineOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border bg-card shadow-lg py-1">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Aşama Seç
                    </div>
                    {PIPELINE_STAGES.map((s) => (
                      <button
                        key={s.id}
                        onClick={async () => {
                          setPipelineOpen(false);
                          setPipelineError(null);
                          try {
                            await createPipeline.mutateAsync({ data: { tenderId, stage: s.id as any } });
                            setPipelineStage(s.id);
                            setPipelineAdded(true);
                            queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
                          } catch {
                            setPipelineError("Eklenemedi — lütfen tekrar deneyin.");
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
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
      </div>
    </div>
  );
}
