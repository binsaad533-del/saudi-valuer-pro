import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import {
  CheckCircle, XCircle, Clock, Loader2, Eye,
  FileText, ImageIcon, Download, AlertTriangle,
} from "lucide-react";

export default function PaymentProofReview() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const loadPayments = async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("payment_type", "manual")
      .in("payment_status", ["payment_submitted", "pending"])
      .order("created_at", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPayments(); }, []);

  const openReview = async (payment: any) => {
    setSelected(payment);
    setReviewNotes("");
    setProofUrl(null);
    setReviewDialog(true);

    if (payment.payment_proof_path) {
      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(payment.payment_proof_path, 3600);
      if (data?.signedUrl) setProofUrl(data.signedUrl);
    }
  };


  const selectedHasProof = selected?.payment_proof_path?.trim();

  const handleDecision = async (decision: "paid" | "rejected") => {
    if (!selected) return;
    // HARD GATE: prevent confirmation without proof
    if (decision === "paid" && !selectedHasProof) {
      toast({
        title: "إثبات السداد مطلوب",
        description: "لا يمكن تأكيد الدفعة بدون إثبات سداد مرفق.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("process-payment", {
        body: {
          action: "review_manual_payment",
          paymentId: selected.id,
          decision,
          reviewNotes,
        },
      });
      if (error) throw error;
      toast({
        title: decision === "paid" ? "✅ تم تأكيد الدفع" : "❌ تم رفض الدفع",
      });
      setReviewDialog(false);
      loadPayments();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        لا توجد مدفوعات بانتظار المراجعة
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {payments.map((pay) => (
          <Card key={pay.id} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-sm">
                      {formatNumber(Number(pay.amount))} <SAR />
                    </span>
                    <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">
                      <Clock className="w-3 h-3 ml-1" />
                      بانتظار المراجعة
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {pay.bank_transfer_ref && <span>مرجع: {pay.bank_transfer_ref}</span>}
                    <span>{formatDate(pay.created_at)}</span>
              {pay.payment_proof_path ? (
                <span className="text-primary">📎 إيصال مرفق</span>
              ) : (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  لا يوجد إثبات
                </span>
              )}
                  </div>
                  {pay.client_notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      ملاحظة العميل: {pay.client_notes}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => openReview(pay)}>
                  <Eye className="w-3.5 h-3.5 ml-1" />
                  مراجعة
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              مراجعة إثبات الدفع
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">المبلغ</p>
                  <p className="font-bold" dir="ltr">
                    {formatNumber(Number(selected.amount))} <SAR />
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">مرجع التحويل</p>
                  <p className="font-medium">{selected.bank_transfer_ref || "-"}</p>
                </div>
              </div>

              {selected.client_notes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظة العميل</p>
                  <p className="text-sm">{selected.client_notes}</p>
                </div>
              )}

              {/* Proof Preview */}
              {proofUrl ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">إيصال التحويل:</p>
                  {selected.payment_proof_path?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                    <img
                      src={proofUrl}
                      alt="إيصال الدفع"
                      className="w-full max-h-64 object-contain rounded-lg border border-border"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="text-sm">ملف مرفق</span>
                    </div>
                  )}
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    تحميل الملف
                  </a>
                </div>
              ) : selected.payment_proof_path ? (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                  <ImageIcon className="w-4 h-4" />
                  جاري تحميل الإيصال...
                </div>
              ) : null}

              {/* Hard Gate Warning */}
              {!selectedHasProof && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  إثبات السداد مطلوب قبل التأكيد — لا يمكن اعتماد الدفعة بدون مرفق.
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ملاحظات المراجعة</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="ملاحظات حول قرار المراجعة..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDecision("rejected")}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <XCircle className="w-4 h-4 ml-1" />}
              رفض
            </Button>
            <Button onClick={() => handleDecision("paid")} disabled={saving || !selectedHasProof}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
