import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, RefreshCw, Mail, Smartphone, Bell } from "lucide-react";

interface DeliveryLog {
  id: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: Smartphone,
  in_app: Bell,
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-500/10 text-green-600",
  delivered: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  failed: "bg-destructive/10 text-destructive",
};

export default function NotificationDeliveryLog() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = role === "owner";

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    const query = supabase
      .from("notification_delivery_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data } = await query;
    setLogs((data as DeliveryLog[]) || []);
    setLoading(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          سجل التوصيل
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchLogs} className="gap-1 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>القناة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الخطأ</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const ChannelIcon = CHANNEL_ICONS[log.channel] || Bell;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs">
                            {log.channel === "email" ? "بريد" : log.channel === "sms" ? "رسالة نصية" : "منصة"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_STYLES[log.status] || ""}`}>
                          {log.status === "sent" ? "تم الإرسال" :
                           log.status === "failed" ? "فشل" :
                           log.status === "pending" ? "قيد الإرسال" : log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <span className="text-xs text-destructive truncate max-w-[200px] block">{log.error_message}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
