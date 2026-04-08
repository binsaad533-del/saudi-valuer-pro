import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CreditCard, Eye, CheckCircle, XCircle, Send,
  Building2, Bot, Brain, BarChart3, MessageSquareText,
} from "lucide-react";
import AdminPaymentDashboard from "@/components/payments/AdminPaymentDashboard";
import ReportRevisionPanel from "@/components/reports/ReportRevisionPanel";
import { formatDate, formatNumber } from "@/lib/utils";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import {
  STATUS_LABELS as WF_STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/workflow-engine";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";

const STATUS_LABELS: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(WF_STATUS_LABELS).map(([k, v]) => [k, { label: v.ar, color: STATUS_COLORS[k] || "bg-muted text-muted-foreground" }])
);

// Tabs aligned with the 19-status assignment workflow
const ADMIN_TABS = [
  { value: "intake", label: "الاستقبال", statuses: ["draft", "submitted"] },
  { value: "pricing", label: "التسعير والنطاق", statuses: ["scope_generated", "scope_approved"] },
  { value: "payment", label: "الدفع والإنتاج", statuses: ["first_payment_confirmed", "data_collection_open", "data_collection_complete", "inspection_pending", "inspection_completed", "data_validated"] },
  { value: "production", label: "التقييم والمراجعة", statuses: ["analysis_complete", "professional_review", "draft_report_ready", "client_review", "draft_approved"] },
  { value: "final", label: "الإصدار", statuses: ["final_payment_confirmed", "issued", "archived", "cancelled"] },
];

const getTabForStatus = (status: string) => {
  const matchedTab = ADMIN_TABS.find(tab => tab.statuses.includes(status));
  return matchedTab?.value || "intake";
};

const getClientDisplayName = (req: any) => req.clients?.name_ar || req.client_name_ar || req.ai_intake_summary?.clientInfo?.contactName || "طلب تقييم";

export default function ClientRequests() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("intake");
  const [pricingDialog, setPricingDialog] = useState(false);
  const [paymentReviewDialog, setPaymentReviewDialog] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [revisionDialog, setRevisionDialog] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Pricing form
  const [pricingForm, setPricingForm] = useState({
    quotationAmount: "",
    paymentStructure: "full",
    firstPaymentPercentage: "50",
    scopeOfWorkAr: "",
    scopeOfWorkEn: "",
    termsAr: "",
    turnaround: "",
    complexity: "",
  });

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    const stateId = (location.state as any)?.selectedRequestId;
    if (!stateId || requests.length === 0) return;

    const found = requests.find((r: any) => r.id === stateId);
    if (found) {
      setSelectedRequest(found);
      setActiveTab(getTabForStatus(found.status));
    }
  }, [location.state, requests]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("valuation_requests" as any)
      .select("*, clients:client_id(id, name_ar, phone, email), assignment:assignment_id(id, status, reference_number)")
      .order("created_at", { ascending: false });
    // Normalize: use assignment status as the canonical status for workflow
    const reqs: any[] = ((data as any[]) || []).map(r => ({
      ...r,
      // Use the assignment's workflow status if available, else fall back to request status
      status: r.assignment?.status || r.status,
      assignment_id: r.assignment?.id || r.assignment_id,
      reference_number: r.assignment?.reference_number || r.reference_number,
    }));
    setRequests(reqs);
    setLoading(false);

    // Auto-select request from navigation state
    const stateId = (location.state as any)?.selectedRequestId;
    if (stateId) {
      const found = reqs.find((r: any) => r.id === stateId);
      if (found) {
        setSelectedRequest(found);
        setActiveTab(getTabForStatus(found.status));
      }
    }
  };

  const openPricing = async (req: any) => {
    setSelectedRequest(req);
    setPricingForm({
      quotationAmount: req.quotation_amount?.toString() || req.ai_suggested_price?.toString() || "",
      paymentStructure: req.payment_structure || "full",
      firstPaymentPercentage: req.first_payment_percentage?.toString() || "50",
      scopeOfWorkAr: req.scope_of_work_ar || "",
      scopeOfWorkEn: req.scope_of_work_en || "",
      termsAr: req.terms_ar || "يشمل السعر أتعاب التقييم والمعاينة الميدانية وإصدار التقرير. لا يشمل أي رسوم حكومية.",
      turnaround: req.ai_suggested_turnaround || "5-7 أيام عمل",
      complexity: req.ai_complexity_level || "standard",
    });
    setPricingDialog(true);
  };

  const requestAISuggestion = async () => {
    if (!selectedRequest) return;
    setAiSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-consistency", {
        body: {
          action: "suggest_pricing",
          request: {
            property_type: selectedRequest.property_type,
            purpose: selectedRequest.purpose,
            property_city: selectedRequest.property_city_ar,
            land_area: selectedRequest.land_area,
            building_area: selectedRequest.building_area,
            description: selectedRequest.property_description_ar,
          },
        },
      });
      if (error) throw error;
      if (data) {
        setPricingForm(prev => ({
          ...prev,
          quotationAmount: data.suggested_price?.toString() || prev.quotationAmount,
          complexity: data.complexity || prev.complexity,
          turnaround: data.turnaround || prev.turnaround,
          scopeOfWorkAr: data.scope_ar || prev.scopeOfWorkAr,
        }));
        toast({ title: "تم تحديث الاقتراحات من AI" });
      }
    } catch {
      toast({ title: "تعذر الحصول على اقتراح AI", variant: "destructive" });
    } finally {
      setAiSuggesting(false);
    }
  };

  const sendQuotation = async () => {
    if (!selectedRequest || !pricingForm.quotationAmount) return;
    setSaving(true);
    try {
      const totalFees = parseFloat(pricingForm.quotationAmount);
      const firstPaymentAmount = pricingForm.paymentStructure === "partial"
        ? totalFees * (parseFloat(pricingForm.firstPaymentPercentage) / 100)
        : totalFees;

      // Save pricing data (no direct status change)
      await supabase.from("valuation_requests" as any).update({
        quotation_amount: totalFees,
        total_fees: totalFees,
        payment_structure: pricingForm.paymentStructure,
        first_payment_amount: firstPaymentAmount,
        first_payment_percentage: pricingForm.paymentStructure === "partial" ? parseFloat(pricingForm.firstPaymentPercentage) : 100,
        scope_of_work_ar: pricingForm.scopeOfWorkAr,
        scope_of_work_en: pricingForm.scopeOfWorkEn,
        terms_ar: pricingForm.termsAr,
        ai_suggested_turnaround: pricingForm.turnaround,
        ai_complexity_level: pricingForm.complexity,
        quotation_sent_at: new Date().toISOString(),
        fees_breakdown: {
          total: totalFees,
          structure: pricingForm.paymentStructure,
          first_payment: firstPaymentAmount,
          final_payment: pricingForm.paymentStructure === "partial" ? totalFees - firstPaymentAmount : 0,
        },
      } as any).eq("id", selectedRequest.id);

      // Advance status via RPC
      const statusResult = await changeStatusByRequestId(selectedRequest.id, "scope_generated", {
        reason: "إرسال عرض السعر ونطاق العمل للعميل",
      });
      if (!statusResult.success) throw new Error(statusResult.error);

      // Send system message to client
      await supabase.from("request_messages" as any).insert({
        request_id: selectedRequest.id,
        sender_type: "system" as any,
        content: `تم إرسال عرض السعر: ${formatNumber(totalFees)} ر.س\nنطاق العمل: ${pricingForm.scopeOfWorkAr}\nالمدة المتوقعة: ${pricingForm.turnaround}`,
      });

      toast({ title: "تم إرسال عرض السعر للعميل" });
      setPricingDialog(false);
      loadRequests();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const moveToStatus = async (reqId: string, newStatus: string) => {
    setSaving(true);
    try {
      // Save timestamp fields separately
      if (newStatus === "data_collection_open") {
        await supabase.from("valuation_requests" as any).update({
          production_started_at: new Date().toISOString(),
        } as any).eq("id", reqId);
      } else if (newStatus === "issued") {
        await supabase.from("valuation_requests" as any).update({
          completed_at: new Date().toISOString(),
        } as any).eq("id", reqId);
      }

      // Advance status via RPC
      const statusResult = await changeStatusByRequestId(reqId, newStatus, {
        reason: `تحديث الحالة يدوياً إلى ${newStatus}`,
      });
      if (!statusResult.success) throw new Error(statusResult.error);

      toast({ title: "تم تحديث الحالة" });
      loadRequests();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reviewPayment = async (paymentId: string, approved: boolean, notes: string = "") => {
    setSaving(true);
    try {
      await supabase.from("payment_receipts" as any).update({
        status: approved ? "approved" : "rejected",
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
      } as any).eq("id", paymentId);

      if (approved && selectedRequest) {
        const payment = payments.find(p => p.id === paymentId);
        const req = selectedRequest;
        const totalPaid = (req.amount_paid || 0) + (payment?.amount || 0);
        const isFullyPaid = totalPaid >= (req.total_fees || 0);
        const isFirstPayment = req.payment_status === "unpaid" || req.payment_status === "awaiting_payment";

        // Update payment data fields (no direct status change)
        const paymentStatus = isFullyPaid ? "fully_paid" : "partially_paid";
        await supabase.from("valuation_requests" as any).update({
          amount_paid: totalPaid,
          payment_status: paymentStatus,
          ...(isFirstPayment ? { production_started_at: new Date().toISOString() } : {}),
        } as any).eq("id", req.id);

        // Advance status via RPC
        const targetStatus = isFirstPayment ? "first_payment_confirmed" : "final_payment_confirmed";
        const statusResult = await changeStatusByRequestId(req.id, targetStatus, {
          actionType: "normal",
          reason: `اعتماد إيصال الدفع - ${isFirstPayment ? "الدفعة الأولى" : "الدفعة النهائية"}`,
        });
        if (!statusResult.success) {
          console.warn("Status transition failed:", statusResult.error);
        }
      }

      toast({ title: approved ? "تم اعتماد الإيصال" : "تم رفض الإيصال" });
      setPaymentReviewDialog(false);
      loadRequests();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadPayments = async (reqId: string) => {
    const { data } = await supabase.from("payment_receipts" as any).select("*").eq("request_id", reqId).order("created_at");
    setPayments(data || []);
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, color: "bg-muted text-muted-foreground" };
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">طلبات العملاء</h1>
          <p className="text-sm text-muted-foreground">إدارة ومتابعة طلبات التقييم</p>
        </div>
        <Badge variant="secondary" className="text-sm">{requests.length} طلب</Badge>
      </div>

      {selectedRequest && (
        <Card className="border-primary shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">الطلب المحدد</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {getClientDisplayName(selectedRequest)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedRequest.status)}
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                  إخفاء
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">الغرض</p>
              <p className="font-medium text-foreground">{STATUS_LABELS[selectedRequest.status]?.label || selectedRequest.purpose || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">نوع التقييم</p>
              <p className="font-medium text-foreground">{selectedRequest.valuation_mode === "desktop" ? "مكتبي" : selectedRequest.valuation_mode === "field" ? "ميداني" : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">تاريخ الإنشاء</p>
              <p className="font-medium text-foreground">{formatDate(selectedRequest.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">القيمة التقديرية الحالية</p>
              <p className="font-medium text-foreground">{selectedRequest.quotation_amount ? `${formatNumber(Number(selectedRequest.quotation_amount))} ر.س` : "—"}</p>
            </div>
            <div className="md:col-span-4">
              <p className="text-muted-foreground mb-1">وصف الطلب</p>
              <p className="font-medium text-foreground">{selectedRequest.property_description_ar || selectedRequest.scope_of_work_ar || "لا يوجد وصف إضافي"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          {ADMIN_TABS.map(tab => {
            const count = requests.filter(r => tab.statuses.includes(r.status)).length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs py-2">
                {tab.label} {count > 0 && <Badge variant="secondary" className="mr-1 text-[10px] h-4 px-1">{count}</Badge>}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="payment_mgmt" className="text-xs py-2">
            <BarChart3 className="w-3 h-3 ml-1" />المدفوعات
          </TabsTrigger>
        </TabsList>

        {ADMIN_TABS.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-3 mt-4">
            {requests.filter(r => tab.statuses.includes(r.status)).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">لا توجد طلبات في هذه المرحلة</div>
            ) : (
              requests.filter(r => tab.statuses.includes(r.status)).map(req => (
                <Card
                  key={req.id}
                  className={`shadow-card transition-all cursor-pointer ${selectedRequest?.id === req.id ? "border-primary" : "border-border"}`}
                  onClick={() => setSelectedRequest(req)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{getClientDisplayName(req)}</span>
                          <span className="text-xs text-muted-foreground">— {req.property_description_ar || ""}</span>
                          {req.reference_number && <span className="text-xs text-muted-foreground font-mono" dir="ltr">{req.reference_number}</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                          {req.property_city_ar && <span>📍 {req.property_city_ar}</span>}
                          {req.land_area && <span>📐 {req.land_area} م²</span>}
                          <span>📅 {formatDate(req.created_at)}</span>
                          {req.quotation_amount && <span className="text-primary font-medium">💰 {formatNumber(Number(req.quotation_amount))} <SAR /></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(req.status)}
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedRequest(req); }}>
                          <Eye className="w-3 h-3 ml-1" />عرض الطلب
                        </Button>

                        {/* Action buttons based on assignment workflow status */}
                        {req.status === "submitted" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); openPricing(req); }}>
                            <SARIcon className="w-3 h-3 ml-1" />إعداد التسعير
                          </Button>
                        )}
                        {req.status === "scope_generated" && (
                          <span className="text-xs text-muted-foreground">بانتظار اعتماد العميل</span>
                        )}
                        {req.status === "scope_approved" && (
                          <span className="text-xs text-muted-foreground">بانتظار الدفعة الأولى</span>
                        )}
                        {req.status === "first_payment_confirmed" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "data_collection_open"); }}>
                            بدء جمع البيانات
                          </Button>
                        )}
                        {req.status === "data_collection_open" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "data_collection_complete"); }}>
                            <CheckCircle className="w-3 h-3 ml-1" />اكتمال جمع البيانات
                          </Button>
                        )}
                        {req.status === "data_collection_complete" && (
                          <>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "inspection_pending"); }}>
                              إسناد معاين ميداني
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "data_validated"); }}>
                              تقييم مكتبي — تخطي المعاينة
                            </Button>
                          </>
                        )}
                        {req.status === "inspection_pending" && (
                          <span className="text-xs text-muted-foreground">بانتظار اكتمال المعاينة</span>
                        )}
                        {req.status === "inspection_completed" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "data_validated"); }}>
                            <CheckCircle className="w-3 h-3 ml-1" />تأكيد صحة البيانات
                          </Button>
                        )}
                        {req.status === "data_validated" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "analysis_complete"); }}>
                            <Brain className="w-3 h-3 ml-1" />بدء التحليل
                          </Button>
                        )}
                        {req.status === "analysis_complete" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "professional_review"); }}>
                            <Brain className="w-3 h-3 ml-1" />إحالة للحكم المهني
                          </Button>
                        )}
                        {req.status === "professional_review" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/valuation-production/${req.assignment_id || req.id}`); }}>
                            <Brain className="w-3 h-3 ml-1" />محرك التقييم
                          </Button>
                        )}
                        {req.status === "draft_report_ready" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "client_review"); }}>
                            <Send className="w-3 h-3 ml-1" />إرسال للعميل
                          </Button>
                        )}
                        {req.status === "draft_approved" && (
                          <span className="text-xs text-muted-foreground">بانتظار الدفعة النهائية</span>
                        )}
                        {req.status === "final_payment_confirmed" && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); moveToStatus(req.id, "issued"); }}>
                            <CheckCircle className="w-3 h-3 ml-1" />إصدار نهائي
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}

        {/* Payment Management Tab */}
        <TabsContent value="payment_mgmt" className="mt-4">
          <AdminPaymentDashboard />
        </TabsContent>
      </Tabs>

      {/* Pricing Dialog */}
      <Dialog open={pricingDialog} onOpenChange={setPricingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SARIcon className="w-5 h-5 text-primary" />
              إعداد عرض السعر
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* AI Suggestion */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-sm">
                <Bot className="w-4 h-4 text-primary" />
                <span>اقتراح ذكي للتسعير</span>
              </div>
              <Button size="sm" variant="outline" onClick={requestAISuggestion} disabled={aiSuggesting}>
                {aiSuggesting ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Bot className="w-3 h-3 ml-1" />}
                اقتراح AI
              </Button>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ الإجمالي (<SAR size={10} />)</Label>
                <Input
                  type="number"
                  value={pricingForm.quotationAmount}
                  onChange={e => setPricingForm(p => ({ ...p, quotationAmount: e.target.value }))}
                  placeholder="5000"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>مستوى التعقيد</Label>
                <Select value={pricingForm.complexity} onValueChange={v => setPricingForm(p => ({ ...p, complexity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">بسيط</SelectItem>
                    <SelectItem value="standard">معياري</SelectItem>
                    <SelectItem value="complex">معقد</SelectItem>
                    <SelectItem value="highly_complex">معقد جداً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المدة المتوقعة</Label>
                <Input value={pricingForm.turnaround} onChange={e => setPricingForm(p => ({ ...p, turnaround: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>هيكل الدفع</Label>
                <Select value={pricingForm.paymentStructure} onValueChange={v => setPricingForm(p => ({ ...p, paymentStructure: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">دفعة واحدة كاملة</SelectItem>
                    <SelectItem value="partial">دفعتين (مقدم + نهائي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pricingForm.paymentStructure === "partial" && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <Label>نسبة الدفعة الأولى (%)</Label>
                <Input
                  type="number"
                  value={pricingForm.firstPaymentPercentage}
                  onChange={e => setPricingForm(p => ({ ...p, firstPaymentPercentage: e.target.value }))}
                  dir="ltr"
                />
                {pricingForm.quotationAmount && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>الدفعة الأولى: {formatNumber(parseFloat(pricingForm.quotationAmount) * parseFloat(pricingForm.firstPaymentPercentage) / 100)} <SAR /></span>
                    <span>الدفعة النهائية: {formatNumber(parseFloat(pricingForm.quotationAmount) * (1 - parseFloat(pricingForm.firstPaymentPercentage) / 100))} <SAR /></span>
                  </div>
                )}
              </div>
            )}

            {/* Scope */}
            <div className="space-y-2">
              <Label>نطاق العمل (عربي)</Label>
              <Textarea
                value={pricingForm.scopeOfWorkAr}
                onChange={e => setPricingForm(p => ({ ...p, scopeOfWorkAr: e.target.value }))}
                rows={3}
                placeholder="يشمل التقييم معاينة ميدانية شاملة..."
              />
            </div>
            <div className="space-y-2">
              <Label>Scope of Work (English)</Label>
              <Textarea
                value={pricingForm.scopeOfWorkEn}
                onChange={e => setPricingForm(p => ({ ...p, scopeOfWorkEn: e.target.value }))}
                rows={3}
                dir="ltr"
                placeholder="The valuation includes a full site inspection..."
              />
            </div>
            <div className="space-y-2">
              <Label>الشروط والأحكام</Label>
              <Textarea
                value={pricingForm.termsAr}
                onChange={e => setPricingForm(p => ({ ...p, termsAr: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPricingDialog(false)}>إلغاء</Button>
            <Button onClick={sendQuotation} disabled={saving || !pricingForm.quotationAmount}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Send className="w-4 h-4 ml-1" />}
              إرسال العرض للعميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Review Dialog */}
      <Dialog open={paymentReviewDialog} onOpenChange={setPaymentReviewDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              مراجعة الإيصالات
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {payments.filter(p => p.status === "pending").map(pay => (
              <Card key={pay.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{pay.payment_type === "first" ? "الدفعة الأولى" : pay.payment_type === "final" ? "الدفعة النهائية" : "دفعة"}</span>
                    <span className="text-lg font-bold" dir="ltr">{formatNumber(Number(pay.amount))} {pay.currency}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>الملف: {pay.file_name}</p>
                    <p>التاريخ: {formatDate(pay.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => reviewPayment(pay.id, true)}>
                      <CheckCircle className="w-3 h-3 ml-1" />اعتماد
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewPayment(pay.id, false)}>
                      <XCircle className="w-3 h-3 ml-1" />رفض
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {payments.filter(p => p.status === "pending").length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد إيصالات بانتظار المراجعة</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Revision Dialog */}
      <Dialog open={revisionDialog} onOpenChange={setRevisionDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-primary" />
              مراجعات وملاحظات التقرير
            </DialogTitle>
          </DialogHeader>
          {selectedReportId && selectedAssignmentId && (
            <ReportRevisionPanel
              reportId={selectedReportId}
              assignmentId={selectedAssignmentId}
              requestId={selectedRequestId || undefined}
              isAdmin={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
