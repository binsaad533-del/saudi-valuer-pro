import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import ReportDraftGenerator from "@/components/reports/ReportDraftGenerator";
import FinalIssuancePanel from "@/components/reports/FinalIssuancePanel";
import SOWGenerator from "@/components/reports/SOWGenerator";
import ProfessionalJudgmentPanel from "@/components/valuation/ProfessionalJudgmentPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import BidiText from "@/components/ui/bidi-text";
import KanbanBoard from "@/components/dashboard/KanbanBoard";
import WorkflowPipeline from "@/components/dashboard/WorkflowPipeline";
import LiveActivityTimeline from "@/components/dashboard/LiveActivityTimeline";
import SmartAlertsBanner from "@/components/dashboard/SmartAlertsBanner";
import {
  CheckCircle2, ClipboardCheck, Clock, Eye, FileText,
  Search, ShieldCheck, AlertTriangle, X, Send,
  MessageSquare, Loader2, User, Bot, ArrowLeft, Building2,
  Zap,
} from "lucide-react";

/* ══════════════════════════════════════════════
   Status Groups
   ══════════════════════════════════════════════ */
// ── Unified status groups aligned with RPC's 19 valid statuses ──
const STATUS_NEW = ["draft", "submitted"];
const STATUS_SOW = ["scope_generated", "scope_approved"];
const STATUS_PROGRESS = ["first_payment_confirmed", "data_collection_open", "data_collection_complete", "inspection_pending", "inspection_completed", "data_validated", "analysis_complete", "professional_review", "draft_report_ready", "client_review"];
const STATUS_APPROVAL = ["draft_approved", "final_payment_confirmed"];
const STATUS_COMPLETE = ["issued", "archived"];
const STATUS_BLOCKED = ["cancelled"];

// ── Unified status labels matching RPC's 19 valid statuses + normalizer for legacy ──
import { normalizeStatus, STATUS_LABELS } from "@/lib/workflow-engine";

const statusLabels: Record<string, string> = {
  draft: "مسودة", submitted: "مقدم",
  scope_generated: "نطاق العمل جاهز", scope_approved: "نطاق العمل مُعتمد",
  first_payment_confirmed: "دفعة أولى مؤكدة",
  data_collection_open: "جمع البيانات", data_collection_complete: "البيانات مكتملة",
  inspection_pending: "بانتظار المعاينة", inspection_completed: "المعاينة مكتملة",
  data_validated: "البيانات مُعتمدة",
  analysis_complete: "التحليل مكتمل", professional_review: "المراجعة المهنية",
  draft_report_ready: "مسودة جاهزة", client_review: "مراجعة العميل",
  draft_approved: "المسودة مُعتمدة", final_payment_confirmed: "الدفعة النهائية مؤكدة",
  issued: "صادر", archived: "مؤرشف", cancelled: "ملغي",
};

const purposeLabels: Record<string, string> = {
  sale_purchase: "بيع / شراء", mortgage: "تمويل / رهن", financial_reporting: "تقارير مالية",
  insurance: "تأمين", taxation: "زكاة / ضريبة", expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء", investment: "استثمار", lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي", regulatory: "تنظيمي", other: "أخرى",
};

const assetTypeLabels: Record<string, string> = {
  real_estate: "عقار", land: "أرض", apartment: "شقة", villa: "فيلا", commercial: "تجاري",
  industrial: "صناعي", equipment: "معدات", machinery: "آلات ومعدات", business: "منشأة تجارية",
  vehicle: "مركبة", residential_land: "أرض سكنية", commercial_land: "أرض تجارية", building: "مبنى",
};

type ViewMode = "dashboard" | "workspace";
type StatusGroupFilter = "all" | "new" | "sow" | "progress" | "approval" | "complete" | "blocked";

const getClientName = (req: any) => req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "عميل غير محدد";
const getClientPhone = (req: any) => req.client_phone || req.ai_intake_summary?.clientInfo?.contactPhone || "";
const getClientEmail = (req: any) => req.client_email || req.ai_intake_summary?.clientInfo?.contactEmail || "";
const getPurpose = (req: any) => purposeLabels[req.purpose] || req.purpose_ar || req.purpose_other || req.purpose || "غير محدد";
const getAssetType = (req: any) => assetTypeLabels[req.property_type] || assetTypeLabels[req.valuation_type] || req.property_type || req.valuation_type || "غير محدد";
const getStatus = (req: any) => {
  const normalized = normalizeStatus(req.status);
  return statusLabels[normalized] || STATUS_LABELS[normalized]?.ar || req.status || "غير محدد";
};
const getMode = (req: any) => req.valuation_mode === "desktop" ? "مكتبي" : req.valuation_mode === "field" ? "ميداني" : "—";

const matchesStatusGroup = (status: string, group: StatusGroupFilter) => {
  if (group === "all") return true;
  const n = normalizeStatus(status);
  if (group === "new") return STATUS_NEW.includes(n);
  if (group === "sow") return STATUS_SOW.includes(n);
  if (group === "progress") return STATUS_PROGRESS.includes(n);
  if (group === "approval") return STATUS_APPROVAL.includes(n);
  if (group === "complete") return STATUS_COMPLETE.includes(n);
  if (group === "blocked") return STATUS_BLOCKED.includes(n);
  return true;
};

const statusColor = (status: string) => {
  const n = normalizeStatus(status);
  if (STATUS_COMPLETE.includes(n)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (STATUS_APPROVAL.includes(n)) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (STATUS_BLOCKED.includes(n)) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (STATUS_NEW.includes(n)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  if (STATUS_SOW.includes(n)) return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
  return "bg-muted text-muted-foreground";
};

/* ══════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════ */
export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [statusGroupFilter, setStatusGroupFilter] = useState<StatusGroupFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Workspace state
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [drawerMessages, setDrawerMessages] = useState<any[]>([]);
  const [drawerReply, setDrawerReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Load data ── */
  useEffect(() => {
    if (!user) return;
    const loadDashboard = async () => {
      setLoading(true);
      const [{ data: profile }, { data: requestRows }] = await Promise.all([
        supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle(),
        supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      setProfileName(profile?.full_name_ar || "");
      setRequests((requestRows as any[]) || []);
      setLoading(false);
    };
    loadDashboard();
  }, [user]);

  const refreshRequests = useCallback(async () => {
    const { data } = await supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setRequests(data as any[]);
  }, []);

  /* ── Messages ── */
  useEffect(() => {
    if (!selectedRequest) { setDrawerMessages([]); return; }
    let cancelled = false;
    const loadMsgs = async () => {
      setLoadingMessages(true);
      const { data } = await supabase.from("request_messages" as any).select("*").eq("request_id", selectedRequest.id).order("created_at");
      if (!cancelled) setDrawerMessages(data || []);
      setLoadingMessages(false);
    };
    loadMsgs();
    const channel = supabase.channel(`owner-msg-${selectedRequest.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "request_messages", filter: `request_id=eq.${selectedRequest.id}` },
        (payload) => setDrawerMessages(prev => [...prev, payload.new]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [selectedRequest?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [drawerMessages]);

  const sendOwnerReply = useCallback(async () => {
    if (!drawerReply.trim() || !selectedRequest || !user) return;
    setSendingReply(true);
    try {
      await supabase.from("request_messages" as any).insert({
        request_id: selectedRequest.id, sender_id: user.id, sender_type: "admin" as any, content: drawerReply.trim(),
      });
      setDrawerReply("");
    } catch {}
    setSendingReply(false);
  }, [drawerReply, selectedRequest, user]);

  /* ── Computed ── */
  const counts = useMemo(() => ({
    total: requests.length,
    new: requests.filter(r => STATUS_NEW.includes(r.status)).length,
    sow: requests.filter(r => STATUS_SOW.includes(r.status)).length,
    progress: requests.filter(r => STATUS_PROGRESS.includes(r.status)).length,
    approval: requests.filter(r => STATUS_APPROVAL.includes(r.status)).length,
    complete: requests.filter(r => STATUS_COMPLETE.includes(r.status)).length,
    blocked: requests.filter(r => STATUS_BLOCKED.includes(r.status)).length,
  }), [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const clientName = getClientName(req);
      const matchesSearch = !searchTerm.trim() || clientName.includes(searchTerm) || String(req.id).includes(searchTerm);
      const matchesGroup = matchesStatusGroup(req.status, statusGroupFilter);
      const matchesStatus = statusFilter === "all" || req.status === statusFilter;
      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [requests, searchTerm, statusGroupFilter, statusFilter]);

  const actionItems = useMemo(() => requests.filter(r =>
    ["submitted", "client_submitted", "payment_uploaded", "final_payment_uploaded", "draft_report_ready", "client_comments"].includes(r.status)
  ), [requests]);

  const openWorkspace = (req: any) => {
    setSelectedRequest(req);
    setViewMode("workspace");
  };

  const closeWorkspace = () => {
    setSelectedRequest(null);
    setViewMode("dashboard");
    refreshRequests();
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <TopBar />
        <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     WORKSPACE VIEW — Full-page review for a request
     ══════════════════════════════════════════════ */
  if (viewMode === "workspace" && selectedRequest) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <TopBar />

        {/* Workspace Header */}
        <div className="border-b border-border bg-card sticky top-0 z-20">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Button variant="ghost" size="sm" onClick={closeWorkspace} className="gap-2 shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                  العودة
                </Button>
                <Separator orientation="vertical" className="h-8" />
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-lg font-bold text-foreground truncate">{getClientName(selectedRequest)}</h1>
                    <Badge className={`${statusColor(selectedRequest.status)} border-0 text-xs font-semibold`}>
                      {getStatus(selectedRequest)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{getAssetType(selectedRequest)}</span>
                    <span>•</span>
                    <span>{getPurpose(selectedRequest)}</span>
                    <span>•</span>
                    <span>{getMode(selectedRequest)}</span>
                    <span>•</span>
                    <span>{new Date(selectedRequest.created_at).toLocaleDateString("ar-SA")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

            {/* Main Column: Workflow Panels */}
            <div className="space-y-6 min-w-0">
              {/* SOW */}
              <SOWGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />

              {/* Professional Judgment */}
              <ProfessionalJudgmentPanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />

              {/* Report Draft */}
              <ReportDraftGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />

              {/* Final Issuance */}
              <FinalIssuancePanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
            </div>

            {/* Sidebar: Info + Chat */}
            <div className="space-y-4">
              {/* Request Info Card */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    بيانات الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-muted-foreground">الغرض</p><p className="font-medium text-foreground mt-0.5">{getPurpose(selectedRequest)}</p></div>
                    <div><p className="text-xs text-muted-foreground">نوع الأصل</p><p className="font-medium text-foreground mt-0.5">{getAssetType(selectedRequest)}</p></div>
                    <div><p className="text-xs text-muted-foreground">نمط التقييم</p><p className="font-medium text-foreground mt-0.5">{getMode(selectedRequest)}</p></div>
                    <div><p className="text-xs text-muted-foreground">التاريخ</p><p className="font-medium text-foreground mt-0.5">{new Date(selectedRequest.created_at).toLocaleDateString("ar-SA")}</p></div>
                  </div>
                  {getClientPhone(selectedRequest) && (
                    <div><p className="text-xs text-muted-foreground">الجوال</p><p className="font-medium text-foreground mt-0.5" dir="ltr">{getClientPhone(selectedRequest)}</p></div>
                  )}
                  {getClientEmail(selectedRequest) && (
                    <div><p className="text-xs text-muted-foreground">البريد</p><p className="font-medium text-foreground mt-0.5 text-xs" dir="ltr">{getClientEmail(selectedRequest)}</p></div>
                  )}
                  {selectedRequest.property_description_ar && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">الوصف</p>
                      <BidiText className="text-xs text-foreground/80 leading-[1.8]">{selectedRequest.property_description_ar}</BidiText>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chat Card */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    المحادثة
                    {drawerMessages.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{drawerMessages.length}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto space-y-2 rounded-lg bg-muted/20 p-3 mb-3">
                    {loadingMessages ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : drawerMessages.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-6">لا توجد رسائل</p>
                    ) : (
                      drawerMessages.map((msg: any, i: number) => {
                        const isClient = msg.sender_type === "client";
                        const isSystem = msg.sender_type === "system";
                        const isAdmin = msg.sender_type === "admin";
                        return (
                          <div key={msg.id || i} className={`flex gap-2 ${isClient ? "justify-start" : "justify-end"}`}>
                            {isClient && <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-3 h-3 text-primary" /></div>}
                            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                              isSystem ? "bg-muted text-muted-foreground text-center mx-auto" :
                              isClient ? "bg-background border border-border text-foreground" :
                              "bg-primary text-primary-foreground"
                            }`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              <p className={`text-[9px] mt-1 ${isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {isAdmin && <div className="shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center"><Bot className="w-3 h-3 text-primary-foreground" /></div>}
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={e => { e.preventDefault(); sendOwnerReply(); }} className="flex items-center gap-2">
                    <Input value={drawerReply} onChange={e => setDrawerReply(e.target.value)} placeholder="اكتب رداً..." className="flex-1 text-xs h-9" disabled={sendingReply} />
                    <Button type="submit" size="icon" className="h-9 w-9" disabled={sendingReply || !drawerReply.trim()}>
                      {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     DASHBOARD VIEW — Command Center
     ══════════════════════════════════════════════ */

  const kpiCards: { label: string; value: number; group: StatusGroupFilter; icon: React.ElementType; accent: string }[] = [
    { label: "إجمالي الطلبات", value: counts.total, group: "all", icon: FileText, accent: "text-foreground" },
    { label: "طلبات جديدة", value: counts.new, group: "new", icon: ClipboardCheck, accent: "text-amber-600 dark:text-amber-400" },
    { label: "قيد التنفيذ", value: counts.progress, group: "progress", icon: Clock, accent: "text-blue-600 dark:text-blue-400" },
    { label: "بانتظار الاعتماد", value: counts.approval, group: "approval", icon: ShieldCheck, accent: "text-indigo-600 dark:text-indigo-400" },
    { label: "مكتملة", value: counts.complete, group: "complete", icon: CheckCircle2, accent: "text-emerald-600 dark:text-emerald-400" },
    { label: "متوقفة", value: counts.blocked, group: "blocked", icon: AlertTriangle, accent: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <TopBar />

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">مركز التحكم</h1>
            <p className="text-sm text-muted-foreground mt-0.5">مرحباً {profileName || "المالك"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              متصل
            </Badge>
          </div>
        </div>

        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map(kpi => {
            const Icon = kpi.icon;
            const isActive = statusGroupFilter === kpi.group && statusGroupFilter !== "all";
            return (
              <button
                key={kpi.label}
                type="button"
                onClick={() => setStatusGroupFilter(prev => prev === kpi.group ? "all" : kpi.group)}
                className="text-right"
              >
                <Card className={`h-full transition-all hover:shadow-md ${isActive ? "border-primary ring-1 ring-primary/20 shadow-md" : "border-border hover:border-primary/30"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`w-4 h-4 ${isActive ? "text-primary" : kpi.accent}`} />
                      </div>
                      <span className={`text-2xl font-bold ${kpi.accent}`}>{kpi.value}</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {/* ═══ ACTION ITEMS ALERT ═══ */}
        {actionItems.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">إجراء مطلوب</p>
                  <p className="text-xs text-muted-foreground">{actionItems.length} طلب بحاجة إلى تدخلك</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {actionItems.slice(0, 5).map(req => (
                  <button
                    key={req.id}
                    onClick={() => openWorkspace(req)}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground truncate max-w-[140px]">{getClientName(req)}</span>
                    <Badge className={`${statusColor(req.status)} border-0 text-[10px]`}>{getStatus(req)}</Badge>
                  </button>
                ))}
                {actionItems.length > 5 && (
                  <span className="text-xs text-muted-foreground self-center">+{actionItems.length - 5} أخرى</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ REQUESTS LIST ═══ */}
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث بالاسم أو رقم الطلب..." className="pr-9 h-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-10"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Array.from(new Set(requests.map(r => r.status).filter(Boolean))).map(status => (
                  <SelectItem key={status} value={status}>{statusLabels[status] || status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusGroupFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setStatusGroupFilter("all")} className="gap-1 text-xs text-muted-foreground">
                <X className="w-3 h-3" />
                إزالة الفلتر
              </Button>
            )}
            <div className="mr-auto">
              <Badge variant="outline" className="text-xs">{filteredRequests.length} طلب</Badge>
            </div>
          </div>

          {/* Table */}
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">العميل</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">الغرض</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">نوع الأصل</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">النمط</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">لا توجد طلبات مطابقة</td></tr>
                  ) : filteredRequests.map(req => (
                    <tr
                      key={req.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/20 cursor-pointer"
                      onClick={() => openWorkspace(req)}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-foreground text-sm">{getClientName(req)}</p>
                        {req.reference_number && <p className="text-[10px] text-muted-foreground font-mono mt-0.5" dir="ltr">{req.reference_number}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{getPurpose(req)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{getAssetType(req)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{getMode(req)}</td>
                      <td className="px-4 py-3.5">
                        <Badge className={`${statusColor(req.status)} border-0 text-[10px] font-medium`}>{getStatus(req)}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("ar-SA")}</td>
                      <td className="px-4 py-3.5">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8">
                          <Eye className="w-3.5 h-3.5" />
                          فتح
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
