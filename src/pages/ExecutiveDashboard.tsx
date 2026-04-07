import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Eye,
  RotateCcw, FileOutput, ThumbsUp, XCircle, AlertCircle,
  Users, MapPin, BarChart3, Shield, Search, Filter,
  ClipboardCheck, FolderOpen,
} from "lucide-react";

/* ── Status helpers ── */
const STATUS_NEW = ["draft", "submitted"];
const STATUS_PROGRESS = ["processing", "inspection", "valuation_ready", "under_review"];
const STATUS_APPROVAL = ["under_review"];
const STATUS_COMPLETE = ["approved", "issued"];
const STATUS_BLOCKED = ["rejected", "on_hold", "cancelled"];

const statusLabel: Record<string, string> = {
  draft: "مسودة", submitted: "مقدم", processing: "قيد المعالجة",
  inspection: "معاينة", valuation_ready: "جاهز للتقييم", under_review: "تحت المراجعة",
  approved: "معتمد", issued: "صادر", rejected: "مرفوض",
  on_hold: "معلق", cancelled: "ملغى",
};

const requestStatusLabel: Record<string, string> = {
  submitted: "جديد", pending_review: "قيد المراجعة", processing: "قيد المعالجة",
  completed: "مكتمل", cancelled: "ملغى", draft: "مسودة",
  final_report_ready: "التقرير جاهز",
};

const purposeLabel: Record<string, string> = {
  sale_purchase: "بيع / شراء", mortgage: "تمويل / رهن", financial_reporting: "تقارير مالية",
  insurance: "تأمين", taxation: "زكاة / ضريبة", expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء", investment: "استثمار", lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي", regulatory: "تنظيمي", other: "أخرى",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (STATUS_COMPLETE.includes(s)) return "default";
  if (STATUS_BLOCKED.includes(s)) return "destructive";
  if (STATUS_APPROVAL.includes(s)) return "secondary";
  return "outline";
};

const assetTypeLabel: Record<string, string> = {
  real_estate: "عقار", land: "أرض", apartment: "شقة", villa: "فيلا",
  commercial: "تجاري", industrial: "صناعي", equipment: "آلات ومعدات", vehicle: "مركبة",
};

/* ── Lazy-loaded tab content ── */
import AnalyticsDashboardPage from "@/pages/AnalyticsDashboardPage";
import AuditLogPage from "@/pages/AuditLogPage";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [clientRequests, setClientRequests] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: aData }, { data: pData }, { data: reqData }, { data: cData }] = await Promise.all([
        supabase.from("valuation_assignments").select("id, reference_number, status, property_type, confidence_score, final_value_approved, created_at, client_id, clients(name_ar)").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle(),
        supabase.from("valuation_requests" as any).select("*, clients:client_id(id, name_ar, phone, email)").order("created_at", { ascending: false }).limit(100),
        supabase.from("clients").select("id, name_ar, email, phone, client_type, client_status, city_ar, created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (pData) setProfileName(pData.full_name_ar || "");
      setAssignments((aData || []).map((a: any) => ({ ...a, client: a.clients || null })));
      setClientRequests((reqData as any[]) || []);
      setClients(cData || []);
      setLoading(false);
    };
    load();
  }, [user]);

  /* ── KPI counts ── */
  const newCount = clientRequests.filter(r => ["submitted"].includes(r.status)).length;
  const progressCount = assignments.filter(a => STATUS_PROGRESS.includes(a.status)).length;
  const approvalCount = assignments.filter(a => STATUS_APPROVAL.includes(a.status)).length;
  const completedCount = assignments.filter(a => STATUS_COMPLETE.includes(a.status)).length;
  const blockedCount = assignments.filter(a => STATUS_BLOCKED.includes(a.status)).length;

  const metrics = [
    { label: "طلبات جديدة", value: newCount, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "قيد التنفيذ", value: progressCount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "بانتظار الاعتماد", value: approvalCount, icon: ShieldCheck, color: "text-info", bg: "bg-info/10" },
    { label: "مكتملة", value: completedCount, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "متوقفة", value: blockedCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  /* ── Filtered requests ── */
  const filteredRequests = useMemo(() => {
    return clientRequests.filter(req => {
      const clientObj = req.clients;
      const name = clientObj?.name_ar || req.client_name_ar || "";
      if (searchTerm && !name.includes(searchTerm) && !req.id.includes(searchTerm)) return false;
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (typeFilter !== "all") {
        const mode = req.valuation_mode || req.ai_intake_summary?.valuation_mode || "";
        if (typeFilter !== mode) return false;
      }
      return true;
    });
  }, [clientRequests, searchTerm, statusFilter, typeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-foreground">مرحباً، {profileName || "المالك"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">مركز التحكم الرئيسي</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metrics.map(m => {
            const Icon = m.icon;
            return (
              <Card key={m.label} className="shadow-sm">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${m.color}`} />
                  </div>
                  <span className="text-2xl font-bold text-foreground">{m.value}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="requests" dir="rtl" className="space-y-4">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
            <TabsTrigger value="requests" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">الطلبات</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">العمليات</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">العملاء</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">التحليلات</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">سجل المراجعة</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Requests Tab ── */}
          <TabsContent value="requests" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pr-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] text-sm">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="submitted">جديد</SelectItem>
                  <SelectItem value="processing">قيد المعالجة</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغى</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] text-sm">
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="desktop">مكتبي</SelectItem>
                  <SelectItem value="field">ميداني</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Requests Table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الغرض</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">النوع</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">التاريخ</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد طلبات</td></tr>
                      ) : filteredRequests.map((req: any) => (
                        <tr
                          key={req.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate("/client-requests", { state: { selectedRequestId: req.id } })}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {req.clients?.name_ar || req.client_name_ar || "طلب جديد"}
                          </td>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {purposeLabel[req.purpose] || req.purpose || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {req.ai_intake_summary?.valuation_mode === "desktop" ? "مكتبي" : "ميداني"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {requestStatusLabel[req.status] || req.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(req.created_at).toLocaleDateString("ar-SA")}
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض التفاصيل"
                              onClick={e => { e.stopPropagation(); navigate("/client-requests", { state: { selectedRequestId: req.id } }); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Operations Tab ── */}
          <TabsContent value="operations" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">المعاينات والتقييمات والتقارير</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">رقم الطلب</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع الأصل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الثقة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">القرار</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">لا توجد عمليات حالياً</td></tr>
                      ) : assignments.slice(0, 30).map(a => (
                        <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/assignment/${a.id}`)}>
                          <td className="px-4 py-3 font-medium text-foreground">{a.reference_number}</td>
                          <td className="px-4 py-3 text-foreground">{a.client?.name_ar || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{assetTypeLabel[a.property_type || ""] || a.property_type || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(a.status)} className="text-[11px]">
                              {statusLabel[a.status] || a.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {a.confidence_score !== null ? (
                              <span className={`font-semibold text-xs ${a.confidence_score >= 75 ? "text-success" : a.confidence_score >= 60 ? "text-warning" : "text-destructive"}`}>
                                {a.confidence_score}%
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {a.final_value_approved ? (
                              <Badge variant="default" className="text-[10px] bg-success text-success-foreground">معتمد</Badge>
                            ) : STATUS_APPROVAL.includes(a.status) ? (
                              <Badge variant="secondary" className="text-[10px]">بانتظار</Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض"
                                onClick={e => { e.stopPropagation(); navigate(`/assignment/${a.id}`); }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Clients Tab ── */}
          <TabsContent value="clients" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    العملاء ({clients.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigate("/clients-management")}>
                    إدارة العملاء
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاسم</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">البريد</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الهاتف</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">المدينة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">النوع</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا يوجد عملاء</td></tr>
                      ) : clients.slice(0, 30).map(c => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/clients/${c.id}`)}>
                          <td className="px-4 py-3 font-medium text-foreground">{c.name_ar}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs" dir="ltr">{c.phone || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.city_ar || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {c.client_type === "individual" ? "فرد" : c.client_type === "corporate" ? "شركة" : c.client_type === "government" ? "حكومي" : c.client_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={c.client_status === "active" ? "default" : "secondary"} className="text-[10px]">
                              {c.client_status === "active" ? "نشط" : c.client_status === "inactive" ? "غير نشط" : c.client_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Analytics Tab ── */}
          <TabsContent value="analytics">
            <AnalyticsDashboardPage />
          </TabsContent>

          {/* ── Audit Log Tab ── */}
          <TabsContent value="audit">
            <AuditLogPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
