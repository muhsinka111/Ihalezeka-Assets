import React from "react";
import { Link } from "wouter";
import {
  IconBrandLinkedin,
  IconBrandX,
  IconBrandFacebook,
  IconBrandYoutube,
  IconSparkles,
  IconCalendar,
  IconArticle,
  IconPlugConnected,
  IconArrowRight,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PazarlamaPage() {
  const panels = [
    {
      href: `${basePath}/pazarlama/icerik-uretici`,
      icon: IconSparkles,
      title: "İçerik Üretici",
      description: "AI ile platform-optimize edilmiş sosyal medya içerikleri, blog yazıları ve görseller üretin.",
      color: "from-violet-500 to-purple-600",
      badge: "AI",
    },
    {
      href: `${basePath}/pazarlama/takvim`,
      icon: IconCalendar,
      title: "İçerik Takvimi",
      description: "Taslak, zamanlanmış ve yayınlanmış gönderilerinizi tek ekranda takip edin.",
      color: "from-blue-500 to-indigo-600",
      badge: null,
    },
    {
      href: `${basePath}/pazarlama/blog`,
      icon: IconArticle,
      title: "Blog",
      description: "SEO dostu blog yazılarınızı yönetin. Google tarafından taranabilir, Open Graph destekli.",
      color: "from-emerald-500 to-teal-600",
      badge: "SEO",
    },
    {
      href: `${basePath}/pazarlama/baglantilar`,
      icon: IconPlugConnected,
      title: "Platform Bağlantıları",
      description: "LinkedIn, Meta, X/Twitter ve YouTube hesaplarınızı bağlayın veya yönetin.",
      color: "from-orange-500 to-red-500",
      badge: null,
    },
  ];

  const platforms = [
    { icon: IconBrandLinkedin, name: "LinkedIn", color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10" },
    { icon: IconBrandFacebook, name: "Facebook", color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" },
    { icon: IconBrandX, name: "X / Twitter", color: "text-foreground", bg: "bg-foreground/10" },
    { icon: IconBrandYoutube, name: "YouTube", color: "text-[#FF0000]", bg: "bg-[#FF0000]/10" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Pazarlama Paneli</h1>
        <p className="text-muted-foreground">AI destekli içerik üretimi, sosyal medya yönetimi ve SEO araçları.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {panels.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.href} href={p.href}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow group border-border">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{p.title}</h3>
                        {p.badge && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{p.badge}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                    </div>
                    <IconArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desteklenen Platformlar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {platforms.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${p.bg}`}>
                  <Icon className={`h-5 w-5 ${p.color}`} />
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Platform hesaplarınızı bağlamak için{" "}
            <Link href={`${basePath}/pazarlama/baglantilar`} className="text-primary hover:underline">Platform Bağlantıları</Link>{" "}
            sayfasını ziyaret edin.
          </p>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">İçerik üretmeye başlayın</h3>
              <p className="text-sm text-muted-foreground">
                AI ile platforma özel gönderi, blog yazısı ve görsel oluşturun. Birkaç tıkla yayınlayın.
              </p>
            </div>
            <Link href={`${basePath}/pazarlama/icerik-uretici`}>
              <Button className="gap-2 shrink-0">
                <IconSparkles className="h-4 w-4" />
                İçerik Üret
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
