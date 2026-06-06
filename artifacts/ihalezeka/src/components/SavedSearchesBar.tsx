import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSavedSearches,
  useCreateSavedSearch,
  useUpdateSavedSearch,
  useDeleteSavedSearch,
  getListSavedSearchesQueryKey,
} from "@workspace/api-client-react";
import type { SavedSearch, SavedSearchCriteria } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconBookmark, IconBookmarkPlus, IconBell, IconBellOff,
  IconTrash, IconPencil, IconChevronDown, IconSearch,
} from "@tabler/icons-react";
import { toast } from "sonner";

/** Human-readable one-line summary of a saved search's criteria. */
function describeCriteria(c: SavedSearchCriteria): string {
  const parts: string[] = [];
  if (c.q) parts.push(`"${c.q}"`);
  if (c.il) parts.push(c.il);
  if (c.idare) parts.push(c.idare);
  if (c.sector) parts.push(c.sector);
  if (c.tur) parts.push(c.tur);
  if (c.category) parts.push(c.category);
  if (c.source) parts.push(c.source);
  if (c.minBedel) parts.push(`≥₺${c.minBedel.toLocaleString("tr-TR")}`);
  if (c.maxBedel) parts.push(`≤₺${c.maxBedel.toLocaleString("tr-TR")}`);
  return parts.length ? parts.join(" · ") : "Tüm ihaleler";
}

interface SavedSearchesBarProps {
  currentCriteria: SavedSearchCriteria;
  hasActiveFilters: boolean;
  onApply: (criteria: SavedSearchCriteria) => void;
}

export function SavedSearchesBar({ currentCriteria, hasActiveFilters, onApply }: SavedSearchesBarProps) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSavedSearchesQueryKey() });

  const { data: searches = [] } = useListSavedSearches();
  const createMut = useCreateSavedSearch({ mutation: { onSuccess: invalidate } });
  const updateMut = useUpdateSavedSearch({ mutation: { onSuccess: invalidate } });
  const deleteMut = useDeleteSavedSearch({ mutation: { onSuccess: invalidate } });

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const [renameTarget, setRenameTarget] = useState<SavedSearch | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const list = searches as SavedSearch[];

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMut.mutate(
      { data: { name: trimmed, criteria: currentCriteria, alertsEnabled } },
      {
        onSuccess: () => {
          toast.success("Arama kaydedildi", {
            description: alertsEnabled ? "Yeni eşleşmeler e-posta ile bildirilecek." : undefined,
          });
          setSaveOpen(false);
          setName("");
          setAlertsEnabled(true);
        },
        onError: () => toast.error("Arama kaydedilemedi"),
      },
    );
  }

  function handleRename() {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateMut.mutate(
      { id: renameTarget.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          toast.success("Arama yeniden adlandırıldı");
          setRenameTarget(null);
        },
        onError: () => toast.error("İşlem başarısız"),
      },
    );
  }

  function toggleAlerts(s: SavedSearch) {
    updateMut.mutate(
      { id: s.id, data: { alertsEnabled: !s.alertsEnabled } },
      {
        onSuccess: () =>
          toast.success(!s.alertsEnabled ? "E-posta bildirimleri açıldı" : "E-posta bildirimleri kapatıldı"),
        onError: () => toast.error("İşlem başarısız"),
      },
    );
  }

  function handleDelete(s: SavedSearch) {
    deleteMut.mutate(
      { id: s.id },
      {
        onSuccess: () => toast.success("Arama silindi"),
        onError: () => toast.error("Silme başarısız"),
      },
    );
  }

  return (
    <>
      {/* Saved searches dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1.5 shrink-0">
            <IconBookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Kayıtlı</span>
            {list.length > 0 && (
              <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                {list.length}
              </span>
            )}
            <IconChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-semibold">Kayıtlı Aramalar</p>
            <p className="text-xs text-muted-foreground">
              Açık zillerde yeni eşleşen ihaleler e-posta ile bildirilir.
            </p>
          </div>
          {list.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Henüz kayıtlı arama yok.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {list.map((s) => (
                <div key={s.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-muted/60">
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => onApply(s.criteria)}
                    title="Bu aramayı uygula"
                  >
                    <div className="flex items-center gap-1.5">
                      <IconSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {describeCriteria(s.criteria)}
                    </p>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => toggleAlerts(s)}
                      title={s.alertsEnabled ? "Bildirimleri kapat" : "Bildirimleri aç"}
                      className={s.alertsEnabled ? "text-primary p-1" : "text-muted-foreground p-1 hover:text-foreground"}
                    >
                      {s.alertsEnabled ? <IconBell className="h-4 w-4" /> : <IconBellOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => { setRenameTarget(s); setRenameValue(s.name); }}
                      title="Yeniden adlandır"
                      className="text-muted-foreground p-1 hover:text-foreground"
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      title="Sil"
                      className="text-muted-foreground p-1 hover:text-red-600"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save current search */}
      <Button
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={() => setSaveOpen(true)}
        disabled={!hasActiveFilters}
        title={hasActiveFilters ? "Bu aramayı kaydet" : "Kaydetmek için bir filtre veya arama uygulayın"}
      >
        <IconBookmarkPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Kaydet</span>
      </Button>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aramayı Kaydet</DialogTitle>
            <DialogDescription>
              Mevcut arama ve filtreleri bir isimle kaydedin. Açtığınızda her gün yeni eşleşen ihaleler e-postanıza gönderilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Arama adı</label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="örn. İstanbul yapım işleri"
                maxLength={120}
                className="mt-1"
              />
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {describeCriteria(currentCriteria)}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">E-posta bildirimleri</p>
                <p className="text-xs text-muted-foreground">Yeni eşleşen ihaleler için günlük özet.</p>
              </div>
              <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeniden Adlandır</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            maxLength={120}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Vazgeç</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || updateMut.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
