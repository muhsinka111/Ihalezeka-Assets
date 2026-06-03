import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileInvoice, IconTrophy, IconTrendingUp, IconBriefcase, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Gösterge Paneli</h1>
          <p className="text-muted-foreground text-sm">İhaleZeka sisteminize hoş geldiniz. İşte güncel özetiniz.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard 
            title="Aktif Eşleşmeler" 
            value={stats.activeMatches} 
            icon={<IconBriefcase className="h-5 w-5 text-primary" />} 
          />
          <StatsCard 
            title="Boru Hattı (Pipeline)" 
            value={stats.pipelineCount} 
            icon={<IconTrendingUp className="h-5 w-5 text-emerald-500" />} 
          />
          <StatsCard 
            title="Toplam Değer" 
            value={`₺${stats.totalValue.toLocaleString('tr-TR')}`} 
            icon={<IconFileInvoice className="h-5 w-5 text-amber-500" />} 
          />
          <StatsCard 
            title="Kazanma Oranı" 
            value={`%${stats.winRate}`} 
            icon={<IconTrophy className="h-5 w-5 text-violet-500" />} 
          />
          <StatsCard 
            title="Bugün Yeni İhaleler" 
            value={stats.newTendersToday} 
            icon={<IconAlertCircle className="h-5 w-5 text-rose-500" />} 
          />
          <StatsCard 
            title="Ortalama Uyum Skoru" 
            value={`${stats.avgFitScore}/100`} 
            icon={<IconCheck className="h-5 w-5 text-cyan-500" />} 
          />
        </div>
      ) : null}
      
      {/* Further sections (Matches, Pipeline, etc) can be implemented here */}
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-md bg-secondary/50 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-heading">{value}</div>
      </CardContent>
    </Card>
  );
}