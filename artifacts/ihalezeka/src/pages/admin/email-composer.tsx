import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconMail,
  IconSend,
  IconLoader2,
  IconUsers,
  IconCheck,
  IconX,
  IconEye,
} from "@tabler/icons-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface EmailLog {
  id: number;
  to: string;
  subject: string;
  status: string;
  triggeredBy?: string | null;
  sentAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminEmailComposer() {
  const qc = useQueryClient();
  const [recipientMode, setRecipientMode] = useState<"single" | "all">("single");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(false);

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: EmailLog[] }>({
    queryKey: ["/api/admin/email/logs"],
    queryFn: () =>
      fetch(`${API_BASE}/admin/email/logs`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 10000,
  });

  const { data: usersData } = useQuery<{ total: number }>({
    queryKey: ["/api/admin/email/users"],
    queryFn: () =>
      fetch(`${API_BASE}/admin/email/users`, { credentials: "include" }).then((r) => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const to = recipientMode === "all" ? "__all__" : toEmail.trim();
      const res = await fetch(`${API_BASE}/admin/email/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gönderilemedi");
      return data as { sent: number; failed: number; total?: number };
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        toast.warning(`${data.sent} gönderildi, ${data.failed} başarısız`);
      } else {
        toast.success(`${data.sent} e-posta başarıyla gönderildi`);
      }
      qc.invalidateQueries({ queryKey: ["/api/admin/email/logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const canSend =
    subject.trim().length > 0 &&
    html.trim().length > 0 &&
    (recipientMode === "all" || toEmail.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconMail className="h-4 w-4" />
            E-posta Gönder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label>Alıcı</Label>
            <div className="flex gap-2">
              <Select
                value={recipientMode}
                onValueChange={(v) => setRecipientMode(v as "single" | "all")}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Tek adres</SelectItem>
                  <SelectItem value="all">
                    Tüm kullanıcılar {usersData?.total ? `(${usersData.total})` : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
              {recipientMode === "single" && (
                <Input
                  type="email"
                  placeholder="ornek@email.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="flex-1"
                />
              )}
              {recipientMode === "all" && (
                <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground px-3 border rounded-md bg-muted/30">
                  <IconUsers className="h-4 w-4" />
                  {usersData?.total ?? "..."} kullanıcıya gönderilecek
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input
              placeholder="E-posta konusu..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body + Preview toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>İçerik (HTML)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setPreview(!preview)}
              >
                <IconEye className="h-3 w-3" />
                {preview ? "Düzenle" : "Önizle"}
              </Button>
            </div>
            {preview ? (
              <div
                className="min-h-[200px] border rounded-md p-3 overflow-auto bg-white text-sm"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <Textarea
                placeholder="<p>Merhaba, ...</p>"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            )}
          </div>

          {/* Send */}
          <div className="flex justify-end">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className="gap-2"
            >
              {sendMutation.isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSend className="h-4 w-4" />
              )}
              {recipientMode === "all" ? "Herkese Gönder" : "Gönder"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Gönderilen E-postalar</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !logsData?.logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Henüz gönderilmiş e-posta yok
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsData.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.to}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{log.subject}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.triggeredBy ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.status === "sent" ? "default" : "destructive"}
                        className="gap-1"
                      >
                        {log.status === "sent" ? (
                          <IconCheck className="h-3 w-3" />
                        ) : (
                          <IconX className="h-3 w-3" />
                        )}
                        {log.status === "sent" ? "Gönderildi" : "Başarısız"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(log.sentAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
