import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  IconSpeakerphone,
  IconPencil,
  IconCalendar,
  IconBrandWordpress,
  IconPlugConnected,
  IconChevronRight,
} from "@tabler/icons-react";

const MARKETING_LINKS = [
  {
    href: "/pazarlama",
    label: "Pazarlama Özeti",
    description: "İçerik ve kanal performans özetini görüntüle",
    icon: IconSpeakerphone,
  },
  {
    href: "/pazarlama/icerik-uretici",
    label: "İçerik Üretici",
    description: "Yapay zeka destekli içerik ve görseller oluştur",
    icon: IconPencil,
  },
  {
    href: "/pazarlama/takvim",
    label: "İçerik Takvimi",
    description: "Planlanmış gönderileri görüntüle ve yönet",
    icon: IconCalendar,
  },
  {
    href: "/pazarlama/blog",
    label: "Blog Yönetimi",
    description: "Blog yazılarını yayınla ve düzenle",
    icon: IconBrandWordpress,
  },
  {
    href: "/pazarlama/baglantilar",
    label: "Sosyal Bağlantılar",
    description: "LinkedIn, Twitter, Facebook OAuth bağlantılarını yönet",
    icon: IconPlugConnected,
  },
];

export default function AdminMarketingTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pazarlama araçlarına buradan erişebilirsiniz. Bu bölüm yalnızca yöneticilere görünür.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MARKETING_LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <a>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
                    </div>
                    <IconChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
