import { useState, useEffect, useRef } from "react";
import { useGetMoneyFlowMonthly, useGetMoneyFlowCategories, useGetMoneyFlowTopAgencies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2C46D8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const TYPE_COLOR: Record<string, string> = {
  yapim: "text-blue-400",
  hizmet: "text-amber-400",
  mal: "text-emerald-400",
  danismanlik: "text-violet-400",
};

function typeColor(type: string) {
  const lower = type.toLowerCase();
  for (const key of Object.keys(TYPE_COLOR)) {
    if (lower.includes(key)) return TYPE_COLOR[key];
  }
  return "text-slate-300";
}

function fmt(n: number) {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n.toLocaleString("tr-TR")}`;
}

interface TickerItem {
  id: number;
  title: string;
  agencyName: string;
  estimatedValue: number;
  type: string;
}

function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/money-flow/recent-ticker`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TickerItem[]) => setItems(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;
    let frame: number;
    let offset = 0;
    const speed = 0.4;

    function tick() {
      offset += speed;
      const halfWidth = el!.scrollWidth / 2;
      if (offset >= halfWidth) offset -= halfWidth;
      el!.style.transform = `translateX(-${offset}px)`;
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [items]);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="w-full overflow-hidden bg-slate-900 border border-slate-700 rounded-xl px-0 py-2.5">
      <div className="flex items-center gap-0">
        <div className="shrink-0 flex items-center gap-2 px-4 pr-5 border-r border-slate-700 mr-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest whitespace-nowrap">
            Canlı
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div ref={trackRef} className="flex gap-8 will-change-transform" style={{ width: "max-content" }}>
            {doubled.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-semibold font-mono ${typeColor(item.type)}`}>
                  {fmt(item.estimatedValue)}
                </span>
                <span className="text-[11px] text-slate-300 max-w-[240px] truncate">{item.title}</span>
                <span className="text-[10px] text-slate-500 max-w-[140px] truncate">{item.agencyName}</span>
                <span className="text-slate-700 text-xs">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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

      <LiveTicker />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
