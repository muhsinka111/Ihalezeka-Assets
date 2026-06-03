import { useGetReportsSummary, useGetReportsApplicationsChart, useGetReportsCategoryPerformance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { IconTrophy, IconFileText, IconRobot, IconTrendingUp } from "@tabler/icons-react";

export default function RaporlarPage() {
  const { data: summary, isLoading: ls } = useGetReportsSummary();
  const { data: appChart, isLoading: lac } = useGetReportsApplicationsChart();
  const { data: catPerf, isLoading: lcp } = useGetReportsCategoryPerformance();

  const kpis = summary ? [
    { label: "Toplam Başvuru", value: summary.totalApplications, icon: IconFileText, color: "text-primary" },
    { label: "Kazanılan", value: summary.wonCount, icon: IconTrophy, color: "text-emerald-500" },
    { label: "Başarı Oranı", value: `%${summary.successRate}`, icon: IconTrendingUp, color: "text-amber-500" },
    { label: "Kazanılan Değer", value: `₺${((summary.totalWonValue ?? 0) / 1_000_000).toFixed(1)}M`, icon: IconTrendingUp, color: "text-violet-500" },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Raporlar</h1>
        <p className="text-muted-foreground text-sm">İhale performansınızı ve geçmiş başvuru istatistiklerinizi görüntüleyin.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ls ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />) : kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="text-2xl font-bold font-heading">{k.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Summary */}
      <Card className="border-primary/20 bg-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconRobot className="h-5 w-5 text-primary" /> Yapay Zeka Yönetici Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ls ? <Skeleton className="h-16 w-full" /> : (
            <p className="text-sm leading-relaxed text-muted-foreground">{summary?.aiSummary}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications vs Wins */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aylık Başvuru ve Kazanım</CardTitle>
          </CardHeader>
          <CardContent>
            {lac ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={appChart ?? []} barCategoryGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="applications" name="Başvuru" fill="#2C46D8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="wins" name="Kazanım" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori Başarı Oranları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lcp ? <Skeleton className="h-52 w-full" /> : (catPerf ?? []).map((c: any) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{c.category}</span>
                  <span className="text-muted-foreground tabular-nums">%{c.winRate.toFixed(1)} ({c.wins}/{c.applications})</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${c.winRate}%`, background: c.winRate >= 50 ? "#10b981" : c.winRate >= 35 ? "#f59e0b" : "#2C46D8" }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
