import { useParams, Link } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import {
  IconArrowLeft, IconCheck, IconX, IconFileText, IconBolt,
  IconClipboardList, IconDownload, IconExternalLink,
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
          {/* AI Summary */}
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
                      <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${c.compliant ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {c.compliant ? <IconCheck className="h-3 w-3" /> : <IconX className="h-3 w-3" />}
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
