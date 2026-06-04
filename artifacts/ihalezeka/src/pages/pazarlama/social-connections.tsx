import React, { useState } from "react";
import {
  IconBrandLinkedin,
  IconBrandX,
  IconBrandFacebook,
  IconBrandYoutube,
  IconPlugConnected,
  IconPlugOff,
  IconCheck,
  IconLoader2,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface Connection {
  id: number;
  platform: string;
  accountName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

async function fetchConnections(): Promise<Connection[]> {
  const res = await fetch(`${API_BASE}/marketing/connections`);
  if (!res.ok) throw new Error("Failed to fetch connections");
  return res.json();
}

async function disconnectPlatform(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/marketing/connections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to disconnect");
}

const PLATFORMS = [
  {
    key: "linkedin",
    name: "LinkedIn",
    icon: IconBrandLinkedin,
    color: "text-[#0A66C2]",
    bg: "bg-[#0A66C2]/10",
    border: "border-[#0A66C2]/20",
    description: "Profesyonel ağda şirket gönderileri, makale paylaşımları ve sektörel içerikler yayınlayın.",
    authUrl: `${API_BASE}/marketing/oauth/linkedin/start`,
  },
  {
    key: "facebook",
    name: "Facebook / Instagram",
    icon: IconBrandFacebook,
    color: "text-[#1877F2]",
    bg: "bg-[#1877F2]/10",
    border: "border-[#1877F2]/20",
    description: "Facebook sayfanıza ve Instagram hesabınıza fotoğraflı gönderiler paylaşın.",
    authUrl: `${API_BASE}/marketing/oauth/facebook/start`,
  },
  {
    key: "twitter",
    name: "X / Twitter",
    icon: IconBrandX,
    color: "text-foreground",
    bg: "bg-foreground/10",
    border: "border-border",
    description: "Tweet ve thread'ler aracılığıyla anlık güncellemeler ve platform haberleri paylaşın.",
    authUrl: `${API_BASE}/marketing/oauth/twitter/start`,
  },
  {
    key: "youtube",
    name: "YouTube",
    icon: IconBrandYoutube,
    color: "text-[#FF0000]",
    bg: "bg-[#FF0000]/10",
    border: "border-[#FF0000]/20",
    description: "YouTube Topluluk gönderileri oluşturun ve takipçilerinizi güncel tutun.",
    authUrl: `${API_BASE}/marketing/oauth/youtube/start`,
  },
];

export default function SocialConnectionsPage() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const [disconnecting, setDisconnecting] = useState<number | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["marketing-connections"],
    queryFn: fetchConnections,
    refetchInterval: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectPlatform,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-connections"] }),
  });

  const connectedPlatform = new URLSearchParams(location.split("?")[1] ?? "").get("connected");
  const errorPlatform = new URLSearchParams(location.split("?")[1] ?? "").get("error");

  function getConnection(platformKey: string): Connection | undefined {
    return connections.find((c) => c.platform === platformKey);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Platform Bağlantıları</h1>
        <p className="text-muted-foreground">Sosyal medya hesaplarınızı bağlayarak doğrudan İhaleZeka'dan içerik yayınlayın.</p>
      </div>

      {connectedPlatform && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
          <IconCheck className="h-4 w-4 shrink-0" />
          <span><strong>{connectedPlatform}</strong> hesabı başarıyla bağlandı!</span>
        </div>
      )}

      {errorPlatform && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{errorPlatform}</strong> bağlantısı sırasında bir hata oluştu. OAuth ayarlarını kontrol edin.</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          Bağlantılar yükleniyor…
        </div>
      )}

      <div className="space-y-3">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const conn = getConnection(p.key);
          const isConnected = !!conn;

          return (
            <Card key={p.key} className={`border ${isConnected ? "border-emerald-200 dark:border-emerald-800" : "border-border"}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className={`h-11 w-11 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${p.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{p.name}</span>
                      {isConnected && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                          <IconCheck className="h-2.5 w-2.5 mr-0.5" />
                          Bağlandı
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {isConnected && conn.createdAt && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        Bağlandı: {new Date(conn.createdAt).toLocaleDateString("tr-TR")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={disconnecting === conn.id}
                        onClick={async () => {
                          setDisconnecting(conn.id);
                          try {
                            await disconnectMutation.mutateAsync(conn.id);
                          } finally {
                            setDisconnecting(null);
                          }
                        }}
                      >
                        {disconnecting === conn.id ? (
                          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <IconPlugOff className="h-3.5 w-3.5" />
                        )}
                        Bağlantıyı Kes
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => window.location.href = p.authUrl}
                      >
                        <IconPlugConnected className="h-3.5 w-3.5" />
                        Bağlan
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Not:</strong> OAuth bağlantıları için her platform için ayrı uygulama kaydı ve API anahtarları gereklidir.
            LinkedIn için <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_ID</code> / <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_SECRET</code>,
            Meta için <code className="bg-muted px-1 rounded text-xs">FACEBOOK_APP_ID</code> / <code className="bg-muted px-1 rounded text-xs">FACEBOOK_APP_SECRET</code>,
            Twitter için <code className="bg-muted px-1 rounded text-xs">TWITTER_CLIENT_ID</code> / <code className="bg-muted px-1 rounded text-xs">TWITTER_CLIENT_SECRET</code>,
            YouTube için <code className="bg-muted px-1 rounded text-xs">GOOGLE_CLIENT_ID</code> / <code className="bg-muted px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code>{" "}
            ortam değişkenlerini ayarlayın.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
