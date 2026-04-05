import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import {
  Building2, Upload, CheckCircle, Loader2, FileText,
  Clock, CreditCard, AlertTriangle, XCircle, Banknote,
} from "lucide-react";

interface ManualPaymentFlowProps {
  request: any;
  paymentStage: "first" | "final" | "full";
  onPaymentSubmitted: () => void;
  bankInfo?: {
    bankName: string;
    iban: string;
    accountHolder: string;
  };
}

const DEFAULT_BANK_INFO = {
  bankName: "البنك الأهلي السعودي",
  iban: "SA00 0000 0000 0000 0000 0000",
  accountHolder: "شركة جساس للتقييم",
};

export default function ManualPaymentFlow({
  request,
  paymentStage,
  onPaymentSubmitted,
  bankInfo = DEFAULT_BANK_INFO,
}: ManualPaymentFlowProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [transferRef, setTransferRef] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  const amount =
    paymentStage === "first"
      ? request.first_payment_amount || request.total_fees
      : paymentStage === "final"
      ? request.total_fees - (request.amount_paid || 0)
      : request.total_fees;

  const stageLabel =
    paymentStage === "first"
      ? "الدفعة الأولى"
      : paymentStage === "final"
      ? "الدفعة النهائية"
      : "الدفع الكامل";

  const handleSubmit = async () => {
    if (!proofFile) {
      toast({ title: "يرجى إرفاق إيصال التحويل", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يرجى تسجيل الدخول");

      // Upload proof file
      const ext = proofFile.name.split(".").pop();
      const filePath = `${user.id}/${request.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, proofFile);
      if (uploadErr) throw uploadErr;

      // Create payment record via edge function
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          action: "submit_manual_payment",
          requestId: request.id,
          paymentStage,
          amount,
          paymentProofPath: filePath,
          bankTransferRef: transferRef,
          clientNotes,
        },
      });
      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "✅ تم إرسال إثبات الدفع",
        description: "سيتم مراجعته من قبل الإدارة وتأكيده",
      });
      setTimeout(() => onPaymentSubmitted(), 1500);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="shadow-card border-amber-500/30">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">تم إرسال إثبات الدفع</h3>
          <p className="text-sm text-muted-foreground">
            {stageLabel} - {formatNumber(amount)} <SAR />
          </p>
          <Badge className="bg-amber-500/10 text-amber-600">بانتظار المراجعة</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Banknote className="w-4 h-4 text-primary" />
          {stageLabel} - تحويل بنكي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount */}
        <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-xs text-muted-foreground mb-1">المبلغ المطلوب</p>
          <p className="text-3xl font-bold text-primary" dir="ltr">
            {formatNumber(Number(amount))} <SAR />
          </p>
        </div>

        {/* Bank Info */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">معلومات الحساب البنكي</span>
          </div>
          {[
            { label: "اسم البنك", value: bankInfo.bankName },
            { label: "رقم الآيبان (IBAN)", value: bankInfo.iban },
            { label: "اسم صاحب الحساب", value: bankInfo.accountHolder },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium text-foreground" dir="ltr">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Transfer Reference */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            رقم مرجع التحويل (اختياري)
          </label>
          <Input
            value={transferRef}
            onChange={(e) => setTransferRef(e.target.value)}
            placeholder="مثال: TRF-123456"
            dir="ltr"
            className="text-left"
          />
        </div>

        {/* Upload Proof */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            إرفاق إيصال التحويل <span className="text-destructive">*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
          />
          <Button
            variant="outline"
            className="w-full h-20 border-dashed flex flex-col gap-1"
            onClick={() => fileRef.current?.click()}
          >
            {proofFile ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-xs text-foreground">{proofFile.name}</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  اضغط لرفع الإيصال (صورة أو PDF)
                </span>
              </>
            )}
          </Button>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">ملاحظات (اختياري)</label>
          <Textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            placeholder="أي ملاحظات إضافية..."
            rows={2}
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={handleSubmit}
          disabled={uploading || !proofFile}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
          ) : (
            <FileText className="w-5 h-5 ml-2" />
          )}
          إرسال إثبات الدفع
        </Button>

        {/* Online payment coming soon */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground">
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>الدفع الإلكتروني (مدى، فيزا، آبل باي) قريباً</span>
        </div>
      </CardContent>
    </Card>
  );
}
