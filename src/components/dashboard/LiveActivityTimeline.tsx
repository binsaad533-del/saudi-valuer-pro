import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  description: string | null;
  created_at: string;
  user_name: string | null;
  user_role: string | null;
  table_name: string;
}

const actionColors: Record<string, string> = {
  status_change: "bg-primary",
  create: "bg-success",
  update: "bg-accent",
  delete: "bg-destructive",
  login: "bg-warning",
  insert: "bg-success",
};

const roleLabels: Record<string, string> = {
  owner: "المالك",
  client: "العميل",
  inspector: "المعاين",
  financial_manager: "المدير المالي",
  admin: "مدير",
};

export default function LiveActivityTimeline() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, description, created_at, user_name, user_role, table_name")
        .order("created_at", { ascending: false })
        .limit(10);
      setEntries((data as AuditEntry[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} س`;
    const diffDay = Math.floor(diffHr / 24);
    return `منذ ${diffDay} يوم`;
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            النشاط الأخير
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{entries.length} حدث</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا يوجد نشاط مسجّل</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={entry.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${actionColors[entry.action] || "bg-muted-foreground"}`} />
                  {i < entries.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed truncate">
                    {entry.description || `${entry.action} — ${entry.table_name}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{formatTime(entry.created_at)}</span>
                    {entry.user_role && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                        {roleLabels[entry.user_role] || entry.user_role}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
