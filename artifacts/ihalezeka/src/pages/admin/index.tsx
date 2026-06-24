import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconUsers, IconDatabase, IconSpeakerphone, IconMail } from "@tabler/icons-react";
import AdminUsersTab from "./users";
import AdminScrapersTab from "./scrapers";
import AdminMarketingTab from "./marketing";
import AdminEmailComposer from "./email-composer";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Yönetim Paneli</h1>
        <p className="text-sm text-muted-foreground mt-1">Kullanıcı, abonelik ve sistem yönetimi</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2">
            <IconUsers className="h-4 w-4" />
            Kullanıcılar
          </TabsTrigger>
          <TabsTrigger value="scrapers" className="gap-2">
            <IconDatabase className="h-4 w-4" />
            Veri Kaynakları
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2">
            <IconSpeakerphone className="h-4 w-4" />
            Pazarlama
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <IconMail className="h-4 w-4" />
            E-posta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsersTab />
        </TabsContent>

        <TabsContent value="scrapers">
          <AdminScrapersTab />
        </TabsContent>

        <TabsContent value="marketing">
          <AdminMarketingTab />
        </TabsContent>

        <TabsContent value="email">
          <AdminEmailComposer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
