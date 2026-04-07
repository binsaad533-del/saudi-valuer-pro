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
  Users, BarChart3, Shield, Search,
  ClipboardCheck, FolderOpen, Calendar,
} from "lucide-react";

/* ── Status grouping ── */
const STATUS_NEW = ["draft", "ai_review", "submitted", "client_submitted", "under_ai_review", "awaiting_client_info", "needs_clarification"];
const STATUS_PROGRESS = ["under_pricing", "quotation_sent", "quotation_approved", "awaiting_payment", "payment_uploaded", "payment_under_review", "partially_paid", "fully_paid", "in_production", "inspection_required", "inspection_assigned", "inspection_in_progress", "inspection_submitted", "valuation_in_progress", "draft_report_ready", "draft_report_sent", "under_client_review", "client_comments", "revision_in_progress", "priced", "awaiting_payment_initial", "payment_received_initial"];
const STATUS_APPROVAL = ["final_payment_pending", "final_payment_uploaded", "final_payment_approved", "final_report_ready", "awaiting_final_payment", "final_payment_received"];
const STATUS_COMPLETE = ["completed", "report_issued", "closed", "archived"];
const STATUS_BLOCKED = ["cancelled", "quotation_rejected"];

const allStatusLabel: Record<string, string> = {
  draft: "مسودة", ai_review: "مراجعة ذكية", submitted: "مقدم", client_submitted: "مقدم من العميل",
  under_ai_review: "مراجعة ذكية", awaiting_client_info: "بانتظار معلومات", needs_clarification: "يحتاج توضيح",
  under_pricing: "قيد التسعير", priced: "تم التسعير", quotation_sent: "عرض مرسل",
  quotation_approved: "عرض مقبول", quotation_rejected: "عرض مرفوض",
  awaiting_payment: "بانتظار الدفع", awaiting_payment_initial: "بانتظار الدفع",
  payment_uploaded: "إيصال مرفوع", payment_under_review: "مراجعة الدفع",
  payment_received_initial: "دفعة أولى مستلمة",
  partially_paid: "مدفوع جزئياً", fully_paid: "مدفوع بالكامل",
  in_production: "قيد الإنتاج",
  inspection_required: "تحتاج معاينة", inspection_assigned: "معاينة مسندة",
  inspection_in_progress: "معاينة جارية", inspection_submitted: "معاينة مقدمة",
  valuation_in_progress: "تقييم جاري", draft_report_ready: "مسودة التقرير جاهزة",
  draft_report_sent: "مسودة مرسلة", under_client_review: "مراجعة العميل",
  client_comments: "ملاحظات العميل", revision_in_progress: "تعديل جاري",
  final_payment_pending: "بانتظار الدفعة النهائية", final_payment_uploaded: "إيصال نهائي مرفوع",
  final_payment_approved: "دفعة نهائية معتمدة", final_report_ready: "التقرير النهائي جاهز",
  awaiting_final_payment: "بانتظار الدفعة النهائية", final_payment_received: "دفعة نهائية مستلمة",
  report_issued: "صادر", completed: "مكتمل", closed: "مغلق", archived: "مؤرشف",
  cancelled: "ملغى",
};

const purposeLabel: Record<string, string> = {
  sale_purchase: "بيع / شراء", mortgage: "تمويل / رهن", financial_reporting: "تقارير مالية",
  insurance: "تأمين", taxation: "زكاة / ضريبة", expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء", investment: "استثمار", lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي", regulatory: "تنظيمي", other: "أخرى",
};

const propertyTypeLabel: Record<string, string> = {
  real_estate: "عقار", land: "أرض", apartment: "شقة", villa: "فيلا",
  commercial: "تجاري", industrial: "صناعي", equipment: "آلات ومعدات", vehicle: "مركبة",
  residential_land: "أرض سكنية", commercial_land: "أرض تجارية", building: "مبنى",
};

const statusBadgeVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (STATUS_COMPLETE.includes(s)) return "default";
  if (STATUS_BLOCKED.includes(s)) return "destructive";
  if (STATUS_APPROVAL.includes(s)) return "secondary";
  return "outline";
};

type DashboardTab = "requests" | "operations" | "clients" | "analytics" | "audit";
type StatusGroupFilter = "all" | "new" | "progress" | "approval" | "complete" | "blocked";

const matchesStatusGroup = (status: string, group: StatusGroupFilter) => {
  if (group === "all") return true;
  if (group === "new") return STATUS_NEW.includes(status);
  if (group === "progress") return STATUS_PROGRESS.includes(status);
  if (group === "approval") return STATUS_APPROVAL.includes(status);
  if (group === "complete") return STATUS_COMPLETE.includes(status);
  if (group === "blocked") return STATUS_BLOCKED.includes(status);
  return true;
};

/* ── Helper: extract client name from a request ── */
const getClientName = (req: any): string =>
  req.clients?.name_ar || req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "عميل";

const getClientPhone = (req: any): string =>
  req.clients?.phone || req.client_phone || "";

const getClientEmail = (req: any): string =>
  req.clients?.email || req.client_email || "";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("requests");
  const [statusGroupFilter, setStatusGroupFilter] = useState<StatusGroupFilter>("all");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: pData }, { data: reqData }] = await Promise.all([
        supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle(),
        supabase.from("valuation_requests" as any).select("*, clients:client_id(id, name_ar, phone, email)").order("created_at", { ascending: false }).limit(500),
      ]);
      if (pData) setProfileName(pData.full_name_ar || "");
      setRequests((reqData as any[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  /* ── KPI counts (all from requests) ── */
  const newCount = requests.filter(r => STATUS_NEW.includes(r.status)).length;
  const progressCount = requests.filter(r => STATUS_PROGRESS.includes(r.status)).length;
  const approvalCount = requests.filter(r => STATUS_APPROVAL.includes(r.status)).length;
  const completedCount = requests.filter(r => STATUS_COMPLETE.includes(r.status)).length;
  const blockedCount = requests.filter(r => STATUS_BLOCKED.includes(r.status)).length;

  const metrics = [
    { label: "طلبات جديدة", value: newCount, icon: FileText, color: "text-primary", bg: "bg-primary/10", group: "new" as const },
    { label: "قيد التنفيذ", value: progressCount, icon: Clock, color: "text-warning", bg: "bg-warning/10", group: "progress" as const },
    { label: "بانتظار الاعتماد", value: approvalCount, icon: ShieldCheck, color: "text-info", bg: "bg-info/10", group: "approval" as const },
    { label: "مكتملة", value: completedCount, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", group: "complete" as const },
    { label: "متوقفة", value: blockedCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", group: "blocked" as const },
  ];

  const handleMetricClick = (group: StatusGroupFilter) => {
    setActiveTab("requests");
    setStatusGroupFilter(group);
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
  };

  /* ── Filtered requests ── */
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const name = getClientName(req);
      if (searchTerm && !name.includes(searchTerm) && !req.id.includes(searchTerm)) return false;
      if (!matchesStatusGroup(req.status, statusGroupFilter)) return false;
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (typeFilter !== "all") {
        const mode = req.valuation_mode || "";
        if (typeFilter !== mode) return false;
      }
      return true;
    });
  }, [requests, searchTerm, statusFilter, statusGroupFilter, typeFilter]);

  /* ── Derive unique clients from requests ── */
  const derivedClients = useMemo(() => {
    const clientMap = new Map<string, { name: string; phone: string; email: string; count: number; clientId?: string }>();
    for (const req of requests) {
      const name = getClientName(req);
      const key = req.client_id || name; // group by client_id first, then name
      if (clientMap.has(key)) {
        clientMap.get(key)!.count++;
      } else {
        clientMap.set(key, {
          name,
          phone: getClientPhone(req),
          email: getClientEmail(req),
          count: 1,
          clientId: req.client_id,
        });
      }
    }
    return Array.from(clientMap.entries()).map(([key, val]) => ({ key, ...val }));
  }, [requests]);

  /* ── Operations: requests past the intake phase ── */
  const operationsRequests = useMemo(() => {
    return requests.filter(r => !STATUS_NEW.includes(r.status));
  }, [requests]);

  /* ── Analytics from requests ── */
  const analyticsData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const purposeCounts: Record<string, number> = {};
    const monthlyCounts: Record<string, number> = {};

    for (const req of requests) {
      // Status
      const sl = allStatusLabel[req.status] || req.status;
      statusCounts[sl] = (statusCounts[sl] || 0) + 1;

      // Purpose
      const pl = purposeLabel[req.purpose] || req.purpose || "غير محدد";
      purposeCounts[pl] = (purposeCounts[pl] || 0) + 1;

      // Monthly
      const month = new Date(req.created_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short" });
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    }

    return { statusCounts, purposeCounts, monthlyCounts };
  }, [requests]);

  /* ── Audit log derived from requests ── */
  const auditEntries = useMemo(() => {
    return requests.slice(0, 50).map(req => ({
      id: req.id,
      action: `طلب تقييم - ${allStatusLabel[req.status] || req.status}`,
      client: getClientName(req),
      date: new Date(req.created_at).toLocaleDateString("ar-SA"),
      time: new Date(req.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      status: req.status,
    }));
  }, [requests]);

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
              <button
                key={m.label}
                type="button"
                onClick={() => handleMetricClick(m.group)}
                className="text-right"
              >
                <Card className={`shadow-sm transition-all hover:border-primary/40 hover:shadow-md ${statusGroupFilter === m.group && activeTab === "requests" ? "border-primary" : "border-border"}`}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${m.color}`} />
                    </div>
                    <span className="text-2xl font-bold text-foreground">{m.value}</span>
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} dir="rtl" className="space-y-4">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
            <TabsTrigger value="requests" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">الطلبات ({requests.length})</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">العمليات ({operationsRequests.length})</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">العملاء ({derivedClients.length})</span>
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-9 text-sm" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] text-sm"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="submitted">جديد</SelectItem>
                  <SelectItem value="under_pricing">قيد التسعير</SelectItem>
                  <SelectItem value="quotation_sent">عرض مرسل</SelectItem>
                  <SelectItem value="in_production">قيد الإنتاج</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغى</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] text-sm"><SelectValue placeholder="النوع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="desktop">مكتبي</SelectItem>
                  <SelectItem value="field">ميداني</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                        <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate("/client-requests", { state: { selectedRequestId: req.id } })}>
                          <td className="px-4 py-3 font-medium text-foreground">{getClientName(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{purposeLabel[req.purpose] || req.purpose || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {req.valuation_mode === "desktop" ? "مكتبي" : "ميداني"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusBadgeVariant(req.status)} className="text-[10px]">
                              {allStatusLabel[req.status] || req.status}
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
                <CardTitle className="text-base font-semibold">العمليات الجارية</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع العقار</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">المدينة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">التاريخ</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationsRequests.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد عمليات حالياً</td></tr>
                      ) : operationsRequests.map(req => (
                        <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate("/client-requests", { state: { selectedRequestId: req.id } })}>
                          <td className="px-4 py-3 font-medium text-foreground">{getClientName(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{propertyTypeLabel[req.property_type || ""] || req.property_type || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{req.property_city_ar || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusBadgeVariant(req.status)} className="text-[10px]">
                              {allStatusLabel[req.status] || req.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(req.created_at).toLocaleDateString("ar-SA")}
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض"
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

          {/* ── Clients Tab (derived from requests) ── */}
          <TabsContent value="clients" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  العملاء ({derivedClients.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاسم</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الهاتف</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">البريد</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">عدد الطلبات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derivedClients.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">لا يوجد عملاء</td></tr>
                      ) : derivedClients.map(c => (
                        <tr key={c.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => c.clientId ? navigate(`/clients/${c.clientId}`) : null}>
                          <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs" dir="ltr">{c.phone || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">{c.count}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Analytics Tab (derived from requests) ── */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status breakdown */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">توزيع الحالات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.statusCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(analyticsData.statusCounts).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              {/* Purpose breakdown */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">أغراض التقييم</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.purposeCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(analyticsData.purposeCounts).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              {/* Monthly breakdown */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">الطلبات الشهرية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.monthlyCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(analyticsData.monthlyCounts).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary row */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{requests.length}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{derivedClients.length}</p>
                    <p className="text-xs text-muted-foreground">عدد العملاء</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{completedCount}</p>
                    <p className="text-xs text-muted-foreground">مكتملة</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{progressCount}</p>
                    <p className="text-xs text-muted-foreground">قيد التنفيذ</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Audit Log Tab (derived from requests) ── */}
          <TabsContent value="audit" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  سجل النشاطات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">النشاط</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">التاريخ</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الوقت</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEntries.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">لا توجد نشاطات</td></tr>
                      ) : auditEntries.map(entry => (
                        <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-foreground">{entry.action}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{entry.client}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{entry.date}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{entry.time}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusBadgeVariant(entry.status)} className="text-[10px]">
                              {allStatusLabel[entry.status] || entry.status}
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
        </Tabs>
      </div>
    </div>
  );
}
