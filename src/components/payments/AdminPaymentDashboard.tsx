import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import {
  CreditCard, CheckCircle, XCircle, Clock, Loader2, Eye, Shield,
  AlertTriangle, FileText,
} from "lucide-react";
import { SAR } from "@/components/ui/saudi-riyal";
import PaymentProofReview from "./PaymentProofReview";

export default function AdminPaymentDashboard() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState("paid");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [payRes, logRes] = await Promise.all([
      supabase.from("payments" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("payment_webhook_logs" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setPayments(payRes.data || []);
    setWebhookLogs(logRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleOverride = async () => {
    if (!selectedPayment) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("process-payment", {
        body: {
          action: "admin_override",
          paymentId: selectedPayment.id,
          newStatus: overrideStatus,
          notes: overrideNotes,
        },
      });
      if (error) throw error;
      toast({ title: "تم تحديث حالة الدفع" });
      setOverrideDialog(false);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      paid: { label: "مدفوع", className: "bg-green-500/10 text-green-600" },
      failed: { label: "فشل", className: "bg-destructive/10 text-destructive" },
      pending: { label: "معلق", className: "bg-amber-500/10 text-amber-600" },
      cancelled: { label: "ملغي", className: "bg-muted text-muted-foreground" },
      refunded: { label: "مسترد", className: "bg-blue-500/10 text-blue-600" },
      manual_review: { label: "مراجعة يدوية", className: "bg-purple-500/10 text-purple-600" },
    };
    const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.payment_status === "paid").length,
    pending: payments.filter(p => p.payment_status === "pending").length,
    failed: payments.filter(p => p.payment_status === "failed").length,
    totalAmount: payments.filter(p => p.payment_status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0),
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "إجمالي العمليات", value: stats.total, icon: CreditCard, color: "text-primary" },
          { label: "مدفوعة", value: stats.paid, icon: CheckCircle, color: "text-green-500" },
          { label: "معلقة", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "فاشلة", value: stats.failed, icon: XCircle, color: "text-destructive" },
          { label: "إجمالي المحصل", value: formatNumber(stats.totalAmount), icon: Shield, color: "text-primary", hasCurrency: true },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4 flex items-center justify-between">
              <s.icon className={`w-6 h-6 ${s.color} opacity-60`} />
              <div className="text-left">
                <p className="text-lg font-bold text-foreground inline-flex items-center gap-1">{s.value} {(s as any).hasCurrency && <SAR size={14} />}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="review" dir="rtl">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="review">مراجعة الإيصالات</TabsTrigger>
          <TabsTrigger value="all">الكل ({payments.length})</TabsTrigger>
          <TabsTrigger value="pending">معلقة ({stats.pending})</TabsTrigger>
          <TabsTrigger value="paid">مدفوعة ({stats.paid})</TabsTrigger>
          <TabsTrigger value="logs">سجل ({webhookLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4">
          <PaymentProofReview />
        </TabsContent>

        {["all", "pending", "paid"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {payments
              .filter(p => tab === "all" || p.payment_status === tab)
              .map(pay => (
                <Card key={pay.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm" dir="ltr">{formatNumber(Number(pay.amount))} {pay.currency}</span>
                          {pay.is_mock && <Badge variant="secondary" className="text-[10px] h-4">تجريبي</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>المرحلة: {pay.payment_stage === "first" ? "أولى" : pay.payment_stage === "final" ? "نهائية" : "كاملة"}</span>
                          <span>الوسيلة: {pay.payment_method || "-"}</span>
                          <span>البوابة: {pay.gateway_name}</span>
                          <span>{formatDate(pay.created_at)}</span>
                          {pay.transaction_id && <span className="font-mono text-[10px]" dir="ltr">{pay.transaction_id.slice(0, 20)}...</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(pay.payment_status)}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPayment(pay);
                            setOverrideStatus(pay.payment_status);
                            setOverrideNotes("");
                            setOverrideDialog(true);
                          }}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            {payments.filter(p => tab === "all" || p.payment_status === tab).length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">لا توجد عمليات دفع</div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="logs" className="space-y-3 mt-4">
          {webhookLogs.map(log => (
            <Card key={log.id} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{log.event_type}</span>
                      <Badge variant="secondary" className={`text-[10px] ${log.processed ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                        {log.processed ? "تمت المعالجة" : "لم تتم المعالجة"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{formatDateTime(log.created_at)}</span>
                      {log.processing_result && <span className="mr-3">{log.processing_result}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {webhookLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">لا توجد سجلات webhook</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Override Dialog */}
      <Dialog open={overrideDialog} onOpenChange={setOverrideDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              تفاصيل الدفع والتحكم اليدوي
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">المبلغ</p>
                  <p className="font-bold" dir="ltr">{formatNumber(Number(selectedPayment.amount))} {selectedPayment.currency}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">الحالة الحالية</p>
                  {getStatusBadge(selectedPayment.payment_status)}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">المرحلة</p>
                  <p>{selectedPayment.payment_stage}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">رقم العملية</p>
                  <p className="text-[10px] font-mono" dir="ltr">{selectedPayment.transaction_id}</p>
                </div>
              </div>

              {selectedPayment.gateway_response_json && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">استجابة البوابة</p>
                  <pre className="text-[10px] text-muted-foreground overflow-x-auto" dir="ltr">
                    {JSON.stringify(selectedPayment.gateway_response_json, null, 2)}
                  </pre>
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>تحكم يدوي - للمسؤولين فقط</span>
                </div>
                <div className="space-y-2">
                  <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">مدفوع</SelectItem>
                      <SelectItem value="failed">فشل</SelectItem>
                      <SelectItem value="pending">معلق</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                      <SelectItem value="refunded">مسترد</SelectItem>
                      <SelectItem value="manual_review">مراجعة يدوية</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={overrideNotes}
                    onChange={e => setOverrideNotes(e.target.value)}
                    placeholder="ملاحظات التعديل اليدوي..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOverrideDialog(false)}>إلغاء</Button>
            <Button onClick={handleOverride} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Shield className="w-4 h-4 ml-1" />}
              تحديث الحالة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
