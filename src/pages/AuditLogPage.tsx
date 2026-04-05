import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/audit-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Shield, ArrowRight, Clock, User, FileText,
  ClipboardList, Users, Package, MapPin, DollarSign, Settings, Loader2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  table_name: string;
  entity_type: string | null;
  record_id: string | null;
  assignment_id: string | null;
  client_id: string | null;
  description: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  request: ClipboardList,
  report: FileText,
  client: Users,
  asset: Package,
  inspection: MapPin,
  payment: DollarSign,
  setting: Settings,
  user: User,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600",
  update: "bg-primary/10 text-primary",
  delete: "bg-destructive/10 text-destructive",
  approve: "bg-emerald-500/10 text-emerald-600",
  reject: "bg-destructive/10 text-destructive",
  override: "bg-warning/10 text-warning",
  merge: "bg-violet-500/10 text-violet-600",
  link: "bg-sky-500/10 text-sky-600",
  generate: "bg-primary/10 text-primary",
  upload: "bg-sky-500/10 text-sky-600",
  status_change: "bg-amber-500/10 text-amber-600",
  lock: "bg-muted text-muted-foreground",
  unlock: "bg-muted text-muted-foreground",
  sign: "bg-emerald-500/10 text-emerald-600",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  admin_coordinator: "منسق إداري",
  financial_manager: "مدير مالي",
  inspector: "معاين",
  client: "عميل",
  valuation_manager: "مدير تقييم",
  valuer: "مقيّم",
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  // View mode from URL params
  const viewMode = searchParams.get("view") || "global";
  const filterId = searchParams.get("id") || "";

  useEffect(() => {
    fetchLogs();
  }, [viewMode, filterId]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (viewMode === "request" && filterId) {
      query = query.eq("assignment_id", filterId);
    } else if (viewMode === "client" && filterId) {
      query = query.eq("client_id", filterId);
    }

    const { data } = await query;
    setLogs((data as AuditEntry[]) || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (entityFilter !== "all" && l.entity_type !== entityFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          (l.user_name || "").toLowerCase().includes(s) ||
          (l.description || "").toLowerCase().includes(s) ||
          (l.record_id || "").toLowerCase().includes(s) ||
          (l.assignment_id || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [logs, actionFilter, entityFilter, searchTerm]);

  const renderChanges = (entry: AuditEntry) => {
    if (!entry.old_data && !entry.new_data) return null;
    const old = entry.old_data || {};
    const nw = entry.new_data || {};
    const allKeys = [...new Set([...Object.keys(old), ...Object.keys(nw)])];
    const changed = allKeys.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(nw[k]));
    if (changed.length === 0) return null;

    return (
      <div className="mt-2 space-y-1 text-xs">
        {changed.slice(0, 5).map((key) => (
          <div key={key} className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{key}:</span>
            {old[key] !== undefined && (
              <span className="line-through text-destructive/70">{String(old[key])}</span>
            )}
            {nw[key] !== undefined && (
              <span className="text-emerald-600">{String(nw[key])}</span>
            )}
          </div>
        ))}
        {changed.length > 5 && (
          <span className="text-muted-foreground/60">+{changed.length - 5} تغييرات أخرى</span>
        )}
      </div>
    );
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];
  const uniqueEntities = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">سجل التدقيق</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "request" ? "سجل الأحداث للطلب" :
             viewMode === "client" ? "سجل الأحداث للعميل" :
             "جميع الأحداث في المنصة"}
          </p>
        </div>
        <Badge variant="outline" className="mr-auto text-xs">
          {filtered.length} سجل
        </Badge>
      </div>

      {/* View tabs for global mode */}
      {!filterId && (
        <Tabs value={viewMode} dir="rtl">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="global" onClick={() => navigate("/audit-log")}>الكل</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم المستخدم أو الوصف أو معرف السجل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="نوع الإجراء" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الإجراءات</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="نوع الكيان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الكيانات</SelectItem>
            {uniqueEntities.map((e) => (
              <SelectItem key={e!} value={e!}>{ENTITY_LABELS[e!] || e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد سجلات تدقيق</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute right-[19px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {filtered.map((entry) => {
              const Icon = ENTITY_ICONS[entry.entity_type || ""] || ClipboardList;
              const colorClass = ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground";

              return (
                <div key={entry.id} className="relative flex gap-3 pr-0">
                  {/* Timeline dot */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 z-10 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <Card className="flex-1">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-semibold text-foreground">
                              {entry.user_name || "مستخدم النظام"}
                            </span>
                            {entry.user_role && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {ROLE_LABELS[entry.user_role] || entry.user_role}
                              </Badge>
                            )}
                            <Badge className={`text-[9px] px-1.5 py-0 ${colorClass} border-0`}>
                              {ACTION_LABELS[entry.action] || entry.action}
                            </Badge>
                            {entry.entity_type && (
                              <span className="text-[10px] text-muted-foreground">
                                {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                              </span>
                            )}
                          </div>

                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                          )}

                          {renderChanges(entry)}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                          <Clock className="w-3 h-3" />
                          {format(new Date(entry.created_at), "yyyy/MM/dd HH:mm", { locale: ar })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
