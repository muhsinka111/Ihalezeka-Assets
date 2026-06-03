import { useGetMoneyFlowMonthly, useGetMoneyFlowCategories, useGetMoneyFlowTopAgencies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2C46D8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function fmt(n: number) {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n.toLocaleString("tr-TR")}`;
}

export default function ParaAkisiPage() {
  const { data: monthly, isLoading: lm } = useGetMoneyFlowMonthly();
  const { data: categories, isLoading: lc } = useGetMoneyFlowCategories();
  const { data: agencies, isLoading: la } = useGetMoneyFlowTopAgencies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Para Akışı</h1>
        <p className="text-muted-foreground text-sm">Kamu harcamaları, idare bazlı bütçe dağılımı ve kategori analizi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Aylık Harcama Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            {lm ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={monthly ?? []}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2C46D8" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#2C46D8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Area type="monotone" dataKey="amount" stroke="#2C46D8" strokeWidth={2} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategorilere Göre</CardTitle>
          </CardHeader>
          <CardContent>
            {lc ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={categories ?? []} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                    {(categories ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Agencies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">En Fazla Harcama Yapan İdareler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {la ? <div className="p-6"><Skeleton className="h-48 w-full" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">İdare</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Toplam Harcama</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">İhale Sayısı</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">İl</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(agencies ?? []).map((a: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AgencyLogo name={a.agencyName} logoUrl={a.agencyLogoUrl} className="h-8 w-8 rounded" />
                          <span className="font-medium">{a.agencyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(a.totalSpend)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{a.tenderCount}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.il}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
