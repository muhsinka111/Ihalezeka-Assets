import React, { useState } from "react";
import {
  IconCalendar,
  IconLoader2,
  IconBrandLinkedin,
  IconBrandX,
  IconBrandFacebook,
  IconBrandYoutube,
  IconBrandInstagram,
  IconSend,
  IconClock,
  IconTrash,
  IconCheck,
  IconX,
  IconPlus,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SocialPost {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  platforms: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  topic: string | null;
  blogSlug: string | null;
  platformResults: Record<string, { status: string; postId?: string; error?: string }> | null;
  createdAt: string;
}

async function fetchPosts(): Promise<SocialPost[]> {
  const res = await fetch(`${API_BASE}/marketing/posts`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

async function publishPost(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/marketing/posts/${id}/publish`, { method: "POST" });
  if (!res.ok) throw new Error("Publish failed");
}

async function schedulePost(id: number, scheduledAt: string): Promise<void> {
  const res = await fetch(`${API_BASE}/marketing/posts/${id}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Schedule failed");
  }
}

async function deletePost(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/marketing/posts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  linkedin: IconBrandLinkedin,
  twitter: IconBrandX,
  facebook: IconBrandFacebook,
  youtube: IconBrandYoutube,
  instagram: IconBrandInstagram,
};

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "text-[#0A66C2]",
  twitter: "text-foreground",
  facebook: "text-[#1877F2]",
  youtube: "text-[#FF0000]",
  instagram: "text-[#E1306C]",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Taslak", className: "bg-muted text-muted-foreground border-border" },
    scheduled: { label: "Zamanlandı", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
    published: { label: "Yayınlandı", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
    failed: { label: "Başarısız", className: "bg-destructive/15 text-destructive border-destructive/25" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-[10px] px-2 py-0 h-5", className)}>{label}</Badge>;
}

function ScheduleModal({ postId, onClose, onScheduled }: { postId: number; onClose: () => void; onScheduled: () => void }) {
  const minDateTime = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  })();

  const [value, setValue] = useState(minDateTime);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchedule = async () => {
    setError(null);
    setLoading(true);
    try {
      await schedulePost(postId, new Date(value).toISOString());
      onScheduled();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <IconCalendarEvent className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">Yayın Zamanla</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          İçeriğinizin otomatik yayınlanacağı tarih ve saati seçin.
        </p>
        <input
          type="datetime-local"
          value={value}
          min={minDateTime}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
        />
        {error && (
          <p className="text-xs text-destructive mb-3 flex items-center gap-1">
            <IconX className="h-3 w-3" />
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleSchedule} disabled={loading}>
            {loading ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconClock className="h-3.5 w-3.5" />}
            Zamanla
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ContentCalendarPage() {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [schedulingPostId, setSchedulingPostId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["marketing-posts"],
    queryFn: fetchPosts,
    refetchInterval: 15000,
  });

  const publishMutation = useMutation({
    mutationFn: publishPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-posts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-posts"] }),
  });

  const filtered = filterStatus === "all" ? posts : posts.filter((p) => p.status === filterStatus);

  const statusCounts = {
    all: posts.length,
    draft: posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    published: posts.filter((p) => p.status === "published").length,
    failed: posts.filter((p) => p.status === "failed").length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {schedulingPostId !== null && (
        <ScheduleModal
          postId={schedulingPostId}
          onClose={() => setSchedulingPostId(null)}
          onScheduled={() => qc.invalidateQueries({ queryKey: ["marketing-posts"] })}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">İçerik Takvimi</h1>
          <p className="text-muted-foreground">Tüm sosyal medya içeriklerinizi takip edin ve yönetin.</p>
        </div>
        <Link href={`${basePath}/pazarlama/icerik-uretici`}>
          <Button size="sm" className="gap-2">
            <IconPlus className="h-4 w-4" />
            Yeni İçerik
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "draft", "scheduled", "published", "failed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {s === "all" ? "Tümü" : s === "draft" ? "Taslak" : s === "scheduled" ? "Zamanlandı" : s === "published" ? "Yayınlandı" : "Başarısız"}
            <span className="ml-1.5 opacity-60">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          İçerikler yükleniyor…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <IconCalendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Henüz içerik yok</p>
            <p className="text-sm text-muted-foreground/60 mt-1">AI İçerik Üretici ile ilk içeriğinizi oluşturun.</p>
            <Link href={`${basePath}/pazarlama/icerik-uretici`}>
              <Button size="sm" className="mt-4 gap-2">
                <IconPlus className="h-4 w-4" />
                İçerik Üret
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((post) => (
          <Card key={post.id} className="border-border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-4">
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm line-clamp-1">{post.title}</h3>
                      <StatusBadge status={post.status} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {post.platforms.map((p) => {
                        const Icon = PLATFORM_ICONS[p] ?? IconSend;
                        return <Icon key={p} className={cn("h-3.5 w-3.5", PLATFORM_COLORS[p])} />;
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.body}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-muted-foreground/60">
                      {new Date(post.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    {post.publishedAt && (
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <IconCheck className="h-3 w-3" />
                        {new Date(post.publishedAt).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                    {post.scheduledAt && post.status === "scheduled" && (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1">
                        <IconClock className="h-3 w-3" />
                        {new Date(post.scheduledAt).toLocaleString("tr-TR")}
                      </span>
                    )}
                    {post.blogSlug && (
                      <a
                        href={`/blog/${post.blogSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline"
                      >
                        Blog'da Gör →
                      </a>
                    )}
                  </div>

                  {post.platformResults && Object.keys(post.platformResults).length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(post.platformResults).map(([p, r]) => (
                        <span
                          key={p}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1",
                            r.status === "published"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {r.status === "published" ? <IconCheck className="h-2.5 w-2.5" /> : <IconX className="h-2.5 w-2.5" />}
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {(post.status === "draft" || post.status === "failed") && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        disabled={publishing === post.id}
                        onClick={async () => {
                          setPublishing(post.id);
                          try {
                            await publishMutation.mutateAsync(post.id);
                          } finally {
                            setPublishing(null);
                          }
                        }}
                      >
                        {publishing === post.id ? (
                          <IconLoader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <IconSend className="h-3 w-3" />
                        )}
                        Yayınla
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => setSchedulingPostId(post.id)}
                      >
                        <IconClock className="h-3 w-3" />
                        Zamanla
                      </Button>
                    </>
                  )}
                  {post.status === "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => setSchedulingPostId(post.id)}
                    >
                      <IconClock className="h-3 w-3" />
                      Düzenle
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={deleting === post.id}
                    onClick={async () => {
                      setDeleting(post.id);
                      try {
                        await deleteMutation.mutateAsync(post.id);
                      } finally {
                        setDeleting(null);
                      }
                    }}
                  >
                    {deleting === post.id ? (
                      <IconLoader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <IconTrash className="h-3 w-3" />
                    )}
                    Sil
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
