import { useListMatches } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import type { AiSummary } from "@workspace/api-client-react";

function formatTurnover(value: number): string {
  if (value >= 1_000_000_000) return `₺${(value / 1_000_000_000).toFixed(1).replace(".0", "")}Mr`;
  if (value >= 1_000_000) return `₺${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1_000) return `₺${(value / 1_000).toFixed(0)}B`;
  return `₺${value}`;
}

function AiThresholdPills({ aiSummary }: { aiSummary: AiSummary }) {
  const pills: { label: string; value: string }[] = [];

  if (aiSummary.requiredTurnover != null) {
    pills.push({ label: "Ciro", value: formatTurnover(aiSummary.requiredTurnover) });
  }
  if (aiSummary.experienceYears != null) {
    pills.push({ label: "Deneyim", value: `${aiSummary.experienceYears} yıl` });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pills.slice(0, 2).map((pill) => (
        <span
          key={pill.label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-600 border border-violet-200/50"
        >
          <span className="text-violet-400">{pill.label}:</span>
          {pill.value}
        </span>
      ))}
    </div>
  );
}

export default function FirsatlarimPage() {
  const { data: page, isLoading } = useListMatches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Fırsatlarım</h1>
        <p className="text-muted-foreground text-sm">Şirket profilinize uyan ihaleler ve eşleşme skorları.</p>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
        ) : page?.items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Eşleşen ihale bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="px-4 py-3 font-medium">İdare</th>
                  <th className="px-4 py-3 font-medium">İKN / Başlık</th>
                  <th className="px-4 py-3 font-medium text-center">Uyum Skoru</th>
                  <th className="px-4 py-3 font-medium">Tahmini Bedel</th>
                  <th className="px-4 py-3 font-medium">Son Tarih</th>
                  <th className="px-4 py-3 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {page?.items.map((match) => (
                  <tr key={match.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="font-medium line-clamp-1">{match.tender.agencyName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs text-muted-foreground">{match.tender.ikn}</span>
                        {match.aiSummary && (
                          <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-bold tracking-wide bg-violet-500 text-white leading-none">
                            AI
                          </span>
                        )}
                      </div>
                      <div className="font-medium line-clamp-2">{match.tender.title}</div>
                      {match.aiSummary && <AiThresholdPills aiSummary={match.aiSummary} />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold
                        ${match.fitScore >= 70 ? 'bg-emerald-500/10 text-emerald-600' : 
                          match.fitScore >= 40 ? 'bg-amber-500/10 text-amber-600' : 
                          'bg-rose-500/10 text-rose-600'}`}>
                        {match.fitScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {match.tender.estimatedValue != null ? `₺${match.tender.estimatedValue.toLocaleString('tr-TR')}` : "Belirtilmemiş"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {match.tender.deadline != null ? new Date(match.tender.deadline).toLocaleDateString('tr-TR') : "Belirtilmemiş"}
                    </td>
                    <td className="px-4 py-3">
                      {/* Action buttons */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
