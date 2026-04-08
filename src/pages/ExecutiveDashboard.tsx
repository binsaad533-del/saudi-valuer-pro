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
import { Separator } from "@/components/ui/separator";
import BidiText from "@/components/ui/bidi-text";
import CommandPalette from "@/components/dashboard/CommandPalette";
import SystemStatusBar from "@/components/dashboard/SystemStatusBar";
import OperationalOverview from "@/components/dashboard/OperationalOverview";
import ActionRequiredPanel from "@/components/dashboard/ActionRequiredPanel";
import LiveFeed from "@/components/dashboard/LiveFeed";
import WorkflowMonitor from "@/components/dashboard/WorkflowMonitor";
import RaqeemExecutiveInsight from "@/components/dashboard/RaqeemExecutiveInsight";
import { normalizeStatus, STATUS_LABELS, PIPELINE_PHASES } from "@/lib/workflow-engine";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowLeft, Send, MessageSquare, Loader2,
  User, Bot, Building2, TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

/* ═══ Status utilities ═══ */
const STATUS_NEW = ["draft", "submitted"];

const STATUS_COMPLETE = ["issued", "archived"];
const STATUS_BLOCKED = ["cancelled"];

const statusLabels: Record<string, string> = {
  draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق العمل جاهز", scope_approved: "نطاق العمل مُعتمد",
  first_payment_confirmed: "دفعة أولى مؤكدة", data_collection_open: "جمع البيانات", data_collection_complete: "البيانات مكتملة",
  inspection_pending: "بانتظار المعاينة", inspection_completed: "المعاينة مكتملة", data_validated: "البيانات مُعتمدة",
  analysis_complete: "التحليل مكتمل", professional_review: "المراجعة المهنية", draft_report_ready: "مسودة جاهزة",
  client_review: "مراجعة العميل", draft_approved: "المسودة مُعتمدة", final_payment_confirmed: "الدفعة النهائية مؤكدة",
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

const getClientName = (req: any) => req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "عميل غير محدد";
const getClientPhone = (req: any) => req.client_phone || req.ai_intake_summary?.clientInfo?.contactPhone || "";
const getClientEmail = (req: any) => req.client_email || req.ai_intake_summary?.clientInfo?.contactEmail || "";
const getPurpose = (req: any) => purposeLabels[req.purpose] || req.purpose_ar || req.purpose_other || req.purpose || "غير محدد";
const getAssetType = (req: any) => assetTypeLabels[req.property_type] || assetTypeLabels[req.valuation_type] || req.property_type || req.valuation_type || "غير محدد";
const getStatus = (req: any) => {
  const n = normalizeStatus(req.status);
  return statusLabels[n] || STATUS_LABELS[n]?.ar || req.status || "غير محدد";
};
const getMode = (req: any) => req.valuation_mode === "desktop" ? "مكتبي" : req.valuation_mode === "field" ? "ميداني" : "—";

const statusColor = (status: string) => {
  const n = normalizeStatus(status);
  if (STATUS_COMPLETE.includes(n)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (STATUS_BLOCKED.includes(n)) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (STATUS_NEW.includes(n)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
};

const ACTION_STATUSES = ["submitted", "scope_generated", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"];

type ViewMode = "dashboard" | "workspace";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [drawerMessages, setDrawerMessages] = useState<any[]>([]);
  const [drawerReply, setDrawerReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Financial data
  const [financials, setFinancials] = useState({ revenue: 0, pending: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [{ data: requestRows }, { data: payments }] = await Promise.all([
        supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payments").select("amount, payment_status"),
      ]);
      setRequests((requestRows as any[]) || []);
      let rev = 0, pend = 0;
      (payments || []).forEach((p: any) => {
        if (p.payment_status === "paid") rev += (p.amount || 0);
        else if (p.payment_status === "pending") pend += (p.amount || 0);
      });
      setFinancials({ revenue: rev, pending: pend });
      setLoading(false);
    };
    load();
  }, [user]);

  const refreshRequests = useCallback(async () => {
    const { data } = await supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setRequests(data as any[]);
  }, []);

  // Messages
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

  /* ═══ Computed data ═══ */
  const threeDaysAgo = Date.now() - 3 * 86400000;

  const overviewCounts = useMemo(() => ({
    newRequests: requests.filter(r => STATUS_NEW.includes(normalizeStatus(r.status))).length,
    stale: requests.filter(r => {
      const n = normalizeStatus(r.status);
      return !["issued", "archived", "cancelled", "draft"].includes(n) && new Date(r.updated_at).getTime() < threeDaysAgo;
    }).length,
    awaitingApproval: requests.filter(r => ["professional_review", "draft_report_ready", "draft_approved", "final_payment_confirmed"].includes(normalizeStatus(r.status))).length,
    stopped: requests.filter(r => normalizeStatus(r.status) === "cancelled").length,
    pendingPayments: financials.pending > 0 ? 1 : 0, // simplified
    draftsReady: requests.filter(r => normalizeStatus(r.status) === "draft_report_ready").length,
  }), [requests, financials.pending]);

  const actionItems = useMemo(() =>
    requests
      .filter(r => ACTION_STATUSES.includes(normalizeStatus(r.status)))
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .map(r => ({
        id: r.id,
        clientName: getClientName(r),
        status: r.status,
        reason: getActionReason(normalizeStatus(r.status)),
        updatedAt: r.updated_at,
      }))
  , [requests]);

  const pipelineStages = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    requests.forEach(r => {
      const n = normalizeStatus(r.status);
      if (!["issued", "archived", "cancelled"].includes(n)) {
        statusCounts[n] = (statusCounts[n] || 0) + 1;
      }
    });

    const phases = PIPELINE_PHASES.filter(p => p.key !== "finalization");
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      stages: phases.map(p => ({
        label: p.label,
        count: p.statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0),
        isBottleneck: p.statuses.some(s => (statusCounts[s] || 0) >= 3),
      })),
      total,
    };
  }, [requests]);

  const collectionRate = financials.revenue + financials.pending > 0
    ? Math.round((financials.revenue / (financials.revenue + financials.pending)) * 100) : 0;

  const openWorkspace = (reqOrId: any) => {
    const req = typeof reqOrId === "string" ? requests.find(r => r.id === reqOrId) : reqOrId;
    if (!req) return;
    setSelectedRequest(req);
    setViewMode("workspace");
  };

  const closeWorkspace = () => {
    setSelectedRequest(null);
    setViewMode("dashboard");
    refreshRequests();
  };

  /* ═══ Loading ═══ */
  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <TopBar />
        <div className="space-y-4 p-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-10 rounded-lg" />
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  /* ═══ WORKSPACE VIEW ═══ */
  if (viewMode === "workspace" && selectedRequest) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <TopBar />
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            <div className="space-y-6 min-w-0">
              <SOWGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <ProfessionalJudgmentPanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <ReportDraftGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <FinalIssuancePanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
            </div>
            <div className="space-y-4">
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
                        const isAdmin = msg.sender_type === "admin";
                        const isSystem = msg.sender_type === "system";
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

  /* ═══ COMMAND CENTER ═══ */
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <TopBar />

      <div className="max-w-[1400px] mx-auto px-6 py-5 space-y-4">

        {/* Zone 1: System Status Bar */}
        <SystemStatusBar />

        {/* Zone 2: Operational Overview — unique KPIs */}
        <OperationalOverview counts={overviewCounts} />

        {/* Two-column layout: Actions + Intelligence */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">

          {/* Main Column */}
          <div className="space-y-4 min-w-0">

            {/* Zone 3: Action Required Now */}
            <ActionRequiredPanel items={actionItems} onOpen={openWorkspace} />

            {/* Zone 5: Workflow Monitor */}
            <WorkflowMonitor stages={pipelineStages.stages} total={pipelineStages.total} />

            {/* Zone 4: Live Feed */}
            <LiveFeed />
          </div>

          {/* Intelligence Sidebar */}
          <div className="space-y-4">

            {/* Zone 6: Raqeem Executive Insight */}
            <RaqeemExecutiveInsight />

            {/* Compact Financial */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-foreground">المالية</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">المحصّل</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatNumber(financials.revenue)} <SAR /></span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">معلّق</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatNumber(financials.pending)} <SAR /></span>
                </div>
                {collectionRate > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">التحصيل</span>
                      <span className="text-[10px] font-medium text-foreground tabular-nums">{collectionRate}%</span>
                    </div>
                    <Progress value={collectionRate} className="h-1" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <CommandPalette />
      </div>
    </div>
  );
}

function getActionReason(status: string): string {
  const map: Record<string, string> = {
    submitted: "طلب جديد بانتظار المراجعة",
    scope_generated: "نطاق العمل جاهز للاعتماد",
    professional_review: "بانتظار الحكم المهني",
    draft_report_ready: "مسودة التقرير جاهزة",
    client_review: "العميل أرسل ملاحظاته",
    draft_approved: "المسودة معتمدة — بانتظار الإصدار",
    final_payment_confirmed: "الدفعة النهائية مؤكدة — جاهز للإصدار",
  };
  return map[status] || "يحتاج مراجعة";
}
