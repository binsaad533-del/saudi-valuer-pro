import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, Filter } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تحديث",
  delete: "حذف",
  status_change: "تغيير حالة",
  approve: "اعتماد",
  reject: "رفض",
  assign: "تكليف",
};

const TABLE_LABELS: Record<string, string> = {
  valuation_requests: "طلب",
  valuation_assignments: "تكليف",
  clients: "عميل",
  inspections: "معاينة",
  request_messages: "رسالة",
  payments: "دفعة",
};

function formatLogMessage(log: any): string {
  if (log.description) return log.description;

  const table = TABLE_LABELS[log.table_name] || log.table_name;
  const action = ACTION_LABELS[log.action] || log.action;
  const newData = log.new_data ? (typeof log.new_data === "string" ? JSON.parse(log.new_data) : log.new_data) : {};
  const oldData = log.old_data ? (typeof log.old_data === "string" ? JSON.parse(log.old_data) : log.old_data) : {};
  const ref = newData.reference_number || oldData.reference_number || "";
  const clientName = newData.client_name_ar || newData.name_ar || oldData.client_name_ar || oldData.name_ar || "";

  if (log.table_name === "valuation_requests") {
    if (log.action === "create") {
      return `أدخل ${table} ${ref ? "#" + ref : ""} ${clientName ? "نيابة عن العميل " + clientName : ""}`.trim();
    }
    if (log.action === "update") {
      const changes: string[] = [];
      for (const key of Object.keys(newData)) {
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          if (key.includes("city") || key.includes("district") || key.includes("address")) changes.push("العنوان");
          else if (key.includes("area")) changes.push("المساحة");
          else if (key === "status") changes.push("الحالة");
          else if (key.includes("description")) changes.push("الوصف");
          else changes.push(key);
        }
      }
      const unique = [...new Set(changes)];
      return `صحّح ${unique.length > 0 ? unique.join(" و") : "بيانات"} ${table} ${ref ? "#" + ref : ""}`.trim();
    }
    if (log.action === "status_change") {
      return `غيّر حالة ${table} ${ref ? "#" + ref : ""} إلى ${newData.status || "—"}`;
    }
  }

  if (log.table_name === "request_messages" && log.action === "create") {
    return `أرسل رسالة على ${ref ? "طلب #" + ref : "طلب"} ${newData.content ? '— "' + (newData.content as string).slice(0, 40) + '..."' : ""}`.trim();
  }

  if (log.action === "assign") {
    return `كلّف مقيّم على ${table} ${ref ? "#" + ref : ""}`.trim();
  }

  return `${action} ${table} ${ref ? "#" + ref : ""}`.trim();
}

export default function CoordinatorActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState("all");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  const filtered = tableFilter === "all" ? logs : logs.filter(l => l.table_name === tableFilter);
  const uniqueTables = [...new Set(logs.map(l => l.table_name))];

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            سجل الإجراءات والتحديثات
          </CardTitle>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[160px] text-xs">
              <Filter className="w-3 h-3 ml-1" />
              <SelectValue placeholder="الجدول" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {uniqueTables.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">لا توجد سجلات</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{log.table_name}</span>
                    </div>
                    {log.description && (
                      <p className="text-sm text-foreground mt-1">{log.description}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {new Date(log.created_at).toLocaleString("ar-SA")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
