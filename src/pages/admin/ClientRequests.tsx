import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Loader2, FileText, CreditCard, Eye, CheckCircle, XCircle, Send,
  Clock, AlertCircle, Building2, DollarSign, Bot, Brain, BarChart3, MessageSquareText,
} from "lucide-react";
import AdminPaymentDashboard from "@/components/payments/AdminPaymentDashboard";
import ReportRevisionPanel from "@/components/reports/ReportRevisionPanel";
import { StatusBadge, StatusTransitionButton } from "@/components/workflow/StatusComponents";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  STATUS_LABELS as WF_STATUS_LABELS,
  STATUS_COLORS,
  PIPELINE_PHASES,
} from "@/lib/workflow-engine";
import { SAR } from "@/components/ui/saudi-riyal";

const STATUS_LABELS: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(WF_STATUS_LABELS).map(([k, v]) => [k, { label: v.ar, color: STATUS_COLORS[k] || "bg-muted text-muted-foreground" }])
);

const ADMIN_TABS = [
  { value: "intake", label: "الاستقبال", statuses: ["draft", "client_submitted", "under_ai_review", "awaiting_client_info"] },
  { value: "pricing", label: "التسعير", statuses: ["priced", "awaiting_payment_initial", "payment_received_initial"] },
  { value: "inspection", label: "المعاينة", statuses: ["inspection_required", "inspection_assigned", "inspection_in_progress", "inspection_submitted"] },
  { value: "valuation", label: "التقييم والتقرير", statuses: ["valuation_in_progress", "draft_report_ready", "under_client_review", "revision_in_progress"] },
  { value: "final", label: "الإصدار", statuses: ["awaiting_final_payment", "final_payment_received", "report_issued", "closed"] },
];

export default function ClientRequests() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [pricingDialog, setPricingDialog] = useState(false);
  const [paymentReviewDialog, setPaymentReviewDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
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

  const loadRequests = async () => {
    const { data } = await supabase
      .from("valuation_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
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

      await supabase.from("valuation_requests" as any).update({
        status: "quotation_sent" as any,
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
      const updateData: any = { status: newStatus as any };
      if (newStatus === "in_production") updateData.production_started_at = new Date().toISOString();
      if (newStatus === "completed") updateData.completed_at = new Date().toISOString();

      await supabase.from("valuation_requests" as any).update(updateData).eq("id", reqId);
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

        let newStatus = req.status;
        let paymentStatus = "partially_paid";

        if (isFullyPaid) {
          paymentStatus = "fully_paid";
          if (req.status === "final_payment_pending" || req.status === "final_payment_uploaded") {
            newStatus = "final_report_ready";
          } else {
            newStatus = "fully_paid";
          }
        } else if (isFirstPayment) {
          newStatus = "in_production";
          paymentStatus = "partially_paid";
        }

        await supabase.from("valuation_requests" as any).update({
          status: newStatus as any,
          amount_paid: totalPaid,
          payment_status: paymentStatus,
          ...(newStatus === "in_production" ? { production_started_at: new Date().toISOString() } : {}),
        } as any).eq("id", req.id);
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

      <Tabs defaultValue="new" dir="rtl">
        <TabsList className="grid w-full grid-cols-7 h-auto">
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
                <Card key={req.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{req.property_description_ar || "طلب تقييم"}</span>
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

                        {/* Action buttons based on status */}
                        {req.status === "submitted" && (
                          <Button size="sm" onClick={() => { moveToStatus(req.id, "under_pricing"); }}>
                            <DollarSign className="w-3 h-3 ml-1" />تسعير
                          </Button>
                        )}
                        {req.status === "under_pricing" && (
                          <Button size="sm" onClick={() => openPricing(req)}>
                            <Send className="w-3 h-3 ml-1" />إعداد العرض
                          </Button>
                        )}
                        {(req.status === "payment_uploaded" || req.status === "final_payment_uploaded") && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            setSelectedRequest(req);
                            await loadPayments(req.id);
                            setPaymentReviewDialog(true);
                          }}>
                            <Eye className="w-3 h-3 ml-1" />مراجعة الإيصال
                          </Button>
                        )}
                        {req.status === "in_production" && (
                          <Button size="sm" onClick={() => navigate(`/valuation-production/${req.assignment_id || req.id}`)}>
                            <Brain className="w-3 h-3 ml-1" />محرك التقييم
                          </Button>
                        )}
                        {(req.status === "draft_report_sent" || req.status === "client_comments") && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            // Load report for this assignment
                            const { data: reps } = await supabase.from("reports" as any).select("*").eq("assignment_id", req.assignment_id).order("created_at", { ascending: false }).limit(1);
                            const report = (reps as any[])?.[0];
                            if (report) {
                              setSelectedReportId(report.id);
                              setSelectedAssignmentId(req.assignment_id);
                              setSelectedRequestId(req.id);
                              setRevisionDialog(true);
                            }
                          }}>
                            <MessageSquareText className="w-3 h-3 ml-1" />المراجعات
                          </Button>
                        )}
                        {req.status === "fully_paid" && !req.draft_report_url && (
                          <Button size="sm" onClick={() => moveToStatus(req.id, "in_production")}>
                            بدء الإنتاج
                          </Button>
                        )}
                        {req.status === "final_report_ready" && (
                          <Button size="sm" onClick={() => moveToStatus(req.id, "completed")}>
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
              <DollarSign className="w-5 h-5 text-primary" />
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
                <Label>المبلغ الإجمالي (ر.س)</Label>
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
