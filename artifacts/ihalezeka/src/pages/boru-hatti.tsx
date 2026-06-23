import { useState } from "react";
import { useListPipelineItems, useUpdatePipelineItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyLogo } from "@/components/AgencyLogo";
import { IconGripVertical } from "@tabler/icons-react";

const STAGES = [
  { id: "discovery", label: "Fırsat Keşfi", color: "bg-slate-100 border-slate-200" },
  { id: "preparation", label: "Teklif Hazırlığı", color: "bg-blue-50 border-blue-200" },
  { id: "applied", label: "Başvuru Yapıldı", color: "bg-amber-50 border-amber-200" },
  { id: "evaluation", label: "Değerlendirme", color: "bg-[#EAEFFF] border-[#EAEFFF]" },
  { id: "won", label: "Kazanıldı", color: "bg-emerald-50 border-emerald-200" },
];

function fitColor(score: number) {
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function BoruHattiPage() {
  const { data: items, isLoading, refetch } = useListPipelineItems();
  const updateMutation = useUpdatePipelineItem();
  const [dragging, setDragging] = useState<number | null>(null);

  const handleDragStart = (id: number) => setDragging(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (stageId: string) => {
    if (dragging == null) return;
    await updateMutation.mutateAsync({ id: dragging, data: { stage: stageId as any } });
    refetch();
    setDragging(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map((s) => <Skeleton key={s.id} className="h-64" />)}
        </div>
      </div>
    );
  }

  const grouped = STAGES.reduce((acc, s) => {
    acc[s.id] = (items ?? []).filter((i: any) => i.stage === s.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Boru Hattı</h1>
        <p className="text-muted-foreground text-sm">İhalelerinizi aşamalar arasında sürükle-bırak ile yönetin.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-64"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">{stage.label}</span>
              <Badge variant="secondary" className="text-xs">{grouped[stage.id]?.length ?? 0}</Badge>
            </div>
            <div className={`min-h-48 rounded-xl border-2 border-dashed p-3 space-y-3 ${stage.color} transition-colors`}>
              {grouped[stage.id]?.map((item: any) => {
                const hasDeadline = item.tender.deadline != null;
                const daysLeft = hasDeadline ? Math.ceil((new Date(item.tender.deadline).getTime() - Date.now()) / 86400_000) : null;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <AgencyLogo name={item.tender.agencyName} logoUrl={item.tender.agencyLogoUrl} className="h-7 w-7 rounded shrink-0" />
                      <p className="text-xs font-medium line-clamp-2 leading-tight">{item.tender.title}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fitColor(item.tender?.fitScore ?? 70)}`}>
                        {item.tender?.fitScore ?? "—"}
                      </span>
                      <span className={`text-xs ${!hasDeadline ? "text-muted-foreground" : daysLeft! <= 0 ? "text-destructive" : daysLeft! <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {!hasDeadline ? "—" : daysLeft! > 0 ? `${daysLeft}g` : "Süresi geçti"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {grouped[stage.id]?.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">Buraya sürükleyin</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
