import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconUsers,
  IconCrown,
  IconCurrencyDollar,
  IconSearch,
  IconShield,
  IconShieldOff,
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface AdminUser {
  id: number;
  userId: string;
  email: string | null;
  searchCredits: number;
  isAdmin: boolean;
  isProOverride: boolean;
  isPro: boolean;
  stripeCustomerId: string | null;
  companyName: string | null;
  profileCompletionPct: number;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  proCount: number;
  mrr: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function fmt(date: string): string {
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminUsersTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Stats alınamadı");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE}/admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Kullanıcılar alınamadı");
      return res.json();
    },
    staleTime: 30_000,
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: { isAdmin?: boolean; isProOverride?: boolean; searchCredits?: number } }) => {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Güncelleme başarısız");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Kullanıcı güncellendi");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Güncelleme başarısız");
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconUsers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Kullanıcı</p>
                <p className="text-2xl font-bold tabular-nums">{stats?.totalUsers ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#EAEFFF] flex items-center justify-center shrink-0">
                <IconCrown className="h-5 w-5 text-[#2D5BFF]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pro Aboneler</p>
                <p className="text-2xl font-bold tabular-nums">{stats?.proCount ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <IconCurrencyDollar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tahmini Aylık Gelir</p>
                <p className="text-2xl font-bold tabular-nums">
                  ${stats?.mrr?.toLocaleString("en-US") ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Kullanıcı Listesi</CardTitle>
            <form onSubmit={handleSearchSubmit} className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-64 text-sm"
                placeholder="E-posta veya kullanıcı ID ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
              <IconLoader2 className="h-5 w-5 animate-spin" />
              <span>Yükleniyor…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-40 text-destructive text-sm">
              Kullanıcılar alınamadı
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Kayıt Tarihi</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Kredi</TableHead>
                      <TableHead>Profil</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-[#2D5BFF] flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                              {user.email?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate max-w-[180px]">
                                {user.companyName ?? user.email ?? user.userId}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {user.email ?? user.userId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmt(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          {user.isPro ? (
                            <Badge className="bg-[#EAEFFF] text-[#2D5BFF] border-[#EAEFFF] text-[11px] gap-1">
                              <IconCrown className="h-3 w-3" /> Pro
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                              Ücretsiz
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{user.searchCredits}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  user.profileCompletionPct >= 80
                                    ? "bg-emerald-500"
                                    : user.profileCompletionPct >= 40
                                    ? "bg-amber-500"
                                    : "bg-rose-400",
                                )}
                                style={{ width: `${user.profileCompletionPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">
                              {user.profileCompletionPct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px] gap-1">
                              <IconShield className="h-3 w-3" /> Admin
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Kullanıcı</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5"
                              disabled={patchMutation.isPending}
                              onClick={() =>
                                patchMutation.mutate({ id: user.id, patch: { isProOverride: !user.isProOverride } })
                              }
                              title={user.isProOverride ? "Pro yetkisini kaldır" : "Pro olarak işaretle (test)"}
                            >
                              {user.isProOverride ? (
                                <>
                                  <IconToggleRight className="h-3.5 w-3.5 text-[#2D5BFF]" />
                                  Pro Kaldır
                                </>
                              ) : (
                                <>
                                  <IconToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                  Pro Yap
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5"
                              disabled={patchMutation.isPending}
                              onClick={() =>
                                patchMutation.mutate({ id: user.id, patch: { isAdmin: !user.isAdmin } })
                              }
                              title={user.isAdmin ? "Admin yetkisini kaldır" : "Admin yap"}
                            >
                              {user.isAdmin ? (
                                <>
                                  <IconShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  Yetkiyi Al
                                </>
                              ) : (
                                <>
                                  <IconShield className="h-3.5 w-3.5 text-amber-500" />
                                  Admin Yap
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data?.users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-10">
                          Kullanıcı bulunamadı
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data && data.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {data.total} kullanıcıdan {(page - 1) * data.limit + 1}–
                    {Math.min(page * data.limit, data.total)} gösteriliyor
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <IconChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {page} / {data.pages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page >= data.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
