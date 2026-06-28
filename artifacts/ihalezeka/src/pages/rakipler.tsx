import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  IconSearch,
  IconTrophy,
  IconPercentage,
  IconUsers,
  IconChevronRight,
  IconBuilding,
  IconMapPin,
  IconCategory,
  IconCurrencyLira,
  IconArrowDown,
  IconArrowUp,
  IconX,
} from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface Competitor {
  id: number;
  businessId: string;
  name: string;
  wonTenders: number;
  avgDiscountRate: number;
  encounters: number;
  categories: string[];
  provinces: string[];
  agencies: string[];
  totalAwards: number;
  avgAwardPrice: number;
  totalValue: number;
}

interface Award {
  id: number;
  ikn: string;
  awardedCompany: string;
  awardedPrice: number | null;
  estimatedValue: number | null;
  bidderCount: number | null;
  awardDate: string | null;
  category: string | null;
  il: string | null;
  agencyName: string | null;
  discountRate: number | null;
}

interface MarketOverview {
  topWinners: {
    company: string;
    wins: number;
    avgDiscount: number | null;
    totalValue: number;
    avgBidders: number | null;
  }[];
  categoryStats: {
    category: string;
    count: number;
    avgDiscount: number | null;
    avgBidders: number | null;
    avgPrice: number | null;
  }[];
  source?: "awards" | "tenders";
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  if (v >= 1_000_000) return `₺${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₺${(v / 1_000).toFixed(0)}K`;
  return `₺${v.toFixed(0)}`;
}

function formatDiscount(v: number | null | undefined): string {
  if (v == null) return "—";
  return `%${v.toFixed(1)}`;
}

const CHART_COLORS = ["#2D5BFF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export default function RakiplerPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const qc = useQueryClient();

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/competitors/discover`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to discover competitors");
      return res.json() as Promise<{ added: number; total: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const { data: competitors, isLoading } = useQuery<Competitor[]>({
    queryKey: ["competitors", search],
    queryFn: async () => {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_BASE}/competitors${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
  });

  const { data: marketData, isLoading: marketLoading } = useQuery<MarketOverview>({
    queryKey: ["competitors-market-overview"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/competitors/market-overview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch market overview");
      return res.json();
    },
  });

  const { data: selectedDetail } = useQuery<{ competitor: Competitor; awards: Award[] }>({
    queryKey: ["competitor-detail", selectedId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/competitors/${selectedId}/awards`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch competitor detail");
      return res.json();
    },
    enabled: selectedId !== null,
  });

  const totalCompetitors = competitors?.length ?? 0;
  const avgDiscount = competitors && competitors.length > 0
    ? competitors.reduce((s, c) => s + c.avgDiscountRate, 0) / competitors.length
    : 0;
  const totalEncounters = competitors?.reduce((s, c) => s + c.encounters, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Rakip Analizi</h1>
        <p className="text-muted-foreground text-sm">
          Sektörünüzde ihale kazanan firmaları, iskonto oranlarını ve ihale geçmişlerini inceleyin.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard icon={IconUsers} label="Takip Edilen Rakip" value={totalCompetitors} color="text-primary" />
            <KpiCard icon={IconTrophy} label="Toplam Karşılaşma" value={totalEncounters} color="text-emerald-500" />
            <KpiCard icon={IconPercentage} label="Ort. İskonto Oranı" value={`%${avgDiscount.toFixed(1)}`} color="text-amber-500" />
            <KpiCard
              icon={IconCurrencyLira}
              label="Pazar Toplam Değer"
              value={formatCurrency(marketData?.topWinners?.reduce((s, w) => s + w.totalValue, 0) ?? 0)}
              color="text-[#2D5BFF]"
            />
          </>
        )}
      </div>

      {/* Market Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Winners */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IconTrophy className="h-5 w-5 text-amber-500" />
              {marketData?.source === "tenders" ? "En Aktif Kurumlar" : "En Çok Kazanan Firmalar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {marketLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : marketData?.topWinners && marketData.topWinners.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={marketData.topWinners.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => String(v)} />
                  <YAxis
                    type="category"
                    dataKey="company"
                    width={140}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "wins" ? [`${value} ihale`, marketData?.source === "tenders" ? "İhale Sayısı" : "Kazanılan"] : [formatCurrency(value), "Toplam Değer"]
                    }
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="wins" fill="#2D5BFF" radius={[0, 4, 4, 0]} name="wins">
                    {marketData.topWinners.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Henüz veri yok.</p>
            )}
          </CardContent>
        </Card>

        {/* Category Discount Rates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IconPercentage className="h-5 w-5 text-emerald-500" />
              {marketData?.source === "tenders" ? "Kategoriye Göre İhale Sayısı" : "Kategoriye Göre Ort. İskonto"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {marketLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : marketData?.categoryStats && marketData.categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                {marketData.source === "tenders" ? (
                  <BarChart data={marketData.categoryStats.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 13) + "…" : v} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value} ihale`, "İhale Sayısı"]} />
                    <Bar dataKey="count" fill="#2D5BFF" radius={[4, 4, 0, 0]} name="count" />
                  </BarChart>
                ) : (
                  <BarChart data={marketData.categoryStats.filter((c) => c.avgDiscount != null).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 13) + "…" : v} />
                    <YAxis tickFormatter={(v) => `%${v.toFixed(0)}`} />
                    <Tooltip formatter={(value: number) => [`%${value.toFixed(1)}`, "Ort. İskonto"]} />
                    <Bar dataKey="avgDiscount" fill="#10B981" radius={[4, 4, 0, 0]} name="avgDiscount" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Henüz veri yok.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competitor Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Rakip Firmaları</CardTitle>
            <div className="relative max-w-xs w-full">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Firma ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !competitors || competitors.length === 0 ? (
            <div className="text-center py-16">
              <IconUsers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Henüz rakip verisi yok</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                İhale sonuç verilerinden rakiplerinizi otomatik keşfedebilirsiniz.
              </p>
              <Button
                onClick={() => discoverMutation.mutate()}
                disabled={discoverMutation.isPending}
                size="sm"
              >
                {discoverMutation.isPending ? "Keşfediliyor..." : "Rakipleri Keşfet"}
              </Button>
              {discoverMutation.isSuccess && (
                <p className="text-xs text-emerald-600 mt-2">
                  {discoverMutation.data.added} yeni rakip eklendi!
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Firma</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Kazanılan</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">İskonto</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Karşılaşma</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Toplam Değer</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Sektörler</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <IconMapPin className="h-3 w-3" />
                          {c.provinces.length > 0 ? c.provinces.slice(0, 3).join(", ") : "—"}
                        </div>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className="font-semibold text-emerald-600">{c.wonTenders}</span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={c.avgDiscountRate > 20 ? "text-rose-500 font-semibold" : "font-medium"}>
                          {formatDiscount(c.avgDiscountRate)}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-muted-foreground">{c.encounters}</td>
                      <td className="text-center px-3 py-3 font-medium">{formatCurrency(c.totalValue)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.categories.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {cat}
                            </Badge>
                          ))}
                          {c.categories.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{c.categories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitor Detail Dialog */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-heading flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconBuilding className="h-5 w-5 text-primary" />
                  </div>
                  {selectedDetail.competitor.name}
                </DialogTitle>
              </DialogHeader>

              {/* Detail KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <MiniKpi label="Kazanılan İhale" value={String(selectedDetail.awards.length)} />
                <MiniKpi label="Ort. İskonto" value={formatDiscount(selectedDetail.competitor.avgDiscountRate)} />
                <MiniKpi label="Karşılaşma" value={String(selectedDetail.competitor.encounters)} />
                <MiniKpi
                  label="Toplam Değer"
                  value={formatCurrency(selectedDetail.awards.reduce((s, a) => s + (a.awardedPrice ?? 0), 0))}
                />
              </div>

              {/* Agencies & Categories */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Çalıştığı Kurumlar</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const agencies = [...new Set(selectedDetail.awards.map((a) => a.agencyName).filter(Boolean))];
                      return agencies.length > 0
                        ? agencies.slice(0, 6).map((a) => (
                            <Badge key={a} variant="outline" className="text-xs">
                              {a!.length > 30 ? a!.slice(0, 28) + "…" : a}
                            </Badge>
                          ))
                        : <span className="text-sm text-muted-foreground">—</span>;
                    })()}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Kategoriler</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const cats = [...new Set(selectedDetail.awards.map((a) => a.category).filter(Boolean))];
                      return cats.length > 0
                        ? cats.map((c) => (
                            <Badge key={c} variant="secondary" className="text-xs">
                              {c}
                            </Badge>
                          ))
                        : <span className="text-sm text-muted-foreground">—</span>;
                    })()}
                  </div>
                </div>
              </div>

              {/* Award History Table */}
              <div className="mt-6">
                <p className="text-sm font-semibold mb-3">İhale Kazanma Geçmişi</p>
                {selectedDetail.awards.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Kazanılmış ihale kaydı bulunamadı.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Kurum</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Kategori</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">İhale Bedeli</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Tahmini Değer</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">İskonto</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Teklif Sayısı</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.awards.map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="px-3 py-2 max-w-[200px] truncate" title={a.agencyName ?? ""}>
                              {a.agencyName ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {a.category ? (
                                <Badge variant="secondary" className="text-[10px]">{a.category}</Badge>
                              ) : "—"}
                            </td>
                            <td className="text-right px-3 py-2 font-medium">{formatCurrency(a.awardedPrice)}</td>
                            <td className="text-right px-3 py-2 text-muted-foreground">{formatCurrency(a.estimatedValue)}</td>
                            <td className="text-center px-3 py-2">
                              {a.discountRate != null ? (
                                <span className={`inline-flex items-center gap-0.5 font-medium ${a.discountRate > 20 ? "text-rose-500" : a.discountRate > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                                  {a.discountRate > 0 ? <IconArrowDown className="h-3 w-3" /> : a.discountRate < 0 ? <IconArrowUp className="h-3 w-3" /> : null}
                                  %{Math.abs(a.discountRate).toFixed(1)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="text-center px-3 py-2 text-muted-foreground">{a.bidderCount ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
                              {a.awardDate ? new Date(a.awardDate).toLocaleDateString("tr-TR") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 py-8">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="text-2xl font-bold font-heading">{value}</div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold font-heading">{value}</p>
    </div>
  );
}
