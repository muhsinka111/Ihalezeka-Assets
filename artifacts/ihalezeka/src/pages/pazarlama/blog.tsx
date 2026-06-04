import React from "react";
import {
  IconArticle,
  IconLoader2,
  IconExternalLink,
  IconPlus,
  IconCalendar,
  IconTag,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SocialPost {
  id: number;
  title: string;
  body: string;
  blogBody: string | null;
  imageUrl: string | null;
  blogSlug: string | null;
  metaDescription: string | null;
  status: string;
  topic: string | null;
  platforms: string[];
  createdAt: string;
  publishedAt: string | null;
}

async function fetchPosts(): Promise<SocialPost[]> {
  const res = await fetch(`${API_BASE}/marketing/posts`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const all = await res.json() as SocialPost[];
  return all.filter((p) => p.blogSlug != null);
}

export default function BlogAdminPage() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["marketing-posts-blog"],
    queryFn: fetchPosts,
    refetchInterval: 30000,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Blog Yazıları</h1>
          <p className="text-muted-foreground">SEO dostu blog yazılarınızı yönetin. Her yazı Google tarafından taranabilir.</p>
        </div>
        <div className="flex gap-2">
          <a href="/blog" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <IconExternalLink className="h-4 w-4" />
              Blog'u Gör
            </Button>
          </a>
          <Link href={`${basePath}/pazarlama/icerik-uretici`}>
            <Button size="sm" className="gap-2">
              <IconPlus className="h-4 w-4" />
              Yeni Yazı
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <IconArticle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400">
          <p className="font-medium mb-0.5">Blog SEO hakkında</p>
          <p className="text-xs opacity-80">
            Her blog yazısı sunucu taraflı oluşturulur. Otomatik olarak{" "}
            <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-xs">&lt;title&gt;</code>,{" "}
            <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-xs">meta description</code>,{" "}
            Open Graph ve JSON-LD Article şeması içerir. Sitemap{" "}
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="underline font-medium">/sitemap.xml</a>{" "}
            adresinde otomatik güncellenir.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          Yazılar yükleniyor…
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <IconArticle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Henüz blog yazısı yok</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              AI İçerik Üretici ile blog yazısı içeren içerikler oluşturun.
            </p>
            <Link href={`${basePath}/pazarlama/icerik-uretici`}>
              <Button size="sm" className="mt-4 gap-2">
                <IconPlus className="h-4 w-4" />
                Blog Yazısı Oluştur
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className="border-border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-4">
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-20 h-20 rounded-lg object-cover shrink-0 border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-sm">{post.title}</h3>
                    <Badge
                      className={
                        post.status === "published"
                          ? "text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
                          : "text-[10px] bg-muted text-muted-foreground border-border"
                      }
                    >
                      {post.status === "published" ? "Yayında" : "Taslak"}
                    </Badge>
                  </div>
                  {post.metaDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.metaDescription}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                      <IconCalendar className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                    {post.topic && (
                      <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                        <IconTag className="h-3 w-3" />
                        {post.topic}
                      </span>
                    )}
                  </div>
                </div>
                {post.blogSlug && (
                  <div className="shrink-0">
                    <a href={`/blog/${post.blogSlug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                        <IconExternalLink className="h-3 w-3" />
                        Görüntüle
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
