import { useParams, Link } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import { useState, useEffect } from "react";
import {
  IconArrowLeft, IconCheck, IconX, IconFileText, IconBolt,
  IconClipboardList, IconDownload, IconExternalLink, IconLoader2,
  IconChartBar, IconUsers, IconCurrencyLira, IconCalendar, IconAlertTriangle,
} from "@tabler/icons-react";

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

interface AiAnalysis {
  summary: string;
  requiredTurnover: number | null;
  experienceYears: number | null;
  personnelCount: number | null;
  technicalSpecs: string[];
  scoringWeights: Record<string, number>;
  qualificationCriteria: Array<{ criterion: string; threshold: string | null }>;
  analyzedAt: string;
}

function AiDocumentAnalysis({
  tenderId,
  initial,
  hasDocs,
  isEkap,
}: {
  tenderId: number;
  initial: AiAnalysis | null;
  hasDocs: boolean;
  isEkap: boolean;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [docsDownloaded, setDocsDownloaded] = useState<number | null>(null);
  const [docsTotal, setDocsTotal] = useState<number | null>(null);

  const isPending = !analysis && hasDocs && isEkap;

  useEffect(() => {
    if (!isPending) return;
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 24;
    const intervalMs = 5_000;

    const intervalId = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/matches/${tenderId}`);
        if (res.ok) {
          const data = await res.json();
          const fetchedAnalysis = data?.aiSummary ?? null;
          if (fetchedAnalysis) {
            setAnalysis(fetchedAnalysis);
            setPolling(false);
            clearInterval(intervalId);
            return;
          }
        }
      } catch {
      }
      if (attempts >= maxAttempts) {
        setPolling(false);
        clearInterval(intervalId);
      }
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      setPolling(false);
    };
  }, [isPending, tenderId]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analiz başarısız");
      setAnalysis(data.analysis);
      if (data.docsDownloaded != null) setDocsDownloaded(data.docsDownloaded);
      if (data.docsTotal != null) setDocsTotal(data.docsTotal);
    } catch (e: any) {
      setError(e.message ?? "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  if (!analysis && isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconBolt className="h-5 w-5 text-primary" />
            Yapay Zeka Belge Analizi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span>Analiz bekleniyor... Belgeler arka planda işleniyor.</span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          {!polling && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Analiz tamamlanmadıysa manuel olarak başlatabilirsiniz.
              </p>
              <Button onClick={runAnalysis} disabled={loading} variant="outline" size="sm" className="gap-2">
                {loading ? (
                  <><IconLoader2 className="h-3 w-3 animate-spin" />Analiz Ediliyor...</>
                ) : (
                  <><IconBolt className="h-3 w-3" />Şimdi Analiz Et</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconBolt className="h-5 w-5 text-primary" />
            Yapay Zeka Belge Analizi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Belgeleri indirip yapay zeka ile analiz etmek için butona tıklayın.
            Gerekli ciro, deneyim yılı, personel sayısı ve teknik şartname bilgileri çıkarılır.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? (
              <><IconLoader2 className="h-4 w-4 animate-spin" />Analiz Ediliyor...</>
            ) : (
              <><IconBolt className="h-4 w-4" />Belgeleri Analiz Et</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasMetrics = analysis.requiredTurnover || analysis.experienceYears || analysis.personnelCount;
  const hasWeights = Object.keys(analysis.scoringWeights ?? {}).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <IconBolt className="h-5 w-5 text-primary" />
            Yapay Zeka Belge Analizi
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={runAnalysis}
            disabled={loading}
            className="text-xs gap-1 h-7"
          >
            {loading ? <IconLoader2 className="h-3 w-3 animate-spin" /> : <IconBolt className="h-3 w-3" />}
            Yenile
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>

        {docsTotal != null && docsDownloaded != null && docsDownloaded < docsTotal && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {docsDownloaded}/{docsTotal} belge indirilebildi — analiz eksik olabilir
            </span>
          </div>
        )}

        {hasMetrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {analysis.requiredTurnover != null && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <IconCurrencyLira className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Gerekli Ciro</p>
                  <p className="text-sm font-semibold">
                    ₺{analysis.requiredTurnover.toLocaleString("tr-TR")}
                  </p>
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

        {analysis.technicalSpecs?.length > 0 && (
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
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, weight)}%` }}
                    />
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

export default function IhaleDetayPage() {
  const { id } = useParams<{ id: string }>();
  const tenderId = parseInt(id ?? "0", 10);
  const { data: match, isLoading } = useGetMatch(tenderId);

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

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">İhale bulunamadı.</p>
        <Link href="/firsatlarim">
          <Button variant="outline" size="sm"><IconArrowLeft className="h-4 w-4 mr-2" />Geri Dön</Button>
        </Link>
      </div>
    );
  }

  const tender = match.tender;
  const daysLeft = Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400_000);
  const deadlineText = daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süresi geçti";
  const deadlineColor = daysLeft <= 0 ? "text-destructive" : daysLeft <= 7 ? "text-amber-500" : "text-emerald-600";
  const criteria = (match as any).criteriaCompliance ?? [];
  const tenderAny = tender as any;
  const documents: Array<{ name: string; url: string; type: string }> = tenderAny.documents ?? [];
  const aiSummary: AiAnalysis | null = (match as any).aiSummary ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/firsatlarim">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <IconArrowLeft className="h-4 w-4" /> Fırsatlarıma Dön
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
        {/* Left: AI summary + criteria + documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary (match reasoning) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconBolt className="h-5 w-5 text-primary" />
                Yapay Zeka Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{match.reasoning}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Artılar</p>
                  <ul className="space-y-1">
                    {(match.pros ?? []).map((p: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <IconCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">Riskler</p>
                  <ul className="space-y-1">
                    {(match.risks ?? []).map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <IconX className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Document Analysis */}
          <AiDocumentAnalysis
            tenderId={tenderId}
            initial={aiSummary}
            hasDocs={documents.some((d) => !!d.url)}
            isEkap={tenderAny.sourceSystem === "ekap"}
          />

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

          {/* Scraped Documents */}
          {documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconDownload className="h-5 w-5 text-primary" />
                  Belgeler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {documents.map((doc, i) => (
                    <li key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <IconFileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        {doc.type && <p className="text-xs text-muted-foreground">{doc.type}</p>}
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                            <IconExternalLink className="h-3.5 w-3.5" />
                            İndir
                          </Button>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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
        </div>

        {/* Right: Score + meta + CTAs */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <FitGauge score={match.fitScore} />
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Tahmini Bedel</span>
                  <span className="font-semibold">₺{tender.estimatedValue.toLocaleString("tr-TR")}</span>
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
                  <span className={`font-semibold ${deadlineColor}`}>{new Date(tender.deadline).toLocaleDateString("tr-TR")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

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
          </div>
        </div>
      </div>
    </div>
  );
}
