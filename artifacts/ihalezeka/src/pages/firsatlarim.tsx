import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { IconRefresh, IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import type { AiSummary } from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function deadlineMeta(deadline: string | null | undefined): { text: string; cls: string } {
  if (deadline == null) return { text: "Belirtilmemiş", cls: "text-muted-foreground" };
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Süresi geçti", cls: "text-rose-600 font-semibold" };
  if (days === 0) return { text: "Bugün son gün", cls: "text-rose-600 font-semibold" };
  if (days <= 7) return { text: `${days} gün kaldı`, cls: "text-amber-600 font-semibold" };
  return { text: `${days} gün kaldı`, cls: "text-emerald-600 font-medium" };
}

function formatTurnover(value: number): string {
  if (value >= 1_000_000_000) return `₺${(value / 1_000_000_000).toFixed(1).replace(".0", "")}Mr`;
  if (value >= 1_000_000) return `₺${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1_000) return `₺${(value / 1_000).toFixed(0)}B`;
  return `₺${value}`;
}

function scoreCls(score: number): string {
  return score >= 70
    ? "bg-emerald-500/10 text-emerald-600"
    : score >= 40
      ? "bg-amber-500/10 text-amber-600"
      : "bg-rose-500/10 text-rose-600";
}

function barColor(score: number): string {
  return score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-500";
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
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EAEFFF]/40 text-[#2D5BFF] border border-[#EAEFFF]/50"
        >
          <span className="text-[#6E8BFF]">{pill.label}:</span>
          {pill.value}
        </span>
      ))}
    </div>
  );
}

export default function FirsatlarimPage() {
  const { data: page, isLoading } = useListMatches();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch(`${API_BASE}/matches/recompute`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRefreshMsg(body?.message ?? "Eşleştirme başarısız oldu.");
        setRefreshing(false);
        return;
      }
      // The recompute runs in the background (scoring every tender far exceeds an
      // HTTP timeout), so we can't await completion. Inform the user and pull
      // fresh data a few times as the run progresses; recompute touches matches
      // + dashboard aggregates, so invalidate everything.
      setRefreshMsg(
        "Eşleştirme başlatıldı — sonuçlar birkaç dakika içinde otomatik güncellenecek.",
      );
      [10000, 30000, 60000, 120000].forEach((delay) => {
        window.setTimeout(() => {
          void queryClient.invalidateQueries();
          void queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        }, delay);
      });
    } catch {
      setRefreshMsg("Eşleştirme başarısız oldu.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Fırsatlarım</h1>
          <p className="text-muted-foreground text-sm">Şirket profilinize uyan ihaleler ve eşleşme skorları.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2D5BFF] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2D5BFF]/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconRefresh className="h-4 w-4" />
          )}
          {refreshing ? "Hesaplanıyor…" : "Eşleşmeleri Yenile"}
        </button>
      </div>

      {refreshMsg && (
        <div className="rounded-lg border border-border/50 bg-secondary/50 px-4 py-2.5 text-sm text-muted-foreground">
          {refreshMsg}
        </div>
      )}

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
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-4 py-3 font-medium">İdare</th>
                  <th className="px-4 py-3 font-medium">İKN / Başlık</th>
                  <th className="px-4 py-3 font-medium text-center">Uyum Skoru</th>
                  <th className="px-4 py-3 font-medium">Tahmini Bedel</th>
                  <th className="px-4 py-3 font-medium">Son Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {page?.items.map((match) => {
                  const dl = deadlineMeta(match.tender.deadline);
                  const breakdown = match.breakdown ?? [];
                  const hasBreakdown = breakdown.length > 0;
                  const isOpen = expanded.has(match.id);
                  return (
                    <Fragment key={match.id}>
                      <tr
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { window.location.href = `${import.meta.env.BASE_URL}ihale/${match.tender.id}`; }}
                      >
                        <td className="px-4 py-3">
                          {hasBreakdown && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggle(match.id); }}
                              aria-label="Skor detayını göster"
                              className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <IconChevronDown
                                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="font-medium line-clamp-1">{match.tender.agencyName}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs text-muted-foreground">{match.tender.ikn}</span>
                            {match.aiSummary && (
                              <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-bold tracking-wide bg-[#2D5BFF] text-white leading-none">
                                AI
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/ihale/${match.tender.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium line-clamp-2 hover:text-primary hover:underline"
                          >
                            {match.tender.title}
                          </Link>
                          {match.winnability && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{match.winnability}</p>
                          )}
                          {match.aiSummary && <AiThresholdPills aiSummary={match.aiSummary} />}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${scoreCls(match.fitScore)}`}>
                            %{match.fitScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {match.tender.estimatedValue != null ? `₺${match.tender.estimatedValue.toLocaleString('tr-TR')}` : "Belirtilmemiş"}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-xs ${dl.cls}`}>
                          {dl.text}
                        </td>
                      </tr>
                      {isOpen && hasBreakdown && (
                        <tr key={`${match.id}-breakdown`} className="bg-secondary/30">
                          <td></td>
                          <td colSpan={5} className="px-4 py-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                              Skor Dağılımı
                            </p>
                            <div className="grid gap-3.5 sm:grid-cols-2">
                              {breakdown.map((item) => (
                                <div key={item.key}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-sm font-medium flex items-center gap-1.5">
                                      {item.label}
                                      <span className="text-[10px] text-muted-foreground font-normal">
                                        ağırlık %{item.weight}
                                      </span>
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums">{item.score}</span>
                                  </div>
                                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${barColor(item.score)}`}
                                      style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
                                    />
                                  </div>
                                  {item.reasoning && (
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.reasoning}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
