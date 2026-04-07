import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Search,
  Shield,
  ShieldCheck,
  Users,
  AlertTriangle,
  X,
  Send,
  MessageSquare,
  Loader2,
  User,
  Bot,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const STATUS_NEW = ["draft", "ai_review", "submitted", "client_submitted", "under_ai_review", "awaiting_client_info", "needs_clarification"];
const STATUS_PROGRESS = ["under_pricing", "quotation_sent", "quotation_approved", "awaiting_payment", "payment_uploaded", "payment_under_review", "partially_paid", "fully_paid", "in_production", "inspection_required", "inspection_assigned", "inspection_in_progress", "inspection_submitted", "valuation_in_progress", "draft_report_ready", "draft_report_sent", "under_client_review", "client_comments", "revision_in_progress", "priced", "awaiting_payment_initial", "payment_received_initial"];
const STATUS_APPROVAL = ["final_payment_pending", "final_payment_uploaded", "final_payment_approved", "final_report_ready", "awaiting_final_payment", "final_payment_received"];
const STATUS_COMPLETE = ["completed", "report_issued", "closed", "archived"];
const STATUS_BLOCKED = ["cancelled", "quotation_rejected"];

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  ai_review: "مراجعة ذكية",
  submitted: "مقدم",
  client_submitted: "مقدم من العميل",
  under_ai_review: "مراجعة ذكية",
  awaiting_client_info: "بانتظار معلومات",
  needs_clarification: "يحتاج توضيح",
  under_pricing: "قيد التسعير",
  priced: "تم التسعير",
  quotation_sent: "عرض مرسل",
  quotation_approved: "عرض مقبول",
  quotation_rejected: "عرض مرفوض",
  awaiting_payment: "بانتظار الدفع",
  awaiting_payment_initial: "بانتظار الدفع",
  payment_uploaded: "إيصال مرفوع",
  payment_under_review: "مراجعة الدفع",
  payment_received_initial: "دفعة أولى مستلمة",
  partially_paid: "مدفوع جزئياً",
  fully_paid: "مدفوع بالكامل",
  in_production: "قيد التنفيذ",
  inspection_required: "تحتاج معاينة",
  inspection_assigned: "معاينة مسندة",
  inspection_in_progress: "معاينة جارية",
  inspection_submitted: "معاينة مقدمة",
  valuation_in_progress: "تقييم جاري",
  draft_report_ready: "مسودة جاهزة",
  draft_report_sent: "مسودة مرسلة",
  under_client_review: "مراجعة العميل",
  client_comments: "ملاحظات العميل",
  revision_in_progress: "تعديل جاري",
  final_payment_pending: "بانتظار الدفعة النهائية",
  final_payment_uploaded: "إيصال نهائي مرفوع",
  final_payment_approved: "دفعة نهائية معتمدة",
  final_report_ready: "التقرير النهائي جاهز",
  awaiting_final_payment: "بانتظار الدفعة النهائية",
  final_payment_received: "دفعة نهائية مستلمة",
  report_issued: "تم الإصدار",
  completed: "مكتمل",
  closed: "مغلق",
  archived: "مؤرشف",
  cancelled: "ملغي",
};

const purposeLabels: Record<string, string> = {
  sale_purchase: "بيع / شراء",
  mortgage: "تمويل / رهن",
  financial_reporting: "تقارير مالية",
  insurance: "تأمين",
  taxation: "زكاة / ضريبة",
  expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء",
  investment: "استثمار",
  lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي",
  regulatory: "تنظيمي",
  other: "أخرى",
};

const assetTypeLabels: Record<string, string> = {
  real_estate: "عقار",
  land: "أرض",
  apartment: "شقة",
  villa: "فيلا",
  commercial: "تجاري",
  industrial: "صناعي",
  equipment: "معدات",
  machinery: "آلات ومعدات",
  business: "منشأة تجارية",
  vehicle: "مركبة",
  residential_land: "أرض سكنية",
  commercial_land: "أرض تجارية",
  building: "مبنى",
};

type DashboardTab = "overview" | "requests" | "operations" | "clients" | "analytics" | "audit";
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

const getClientName = (req: any) => req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "عميل غير محدد";
const getClientPhone = (req: any) => req.client_phone || req.ai_intake_summary?.clientInfo?.contactPhone || "";
const getClientEmail = (req: any) => req.client_email || req.ai_intake_summary?.clientInfo?.contactEmail || "";
const getPurpose = (req: any) => purposeLabels[req.purpose] || req.purpose_ar || req.purpose_other || req.purpose || "غير محدد";
const getAssetType = (req: any) => assetTypeLabels[req.property_type] || assetTypeLabels[req.valuation_type] || req.property_type || req.valuation_type || "غير محدد";
const getStatus = (req: any) => statusLabels[req.status] || "غير محدد";
const getRequestNotes = (req: any) => req.notes || req.property_description_ar || req.asset_data?.description || req.ai_intake_summary?.description || "لا توجد ملاحظات";
const getMode = (req: any) => req.valuation_mode === "desktop" ? "مكتبي" : req.valuation_mode === "field" ? "ميداني" : "غير محدد";

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (STATUS_COMPLETE.includes(status)) return "default";
  if (STATUS_APPROVAL.includes(status)) return "secondary";
  if (STATUS_BLOCKED.includes(status)) return "destructive";
  return "outline";
};

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [statusGroupFilter, setStatusGroupFilter] = useState<StatusGroupFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      const [{ data: profile }, { data: requestRows }] = await Promise.all([
        supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("valuation_requests" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      setProfileName(profile?.full_name_ar || "");
      setRequests((requestRows as any[]) || []);
      setLoading(false);
    };

    loadDashboard();
  }, [user]);

  const counts = useMemo(() => ({
    total: requests.length,
    new: requests.filter((req) => STATUS_NEW.includes(req.status)).length,
    progress: requests.filter((req) => STATUS_PROGRESS.includes(req.status)).length,
    approval: requests.filter((req) => STATUS_APPROVAL.includes(req.status)).length,
    complete: requests.filter((req) => STATUS_COMPLETE.includes(req.status)).length,
    blocked: requests.filter((req) => STATUS_BLOCKED.includes(req.status)).length,
  }), [requests]);

  const metrics = [
    { label: "إجمالي الطلبات", value: counts.total, group: "all" as const, icon: FileText },
    { label: "طلبات جديدة", value: counts.new, group: "new" as const, icon: ClipboardCheck },
    { label: "قيد التنفيذ", value: counts.progress, group: "progress" as const, icon: Clock },
    { label: "بانتظار الاعتماد", value: counts.approval, group: "approval" as const, icon: ShieldCheck },
    { label: "مكتملة", value: counts.complete, group: "complete" as const, icon: CheckCircle2 },
    { label: "متوقفة", value: counts.blocked, group: "blocked" as const, icon: AlertTriangle },
  ];

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const clientName = getClientName(req);
      const matchesSearch = !searchTerm.trim() || clientName.includes(searchTerm) || String(req.id).includes(searchTerm);
      const matchesGroup = matchesStatusGroup(req.status, statusGroupFilter);
      const matchesStatus = statusFilter === "all" || req.status === statusFilter;
      const matchesType = typeFilter === "all" || req.valuation_mode === typeFilter;
      return matchesSearch && matchesGroup && matchesStatus && matchesType;
    });
  }, [requests, searchTerm, statusGroupFilter, statusFilter, typeFilter]);

  const operationsRequests = useMemo(() => requests.filter((req) => !STATUS_NEW.includes(req.status)), [requests]);

  const derivedClients = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; email: string; count: number; latestRequestDate: string }>();
    for (const req of requests) {
      const key = `${getClientName(req)}__${getClientPhone(req)}`;
      if (map.has(key)) {
        map.get(key)!.count += 1;
      } else {
        map.set(key, {
          name: getClientName(req),
          phone: getClientPhone(req),
          email: getClientEmail(req),
          count: 1,
          latestRequestDate: req.created_at,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => new Date(b.latestRequestDate).getTime() - new Date(a.latestRequestDate).getTime());
  }, [requests]);

  const analyticsData = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    const byAssetType: Record<string, number> = {};

    for (const req of requests) {
      const status = getStatus(req);
      const purpose = getPurpose(req);
      const assetType = getAssetType(req);

      byStatus[status] = (byStatus[status] || 0) + 1;
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1;
      byAssetType[assetType] = (byAssetType[assetType] || 0) + 1;
    }

    return { byStatus, byPurpose, byAssetType };
  }, [requests]);

  const auditEntries = useMemo(() => {
    return requests.slice(0, 50).map((req) => ({
      id: req.id,
      title: `تحديث طلب ${getStatus(req)}`,
      clientName: getClientName(req),
      requestDate: new Date(req.created_at).toLocaleDateString("ar-SA"),
      requestTime: new Date(req.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      status: req.status,
    }));
  }, [requests]);

  const handleMetricClick = (group: StatusGroupFilter) => {
    setActiveTab("requests");
    setStatusGroupFilter(group);
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
  };

  const openRequestDetails = (request: any) => {
    setSelectedRequest(request);
  };

  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <TopBar />
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <TopBar />
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">لوحة المالك</h1>
          <p className="text-sm text-muted-foreground">مرحباً {profileName || "المالك"} — عرض تنفيذي موحد من الطلبات فقط</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const isActive = activeTab === "requests" && statusGroupFilter === metric.group;
            return (
              <button key={metric.label} type="button" onClick={() => handleMetricClick(metric.group)} className="text-right">
                <Card className={`h-full transition-all ${isActive ? "border-primary" : "border-border hover:border-primary/40"}`}>
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-muted p-2 text-foreground"><Icon className="h-4 w-4" /></span>
                      <span className="text-2xl font-bold text-foreground">{metric.value}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{metric.label}</p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} dir="rtl" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap gap-1 rounded-xl bg-muted/50 p-1.5">
            <TabsTrigger value="overview" className="px-3 py-2 text-sm">نظرة عامة</TabsTrigger>
            <TabsTrigger value="requests" className="px-3 py-2 text-sm">الطلبات</TabsTrigger>
            <TabsTrigger value="operations" className="px-3 py-2 text-sm">العمليات</TabsTrigger>
            <TabsTrigger value="clients" className="px-3 py-2 text-sm">العملاء</TabsTrigger>
            <TabsTrigger value="analytics" className="px-3 py-2 text-sm">التحليلات</TabsTrigger>
            <TabsTrigger value="audit" className="px-3 py-2 text-sm">سجل المراجعة</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ملخص الطلبات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">إجمالي الطلبات</p><p className="mt-1 text-xl font-bold text-foreground">{counts.total}</p></div>
                    <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">العملاء</p><p className="mt-1 text-xl font-bold text-foreground">{derivedClients.length}</p></div>
                    <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">العمليات الجارية</p><p className="mt-1 text-xl font-bold text-foreground">{operationsRequests.length}</p></div>
                  </div>

                  <div className="space-y-2">
                    {requests.slice(0, 5).map((req) => (
                      <button key={req.id} type="button" onClick={() => openRequestDetails(req)} className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-right transition-colors hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{getClientName(req)}</p>
                          <p className="text-xs text-muted-foreground">{getPurpose(req)} · {new Date(req.created_at).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <Badge variant={statusBadgeVariant(req.status)} className="text-[10px]">{getStatus(req)}</Badge>
                      </button>
                    ))}
                    {requests.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات حالياً</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">نقاط المتابعة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <span className="text-muted-foreground">طلبات جديدة</span>
                    <span className="font-semibold text-foreground">{counts.new}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <span className="text-muted-foreground">بانتظار الاعتماد</span>
                    <span className="font-semibold text-foreground">{counts.approval}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <span className="text-muted-foreground">طلبات متوقفة</span>
                    <span className="font-semibold text-foreground">{counts.blocked}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="بحث باسم العميل أو رقم الطلب" className="pr-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {Array.from(new Set(requests.map((req) => req.status).filter(Boolean))).map((status) => (
                    <SelectItem key={status} value={status}>{statusLabels[status] || status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="نوع المعاينة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="desktop">مكتبي</SelectItem>
                  <SelectItem value="field">ميداني</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الغرض</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع الأصل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">التاريخ</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد طلبات مطابقة</td></tr>
                      ) : filteredRequests.map((req) => (
                        <tr key={req.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium text-foreground">{getClientName(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getPurpose(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getAssetType(req)}</td>
                          <td className="px-4 py-3"><Badge variant={statusBadgeVariant(req.status)} className="text-[10px]">{getStatus(req)}</Badge></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("ar-SA")}</td>
                          <td className="px-4 py-3">
                            <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => openRequestDetails(req)}>
                              <Eye className="h-4 w-4" />
                              عرض
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

          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">العمليات المشتقة من الطلبات</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">العميل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">نوع الأصل</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">نمط التنفيذ</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationsRequests.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">لا توجد عمليات حالياً</td></tr>
                      ) : operationsRequests.map((req) => (
                        <tr key={req.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium text-foreground">{getClientName(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getAssetType(req)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getMode(req)}</td>
                          <td className="px-4 py-3"><Badge variant={statusBadgeVariant(req.status)} className="text-[10px]">{getStatus(req)}</Badge></td>
                          <td className="px-4 py-3">
                            <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => openRequestDetails(req)}>
                              <Eye className="h-4 w-4" />
                              عرض
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

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">العملاء المستخرجون من الطلبات</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاسم</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">الجوال</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">البريد</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">عدد الطلبات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derivedClients.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">لا يوجد عملاء</td></tr>
                      ) : derivedClients.map((client, index) => (
                        <tr key={`${client.name}-${index}`} className="border-b border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground" dir="ltr">{client.phone || "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{client.email || "—"}</td>
                          <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{client.count}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-base">حسب الحالة</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.byStatus).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">حسب الغرض</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.byPurpose).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">حسب نوع الأصل</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analyticsData.byAssetType).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">سجل نشاط الطلبات</CardTitle>
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
                      ) : auditEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="px-4 py-3 text-foreground">{entry.title}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{entry.clientName}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.requestDate}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.requestTime}</td>
                          <td className="px-4 py-3"><Badge variant={statusBadgeVariant(entry.status)} className="text-[10px]">{statusLabels[entry.status] || entry.status}</Badge></td>
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

      <Drawer open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DrawerContent className="max-h-[85vh]" dir="rtl">
          <DrawerHeader className="border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 text-right">
                <DrawerTitle>تفاصيل الطلب</DrawerTitle>
                <DrawerDescription>عرض داخلي آمن بدون انتقالات خارجية</DrawerDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          {selectedRequest && (
            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">اسم العميل</p><p className="mt-1 text-sm font-semibold text-foreground">{getClientName(selectedRequest)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">الغرض</p><p className="mt-1 text-sm font-semibold text-foreground">{getPurpose(selectedRequest)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">نوع الأصل</p><p className="mt-1 text-sm font-semibold text-foreground">{getAssetType(selectedRequest)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">الحالة</p><div className="mt-1"><Badge variant={statusBadgeVariant(selectedRequest.status)}>{getStatus(selectedRequest)}</Badge></div></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">تاريخ الطلب</p><p className="mt-1 text-sm font-semibold text-foreground">{new Date(selectedRequest.created_at).toLocaleDateString("ar-SA")}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">رقم الجوال</p><p className="mt-1 text-sm font-semibold text-foreground" dir="ltr">{getClientPhone(selectedRequest) || "—"}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الملاحظات</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-foreground">{getRequestNotes(selectedRequest)}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}