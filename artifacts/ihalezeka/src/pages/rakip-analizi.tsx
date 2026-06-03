import { useListCompetitors, useGetCompetitorInsights } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { IconRobot, IconTrophy } from "@tabler/icons-react";

export default function RakipAnaliziPage() {
  const { data: competitors, isLoading: loadingComp } = useListCompetitors();
  const { data: insights, isLoading: loadingInsights } = useGetCompetitorInsights();

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
          {loadingInsights ? <Skeleton className="h-16 w-full" /> : (
            <p className="text-sm leading-relaxed text-muted-foreground">{insights?.aiInsight}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTrophy className="h-5 w-5 text-amber-500" /> Rakip Tablosu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingComp ? <div className="p-6"><Skeleton className="h-48 w-full" /></div> : (
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
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.wonTenders}</td>
                        <td className="px-4 py-3 text-right tabular-nums">%{c.avgDiscountRate?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{c.encounters}</td>
                      </tr>
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
            {loadingInsights ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={insights?.categoryWinRates ?? []} layout="vertical" barCategoryGap={8}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `%${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => `%${v}`} />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {(insights?.categoryWinRates ?? []).map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.winRate >= 50 ? "#10b981" : entry.winRate >= 35 ? "#f59e0b" : "#6366f1"} />
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
