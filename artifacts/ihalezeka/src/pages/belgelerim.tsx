import { useState } from "react";
import { useListDocuments, useListDocumentFolders, useDeleteDocument } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconFolder, IconFolderOpen, IconFileText, IconTrash, IconUpload, IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  valid: { label: "Geçerli", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: IconCheck },
  expiring_soon: { label: "Süresi Dolmak Üzere", color: "bg-amber-100 text-amber-700 border-amber-200", icon: IconAlertTriangle },
  expired: { label: "Süresi Dolmuş", color: "bg-rose-100 text-rose-700 border-rose-200", icon: IconX },
  pending: { label: "Bekleniyor", color: "bg-slate-100 text-slate-700 border-slate-200", icon: IconFileText },
};

export default function BelgelerimPage() {
  const [activeFolder, setActiveFolder] = useState<string | undefined>();
  const { data: folders, isLoading: fLoading } = useListDocumentFolders();
  const { data: docs, isLoading: dLoading, refetch } = useListDocuments(activeFolder ? { folder: activeFolder } : {});
  const deleteMutation = useDeleteDocument();

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Belgelerim</h1>
          <p className="text-muted-foreground text-sm">İhale başvurularında kullandığınız belgeleri yönetin.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2"><IconUpload className="h-4 w-4" /> Belge Yükle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Belge Yükle</DialogTitle></DialogHeader>
            <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 text-center">
              <IconUpload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Dosyayı buraya sürükleyin veya tıklayın</p>
              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX • Maks. 50 MB</p>
              <Button variant="outline" size="sm">Dosya Seç</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Klasörler</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            <button
              onClick={() => setActiveFolder(undefined)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                ${!activeFolder ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
            >
              {!activeFolder ? <IconFolderOpen className="h-4 w-4 shrink-0" /> : <IconFolder className="h-4 w-4 shrink-0" />}
              Tüm Belgeler
            </button>
            {fLoading ? <Skeleton className="h-32 w-full" /> : (folders ?? []).map((f: any) => (
              <button
                key={f.name}
                onClick={() => setActiveFolder(f.name)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                  ${activeFolder === f.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  {activeFolder === f.name ? <IconFolderOpen className="h-4 w-4 shrink-0" /> : <IconFolder className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{f.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{f.count}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Document Table */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            {dLoading ? <div className="p-6"><Skeleton className="h-48 w-full" /></div> : !docs?.length ? (
              <div className="p-12 flex flex-col items-center gap-3 text-center">
                <IconFileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Bu klasörde belge bulunmuyor.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Belge Adı</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Klasör</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Geçerlilik</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {docs.map((doc: any) => {
                    const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.valid;
                    const Icon = cfg.icon;
                    return (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconFileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.folder}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                            <Icon className="h-3 w-3" />{cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{doc.validUntil ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
