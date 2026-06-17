import { useState } from "react";
import {
  useListCompetitors,
  useGetCompetitorInsights,
  useGetCompetitorHeadToHead,
  type Competitor,
  type HeadToHeadItem,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { IconRobot, IconTrophy, IconChevronDown, IconChevronRight, IconSwords } from "@tabler/icons-react";

function HeadToHeadPanel({ company }: { company: string }) {
  const { data, isLoading } = useGetCompetitorHeadToHead(encodeURIComponent(company));

  if (isLoading) {
    return (
      <div className="px-4 pb-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="px-4 pb-4 text-sm text-muted-foreground">
        Bu rakiple ortak ihale kaydı bulunamadı. (Rakip, fırsatlarınızda yer alan ihaleleri kazanmamış.)
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <p className="text-xs text-muted-foreground mb-3">
        Bu rakibin kazandığı ve sizin takip ettiğiniz {data.total} ihale:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">İhale No</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">İdare</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kategori</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Kırım</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Teklif Sayısı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.items.map((item: HeadToHeadItem) => (
              <tr key={item.ikn} className="hover:bg-muted/20">
                <td className="px-3 py-2 font-mono text-primary">{item.ikn}</td>
                <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">
                  {item.agencyName ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {item.category ? (
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.discountRate != null ? (
                    <span className={item.discountRate > 20 ? "text-red-500 font-medium" : ""}>
                      %{item.discountRate.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {item.bidderCount ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RakipAnaliziPage() {
  const { data: competitors, isLoading: loadingComp } = useListCompetitors();
  const { data: insights, isLoading: loadingInsights } = useGetCompetitorInsights();
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const toggleCompany = (name: string) => {
    setExpandedCompany((prev) => (prev === name ? null : name));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Rakip Analizi</h1>
        <p className="text-muted-foreground text-sm">Rakiplerinizin performansını ve kırım stratejilerini izleyin.</p>
      </div>

      {/* AI Insight */}
      <Card className="border-primary/20 bg-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconRobot className="h-5 w-5 text-primary" /> Yapay Zeka Analizi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInsights ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{insights?.aiInsight}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Table with expandable head-to-head rows */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTrophy className="h-5 w-5 text-amber-500" /> Rakip Tablosu
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Bir rakibe tıklayarak birebir karşılaşmalarınızı görün.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {loadingComp ? (
              <div className="p-6">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Firma</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Kazanılan</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ort. Kırım</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Karşılaşma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(competitors ?? []).map((c: any) => (
                      <>
                        <tr
                          key={c.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer select-none"
                          onClick={() => toggleCompany(c.name)}
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {expandedCompany === c.name ? (
                                <IconChevronDown className="h-4 w-4 text-primary shrink-0" />
                              ) : (
                                <IconChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate max-w-[160px]">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{c.wonTenders}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            %{c.avgDiscountRate?.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {c.encounters}
                          </td>
                        </tr>
                        {expandedCompany === c.name && (
                          <tr key={`${c.id}-h2h`}>
                            <td colSpan={4} className="bg-muted/20 border-b border-border/50">
                              <div className="py-2">
                                <div className="flex items-center gap-2 px-4 pb-2 text-xs font-semibold text-primary">
                                  <IconSwords className="h-3.5 w-3.5" />
                                  Birebir Karşılaşmalar — {c.name}
                                </div>
                                <HeadToHeadPanel company={c.name} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Win Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori Bazlı Kazanma Oranları</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInsights ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={insights?.categoryWinRates ?? []} layout="vertical" barCategoryGap={8}>
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `%${v}`}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v: any) => `%${v}`} />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {(insights?.categoryWinRates ?? []).map((entry: any, index: number) => (
                      <Cell
                        key={index}
                        fill={entry.winRate >= 50 ? "#10b981" : entry.winRate >= 35 ? "#f59e0b" : "#6366f1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
