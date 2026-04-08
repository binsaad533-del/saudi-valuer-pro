import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import ReportDraftGenerator from "@/components/reports/ReportDraftGenerator";
import FinalIssuancePanel from "@/components/reports/FinalIssuancePanel";
import SOWGenerator from "@/components/reports/SOWGenerator";
import ProfessionalJudgmentPanel from "@/components/valuation/ProfessionalJudgmentPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import BidiText from "@/components/ui/bidi-text";
import CommandPalette from "@/components/dashboard/CommandPalette";
import { normalizeStatus, STATUS_LABELS, PIPELINE_PHASES } from "@/lib/workflow-engine";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";
import {
  ArrowLeft, Send, MessageSquare, Loader2,
  User, Bot, Building2, Brain, Shield,
  AlertTriangle, Clock, ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";

/* ═══ Status utilities ═══ */
const STATUS_NEW = ["draft", "submitted"];
const STATUS_COMPLETE = ["issued", "archived"];
const STATUS_BLOCKED = ["cancelled"];

const statusLabels: Record<string, string> = {
  draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق مُعتمد",
  first_payment_confirmed: "دفعة أولى", data_collection_open: "جمع بيانات", data_collection_complete: "بيانات مكتملة",
  inspection_pending: "بانتظار معاينة", inspection_completed: "معاينة مكتملة", data_validated: "بيانات مُعتمدة",
  analysis_complete: "تحليل مكتمل", professional_review: "مراجعة مهنية", draft_report_ready: "مسودة جاهزة",
  client_review: "مراجعة عميل", draft_approved: "مسودة مُعتمدة", final_payment_confirmed: "دفعة نهائية",
  issued: "صادر", archived: "مؤرشف", cancelled: "ملغي",
};

const purposeLabels: Record<string, string> = {
  sale_purchase: "بيع/شراء", mortgage: "تمويل/رهن", financial_reporting: "تقارير مالية",
  insurance: "تأمين", taxation: "زكاة/ضريبة", expropriation: "نزع ملكية",
  litigation: "نزاع/قضاء", investment: "استثمار", lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي", regulatory: "تنظيمي", other: "أخرى",
};

const assetTypeLabels: Record<string, string> = {
  real_estate: "عقار", land: "أرض", apartment: "شقة", villa: "فيلا", commercial: "تجاري",
  industrial: "صناعي", equipment: "معدات", machinery: "آلات ومعدات", business: "منشأة تجارية",
  vehicle: "مركبة", residential_land: "أرض سكنية", commercial_land: "أرض تجارية", building: "مبنى",
};

const ACTION_STATUSES = ["submitted", "scope_generated", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"];

const getClientName = (req: any) => req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "—";
const getClientPhone = (req: any) => req.client_phone || req.ai_intake_summary?.clientInfo?.contactPhone || "";
const getClientEmail = (req: any) => req.client_email || req.ai_intake_summary?.clientInfo?.contactEmail || "";
const getPurpose = (req: any) => purposeLabels[req.purpose] || req.purpose_ar || req.purpose_other || req.purpose || "—";
const getAssetType = (req: any) => assetTypeLabels[req.property_type] || assetTypeLabels[req.valuation_type] || req.property_type || "—";
const getStatus = (req: any) => { const n = normalizeStatus(req.status); return statusLabels[n] || STATUS_LABELS[n]?.ar || "—"; };
const getMode = (req: any) => req.valuation_mode === "desktop" ? "مكتبي" : req.valuation_mode === "field" ? "ميداني" : "—";

const statusColor = (status: string) => {
  const n = normalizeStatus(status);
  if (STATUS_COMPLETE.includes(n)) return "text-emerald-600 dark:text-emerald-400";
  if (STATUS_BLOCKED.includes(n)) return "text-red-500";
  if (STATUS_NEW.includes(n)) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
};

function getActionReason(status: string): string {
  const map: Record<string, string> = {
    submitted: "مراجعة طلب جديد", scope_generated: "اعتماد نطاق العمل",
    professional_review: "الحكم المهني مطلوب", draft_report_ready: "اعتماد المسودة",
    client_review: "ملاحظات العميل وردت", draft_approved: "جاهز للإصدار",
    final_payment_confirmed: "الدفعة مؤكدة — إصدار",
  };
  return map[status] || "يحتاج مراجعة";
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  const d = Math.floor(h / 24);
  return `${d}ي`;
}

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
  const [financials, setFinancials] = useState({ revenue: 0, pending: 0 });
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState({ stale: 0, pendingPay: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const [{ data: reqs }, { data: payments }, { data: audit }, { count: stale }, { count: pendPay }] = await Promise.all([
        supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payments").select("amount, payment_status"),
        supabase.from("audit_logs").select("id, action, description, created_at, table_name").order("created_at", { ascending: false }).limit(6),
        supabase.from("valuation_assignments").select("id", { count: "exact", head: true }).lt("updated_at", threeDaysAgo).not("status", "in", "(issued,archived,cancelled,draft)"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("payment_status", "pending").eq("payment_type", "bank_transfer"),
      ]);
      setRequests((reqs as any[]) || []);
      let rev = 0, pend = 0;
      (payments || []).forEach((p: any) => { if (p.payment_status === "paid") rev += (p.amount || 0); else if (p.payment_status === "pending") pend += (p.amount || 0); });
      setFinancials({ revenue: rev, pending: pend });
      setAuditEntries(audit || []);
      setSystemAlerts({ stale: stale || 0, pendingPay: pendPay || 0 });
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
      await supabase.from("request_messages" as any).insert({ request_id: selectedRequest.id, sender_id: user.id, sender_type: "admin" as any, content: drawerReply.trim() });
      setDrawerReply("");
    } catch {}
    setSendingReply(false);
  }, [drawerReply, selectedRequest, user]);

  /* ═══ Computed ═══ */
  const threeDaysAgo = Date.now() - 3 * 86400000;

  const actionQueue = useMemo(() =>
    requests
      .filter(r => ACTION_STATUSES.includes(normalizeStatus(r.status)))
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 8)
      .map(r => ({ id: r.id, client: getClientName(r), action: getActionReason(normalizeStatus(r.status)), status: r.status, time: relativeTime(r.updated_at) }))
  , [requests]);

  const stateMap = useMemo(() => {
    const m = { active: 0, new: 0, awaitApproval: 0, stale: 0, completed: 0, blocked: 0 };
    requests.forEach(r => {
      const n = normalizeStatus(r.status);
      if (STATUS_COMPLETE.includes(n)) { m.completed++; return; }
      if (STATUS_BLOCKED.includes(n)) { m.blocked++; return; }
      if (STATUS_NEW.includes(n)) { m.new++; }
      if (["professional_review", "draft_report_ready", "draft_approved", "final_payment_confirmed"].includes(n)) m.awaitApproval++;
      if (!["draft"].includes(n) && new Date(r.updated_at).getTime() < threeDaysAgo) m.stale++;
      m.active++;
    });
    return m;
  }, [requests]);

  const pressureMap = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    requests.forEach(r => {
      const n = normalizeStatus(r.status);
      if (!["issued", "archived", "cancelled"].includes(n)) statusCounts[n] = (statusCounts[n] || 0) + 1;
    });
    const phases = PIPELINE_PHASES.filter(p => p.key !== "finalization");
    return phases.map(p => ({
      label: p.label.replace("و", "·"),
      count: p.statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0),
      congested: p.statuses.some(s => (statusCounts[s] || 0) >= 3),
    }));
  }, [requests]);

  const totalActive = pressureMap.reduce((s, p) => s + p.count, 0);
  const maxPressure = Math.max(...pressureMap.map(p => p.count), 1);

  const raqeemInsights = useMemo(() => {
    const insights: string[] = [];
    if (stateMap.stale > 0) insights.push(`${stateMap.stale} ملف متوقف أكثر من 3 أيام`);
    const congested = pressureMap.filter(p => p.congested);
    if (congested.length > 0) insights.push(`تكدس في: ${congested.map(c => c.label).join("، ")}`);
    if (stateMap.awaitApproval > 0) insights.push(`${stateMap.awaitApproval} ملف بانتظار حكمك المهني أو اعتمادك`);
    const scopeReady = requests.filter(r => normalizeStatus(r.status) === "scope_generated").length;
    if (scopeReady > 0) insights.push(`${scopeReady} نطاق عمل جاهز للاعتماد`);
    if (insights.length === 0) insights.push("لا مخاطر حالية — النظام يعمل بانتظام");
    return insights;
  }, [stateMap, pressureMap, requests]);

  const collectionRate = financials.revenue + financials.pending > 0 ? Math.round((financials.revenue / (financials.revenue + financials.pending)) * 100) : 0;

  const openWorkspace = (reqOrId: any) => {
    const req = typeof reqOrId === "string" ? requests.find(r => r.id === reqOrId) : reqOrId;
    if (!req) return;
    setSelectedRequest(req);
    setViewMode("workspace");
  };

  const closeWorkspace = () => { setSelectedRequest(null); setViewMode("dashboard"); refreshRequests(); };

  /* ═══ Loading ═══ */
  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <TopBar />
        <div className="max-w-[1400px] mx-auto px-5 py-4 space-y-3">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-[500px] rounded-lg" />
        </div>
      </div>
    );
  }

  /* ═══ WORKSPACE VIEW ═══ */
  if (viewMode === "workspace" && selectedRequest) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <TopBar />
        <div className="border-b border-border bg-card/50 sticky top-0 z-20 backdrop-blur-sm">
          <div className="max-w-[1400px] mx-auto px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={closeWorkspace} className="gap-1.5 shrink-0 text-xs h-7 px-2">
                <ArrowLeft className="w-3.5 h-3.5" />العودة
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{getClientName(selectedRequest)}</span>
                  <span className={`text-[10px] font-medium ${statusColor(selectedRequest.status)}`}>{getStatus(selectedRequest)}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{getAssetType(selectedRequest)}</span>
                  <span>·</span>
                  <span>{getPurpose(selectedRequest)}</span>
                  <span>·</span>
                  <span>{getMode(selectedRequest)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-5 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
            <div className="space-y-5 min-w-0">
              <SOWGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <ProfessionalJudgmentPanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <ReportDraftGenerator request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
              <FinalIssuancePanel request={selectedRequest} userId={user!.id} onStatusChange={refreshRequests} />
            </div>
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" />بيانات الطلب</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-muted-foreground text-[10px]">الغرض</p><p className="font-medium text-foreground">{getPurpose(selectedRequest)}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">نوع الأصل</p><p className="font-medium text-foreground">{getAssetType(selectedRequest)}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">النمط</p><p className="font-medium text-foreground">{getMode(selectedRequest)}</p></div>
                    <div><p className="text-muted-foreground text-[10px]">التاريخ</p><p className="font-medium text-foreground">{new Date(selectedRequest.created_at).toLocaleDateString("ar-SA")}</p></div>
                  </div>
                  {getClientPhone(selectedRequest) && <div><p className="text-muted-foreground text-[10px]">الجوال</p><p className="font-medium" dir="ltr">{getClientPhone(selectedRequest)}</p></div>}
                  {getClientEmail(selectedRequest) && <div><p className="text-muted-foreground text-[10px]">البريد</p><p className="font-medium text-[10px]" dir="ltr">{getClientEmail(selectedRequest)}</p></div>}
                  {selectedRequest.property_description_ar && <div><p className="text-muted-foreground text-[10px] mb-0.5">الوصف</p><BidiText className="text-foreground/80 leading-[1.7]">{selectedRequest.property_description_ar}</BidiText></div>}
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />المحادثة{drawerMessages.length > 0 && <span className="text-[9px] text-muted-foreground mr-1">({drawerMessages.length})</span>}</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[350px] overflow-y-auto space-y-1.5 rounded bg-muted/10 p-2.5 mb-2">
                    {loadingMessages ? <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    : drawerMessages.length === 0 ? <p className="text-center text-[10px] text-muted-foreground py-5">لا رسائل</p>
                    : drawerMessages.map((msg: any, i: number) => {
                      const isClient = msg.sender_type === "client";
                      const isAdmin = msg.sender_type === "admin";
                      const isSystem = msg.sender_type === "system";
                      return (
                        <div key={msg.id || i} className={`flex gap-1.5 ${isClient ? "justify-start" : "justify-end"}`}>
                          {isClient && <div className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center"><User className="w-2.5 h-2.5 text-muted-foreground" /></div>}
                          <div className={`max-w-[80%] rounded px-2.5 py-1.5 text-[10px] ${isSystem ? "bg-muted text-muted-foreground mx-auto" : isClient ? "bg-background border border-border/50 text-foreground" : "bg-foreground/90 text-background"}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            <p className={`text-[8px] mt-0.5 ${isAdmin ? "text-background/50" : "text-muted-foreground"}`}>{new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          {isAdmin && <div className="shrink-0 w-5 h-5 rounded-full bg-foreground flex items-center justify-center"><Bot className="w-2.5 h-2.5 text-background" /></div>}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={e => { e.preventDefault(); sendOwnerReply(); }} className="flex items-center gap-1.5">
                    <Input value={drawerReply} onChange={e => setDrawerReply(e.target.value)} placeholder="ردّ..." className="flex-1 text-[10px] h-7 border-border/50" disabled={sendingReply} />
                    <Button type="submit" size="icon" className="h-7 w-7 bg-foreground hover:bg-foreground/90" disabled={sendingReply || !drawerReply.trim()}>
                      {sendingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
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

  /* ══════════════════════════════════════════════════════════════
     COMMAND CENTER — 5 Layers
     ══════════════════════════════════════════════════════════════ */
  const criticalCount = systemAlerts.stale + systemAlerts.pendingPay;
  const now = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <TopBar />

      <div className="max-w-[1440px] mx-auto px-5 py-4 space-y-0">

        {/* ═══════════════════════════════════════════════
            LAYER 1: Operational Status Strip
            ═══════════════════════════════════════════════ */}
        <div className="flex items-center justify-between py-2 border-b border-border/40 mb-4">
          <div className="flex items-center gap-5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${criticalCount === 0 ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-muted-foreground font-medium">النظام</span>
            </div>
            {criticalCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="font-semibold text-red-600 dark:text-red-400">{criticalCount}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Brain className="w-3 h-3 text-primary/70" />
              <span className="text-muted-foreground">رقيم</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500/70" />
              <span className="text-muted-foreground">الامتثال</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Clock className="w-2.5 h-2.5" />
            <span className="tabular-nums">{now}</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            MAIN GRID: Priority Queue + Intelligence
            ═══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

          {/* ──────── LEFT COLUMN ──────── */}
          <div className="space-y-5 min-w-0">

            {/* ═══ LAYER 2: Command Priority Queue ═══ */}
            {actionQueue.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1 h-4 rounded-full bg-amber-500" />
                  <h2 className="text-[11px] font-bold text-foreground tracking-wide">الإجراء المطلوب</h2>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{actionQueue.length}</span>
                </div>
                <div className="space-y-1">
                  {actionQueue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openWorkspace(item.id)}
                      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md border border-transparent hover:border-border hover:bg-muted/20 transition-all text-right group"
                    >
                      <div className="w-1 h-8 rounded-full bg-amber-400/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-foreground truncate">{item.client}</span>
                          <span className={`text-[9px] font-medium ${statusColor(item.status)}`}>{statusLabels[normalizeStatus(item.status)] || "—"}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.action}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums shrink-0">{item.time}</span>
                      <ChevronLeft className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ═══ LAYER 3: Platform State Map ═══ */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1 h-4 rounded-full bg-foreground/20" />
                <h2 className="text-[11px] font-bold text-foreground tracking-wide">حالة المنصة</h2>
              </div>
              <div className="grid grid-cols-3 gap-px bg-border/30 rounded-lg overflow-hidden lg:grid-cols-6">
                {([
                  { label: "نشط", value: stateMap.active, warn: false },
                  { label: "جديد", value: stateMap.new, warn: false },
                  { label: "بانتظارك", value: stateMap.awaitApproval, warn: stateMap.awaitApproval > 0 },
                  { label: "متأخر", value: stateMap.stale, warn: stateMap.stale > 0 },
                  { label: "مكتمل", value: stateMap.completed, warn: false },
                  { label: "ملغي", value: stateMap.blocked, warn: stateMap.blocked > 0 },
                ] as const).map((s) => (
                  <div key={s.label} className="bg-card py-3 px-3 text-center">
                    <p className={`text-lg font-bold tabular-nums ${s.warn ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{s.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══ LAYER 4: Workflow Pressure Map ═══ */}
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-foreground/20" />
                  <h2 className="text-[11px] font-bold text-foreground tracking-wide">خريطة الضغط</h2>
                </div>
                <span className="text-[9px] text-muted-foreground tabular-nums">{totalActive} نشط</span>
              </div>
              <div className="space-y-1.5">
                {pressureMap.map((phase) => {
                  const pct = Math.max((phase.count / maxPressure) * 100, phase.count > 0 ? 6 : 0);
                  return (
                    <div key={phase.label} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-28 shrink-0 truncate text-right">{phase.label}</span>
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${phase.congested ? "bg-red-400 dark:bg-red-500" : "bg-foreground/15"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-0.5 w-8 justify-end">
                        {phase.congested && <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
                        <span className={`text-[9px] font-medium tabular-nums ${phase.congested ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{phase.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ──────── RIGHT COLUMN: Intelligence ──────── */}
          <div className="space-y-5">

            {/* ═══ LAYER 5: Live Intelligence Feed ═══ */}
            {/* Raqeem Executive */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-3 h-3 text-primary/70" />
                <h2 className="text-[11px] font-bold text-foreground">رقيم</h2>
              </div>
              <div className="space-y-1.5">
                {raqeemInsights.map((insight, i) => (
                  <div key={i} className={`border-r-2 pr-2.5 py-1 ${i === 0 && stateMap.stale > 0 ? "border-r-red-400" : i < raqeemInsights.length - 1 ? "border-r-amber-400/60" : "border-r-emerald-400/60"}`}>
                    <p className="text-[10px] text-foreground/80 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Financial snapshot */}
            <section className="border-t border-border/30 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[11px] font-bold text-foreground">المالية</h2>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المحصّل</span>
                  <span className="font-bold text-foreground tabular-nums">{formatNumber(financials.revenue)} <SAR /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">معلّق</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatNumber(financials.pending)} <SAR /></span>
                </div>
                {collectionRate > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">تحصيل</span>
                    <span className="font-medium text-foreground tabular-nums">{collectionRate}%</span>
                  </div>
                )}
              </div>
            </section>

            {/* Live events */}
            <section className="border-t border-border/30 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-[11px] font-bold text-foreground">أحداث</h2>
              </div>
              <div className="space-y-1">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 py-1">
                    <span className="text-[8px] text-muted-foreground/50 tabular-nums shrink-0 mt-0.5 w-6">{relativeTime(entry.created_at)}</span>
                    <p className="text-[10px] text-foreground/70 leading-snug truncate">{entry.description || `${entry.action} · ${entry.table_name}`}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <CommandPalette />
      </div>
    </div>
  );
}
