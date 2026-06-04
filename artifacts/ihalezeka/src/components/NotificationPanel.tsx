import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconBell,
  IconX,
  IconCheck,
  IconCircleCheck,
  IconBriefcase,
  IconSettings,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  fitScore: number | null;
  tenderTitle: string | null;
  tenderId: number | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch(`${BASE}/api/notifications`);
  if (!res.ok) return { items: [], unreadCount: 0 };
  return res.json();
}

async function markAllRead(): Promise<void> {
  await fetch(`${BASE}/api/notifications/mark-all-read`, { method: "POST" });
}

async function markOneRead(id: number): Promise<void> {
  await fetch(`${BASE}/api/notifications/${id}/read`, { method: "POST" });
}

export function useNotifications() {
  const [data, setData] = useState<NotificationsResponse>({ items: [], unreadCount: 0 });

  const load = async () => {
    const result = await fetchNotifications();
    setData(result);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, reload: load };
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onPrefsClick: () => void;
}

export function NotificationPanel({ open, onClose, onPrefsClick }: NotificationPanelProps) {
  const { data, reload } = useNotifications();
  const [loading, setLoading] = useState(false);

  const handleMarkAllRead = async () => {
    setLoading(true);
    await markAllRead();
    await reload();
    setLoading(false);
  };

  const handleMarkOneRead = async (id: number) => {
    await markOneRead(id);
    await reload();
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}d önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}s önce`;
    return `${Math.floor(hrs / 24)}g önce`;
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}
      <div className={cn(
        "fixed top-14 right-2 z-50 w-[360px] max-w-[calc(100vw-16px)] bg-card border border-border shadow-xl rounded-xl flex flex-col transition-all duration-200 origin-top-right",
        open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <IconBell className="h-4 w-4 text-primary" />
            <span className="font-heading font-semibold text-sm">Bildirimler</span>
            {data.unreadCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 h-[17px] bg-primary text-primary-foreground border-0">
                {data.unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {data.unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary px-2"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                <IconCheck className="h-3.5 w-3.5 mr-1" />
                Tümünü Okundu
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrefsClick}>
              <IconSettings className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <IconX className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[420px] divide-y divide-border/50">
          {data.items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <IconBell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              Henüz bildirim yok
            </div>
          ) : (
            data.items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-4 py-3 hover:bg-muted/30 transition-colors flex items-start gap-3 group",
                  !n.readAt && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold mt-0.5",
                  n.fitScore && n.fitScore >= 70
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                    : n.fitScore && n.fitScore >= 50
                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                    : "bg-gradient-to-br from-indigo-500 to-violet-600"
                )}>
                  <IconBriefcase className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    {n.fitScore !== null && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                        n.fitScore >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        %{n.fitScore} uyum
                      </span>
                    )}
                    {n.tenderId && (
                      <Link href={`/ihale/${n.tenderId}`} onClick={onClose}>
                        <button className="text-[10px] text-primary hover:underline font-medium">
                          Detay →
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => handleMarkOneRead(n.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted shrink-0"
                    title="Okundu işaretle"
                  >
                    <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border text-center">
          <button
            onClick={onPrefsClick}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            Bildirim tercihlerini yönet →
          </button>
        </div>
      </div>
    </>
  );
}

export { fetchNotifications };
