import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconUsers, IconDatabase, IconSpeakerphone } from "@tabler/icons-react";
import AdminUsersTab from "./users";
import AdminScrapersTab from "./scrapers";
import AdminMarketingTab from "./marketing";

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
      </Tabs>
    </div>
  );
}
