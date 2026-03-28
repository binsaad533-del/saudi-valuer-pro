import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, CheckCircle, XCircle, Loader2, RefreshCw,
  AlertTriangle, Clock, Shield,
} from "lucide-react";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-provider";

interface PaymentCheckoutProps {
  request: any;
  paymentStage: "first" | "final" | "full";
  onPaymentComplete: () => void;
}

export default function PaymentCheckout({ request, paymentStage, onPaymentComplete }: PaymentCheckoutProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mada");
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  const amount = paymentStage === "first"
    ? request.first_payment_amount || request.total_fees
    : paymentStage === "final"
    ? (request.total_fees - (request.amount_paid || 0))
    : request.total_fees;

  const stageLabel = paymentStage === "first" ? "الدفعة الأولى" : paymentStage === "final" ? "الدفعة النهائية" : "الدفع الكامل";

  const handlePayment = async (scenario?: "success" | "failed" | "pending") => {
    setProcessing(true);
    setPaymentResult(null);
    try {
      // Step 1: Create payment
      const { data: createResult, error: createErr } = await supabase.functions.invoke("process-payment", {
        body: {
          action: "create_payment",
          requestId: request.id,
          paymentStage,
          paymentMethod: selectedMethod,
          amount,
        },
      });

      if (createErr) throw new Error(createErr.message);
      if (!createResult?.payment?.id) throw new Error("Failed to create payment");

      const paymentId = createResult.payment.id;
      setCurrentPaymentId(paymentId);

      // Step 2: Simulate payment result (mock mode)
      const simScenario = scenario || "success";
      const { data: simResult, error: simErr } = await supabase.functions.invoke("process-payment", {
        body: {
          action: "simulate_payment",
          paymentId,
          scenario: simScenario,
        },
      });

      if (simErr) throw new Error(simErr.message);

      if (simResult?.status === "paid") {
        setPaymentResult("success");
        toast({ title: "✅ تم الدفع بنجاح", description: `تم دفع ${amount.toLocaleString()} ر.س - ${stageLabel}` });
        setTimeout(() => onPaymentComplete(), 1500);
      } else if (simResult?.status === "failed") {
        setPaymentResult("failed");
        toast({ title: "❌ فشل الدفع", description: "يرجى المحاولة مرة أخرى", variant: "destructive" });
      } else {
        toast({ title: "⏳ الدفع قيد المعالجة", description: "سيتم تحديث الحالة تلقائياً" });
        setTimeout(() => onPaymentComplete(), 1500);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setPaymentResult("failed");
    } finally {
      setProcessing(false);
    }
  };

  if (paymentResult === "success") {
    return (
      <Card className="shadow-card border-green-500/30">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">تم الدفع بنجاح</h3>
          <p className="text-sm text-muted-foreground">{stageLabel} - {amount.toLocaleString()} ر.س</p>
          <Badge className="bg-green-500/10 text-green-600">تم التأكيد</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          {stageLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount display */}
        <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-xs text-muted-foreground mb-1">المبلغ المطلوب</p>
          <p className="text-3xl font-bold text-primary" dir="ltr">
            {Number(amount).toLocaleString()} <span className="text-sm">ر.س</span>
          </p>
        </div>

        {/* Mock mode indicator */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>وضع تجريبي - لا يتم خصم مبالغ حقيقية</span>
        </div>

        {/* Payment method selection */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">اختر وسيلة الدفع:</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => setSelectedMethod(method.value)}
                className={`p-3 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 justify-center ${
                  selectedMethod === method.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/30"
                }`}
              >
                <span>{method.icon}</span>
                <span>{method.labelAr}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pay button */}
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={() => handlePayment("success")}
          disabled={processing}
        >
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
          ) : (
            <Shield className="w-5 h-5 ml-2" />
          )}
          ادفع الآن - {Number(amount).toLocaleString()} ر.س
        </Button>

        {/* Retry if failed */}
        {paymentResult === "failed" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-xs text-destructive">
              <XCircle className="w-3 h-3 shrink-0" />
              <span>فشل الدفع - يرجى المحاولة مرة أخرى</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setPaymentResult(null); handlePayment("success"); }}>
              <RefreshCw className="w-4 h-4 ml-1" />إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Simulation buttons (test mode) */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] text-muted-foreground text-center">أزرار المحاكاة (للاختبار فقط)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handlePayment("success")} disabled={processing}>
              <CheckCircle className="w-3 h-3 ml-1 text-green-500" />نجاح
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handlePayment("failed")} disabled={processing}>
              <XCircle className="w-3 h-3 ml-1 text-destructive" />فشل
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handlePayment("pending")} disabled={processing}>
              <Clock className="w-3 h-3 ml-1 text-amber-500" />معلق
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
