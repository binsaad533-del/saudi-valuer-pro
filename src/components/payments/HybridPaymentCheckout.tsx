import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import ManualPaymentFlow from "./ManualPaymentFlow";
import {
  CreditCard, CheckCircle, XCircle, Loader2,
  Banknote, Wifi, WifiOff, ArrowLeft,
} from "lucide-react";

interface HybridPaymentCheckoutProps {
  request: any;
  paymentStage: "first" | "final" | "full";
  onPaymentComplete: () => void;
}

type PaymentMode = "select" | "manual" | "online";

export default function HybridPaymentCheckout({
  request,
  paymentStage,
  onPaymentComplete,
}: HybridPaymentCheckoutProps) {
  const { toast } = useToast();
  const [gatewayActive, setGatewayActive] = useState(false);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [mode, setMode] = useState<PaymentMode>("select");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [_scriptUrl, setScriptUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [checkingResult, setCheckingResult] = useState(false);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | null>(null);

  const amount =
    paymentStage === "first"
      ? request.first_payment_amount || request.total_fees
      : paymentStage === "final"
      ? request.total_fees - (request.amount_paid || 0)
      : request.total_fees;

  const stageLabel =
    paymentStage === "first" ? "الدفعة الأولى" : paymentStage === "final" ? "الدفعة النهائية" : "الدفع الكامل";

  // Check if gateway is active
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke("hyperpay-checkout", {
          body: { action: "check_gateway_status" },
        });
        setGatewayActive(data?.isActive && data?.hasAccessToken && data?.hasEntityId);
      } catch {
        setGatewayActive(false);
      }
      setGatewayLoading(false);
    };
    check();
  }, []);

  // Prepare HyperPay checkout
  const prepareCheckout = async () => {
    setPreparing(true);
    try {
      const { data, error } = await supabase.functions.invoke("hyperpay-checkout", {
        body: {
          action: "prepare_checkout",
          requestId: request.id,
          paymentStage,
          amount,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.checkoutId) throw new Error("فشل في إعداد صفحة الدفع");

      setCheckoutId(data.checkoutId);
      setPaymentId(data.paymentId);
      setScriptUrl(data.scriptUrl);

      // Load HyperPay widget script
      const script = document.createElement("script");
      script.src = data.scriptUrl;
      script.async = true;
      document.body.appendChild(script);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setPreparing(false);
    }
  };

  // Check payment result after return from HyperPay
  const checkPaymentResult = useCallback(async () => {
    if (!checkoutId || !paymentId) return;
    setCheckingResult(true);
    try {
      const { data } = await supabase.functions.invoke("hyperpay-checkout", {
        body: {
          action: "get_payment_status",
          checkoutId,
          paymentId,
        },
      });
      if (data?.status === "paid") {
        setPaymentResult("success");
        toast({ title: "✅ تم الدفع بنجاح" });
        setTimeout(() => onPaymentComplete(), 1500);
      } else if (data?.status === "failed") {
        setPaymentResult("failed");
        toast({ title: "❌ فشل الدفع", variant: "destructive" });
      }
    } catch {
      // silent
    } finally {
      setCheckingResult(false);
    }
  }, [checkoutId, paymentId, onPaymentComplete, toast]);

  // Payment success screen
  if (paymentResult === "success") {
    return (
      <Card className="shadow-card border-green-500/30">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">تم الدفع بنجاح</h3>
          <p className="text-sm text-muted-foreground">{stageLabel} - {formatNumber(amount)} <SAR /></p>
          <Badge className="bg-green-500/10 text-green-600">تم التأكيد</Badge>
        </CardContent>
      </Card>
    );
  }

  // Mode selection
  if (mode === "select") {
    return (
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            {stageLabel}
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

          {gatewayLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">اختر طريقة الدفع:</p>

              {/* Manual payment */}
              <button
                onClick={() => setMode("manual")}
                className="w-full p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all text-right flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">تحويل بنكي</p>
                  <p className="text-xs text-muted-foreground">تحويل عبر الحساب البنكي ورفع الإيصال</p>
                </div>
                <Badge className="bg-green-500/10 text-green-600 text-[10px]">متاح</Badge>
              </button>

              {/* Online payment */}
              <button
                onClick={() => {
                  if (gatewayActive) {
                    setMode("online");
                    prepareCheckout();
                  }
                }}
                disabled={!gatewayActive}
                className={`w-full p-4 rounded-lg border transition-all text-right flex items-center gap-3 ${
                  gatewayActive
                    ? "border-border bg-card hover:border-primary/30 cursor-pointer"
                    : "border-border/50 bg-muted/30 cursor-not-allowed opacity-60"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${gatewayActive ? "bg-primary/10" : "bg-muted"}`}>
                  {gatewayActive ? (
                    <Wifi className="w-5 h-5 text-primary" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">دفع إلكتروني</p>
                  <p className="text-xs text-muted-foreground">مدى • فيزا • ماستركارد • آبل باي</p>
                </div>
                <Badge className={gatewayActive ? "bg-green-500/10 text-green-600 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                  {gatewayActive ? "متاح" : "قريباً"}
                </Badge>
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Manual payment mode
  if (mode === "manual") {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Button>
        <ManualPaymentFlow
          request={request}
          paymentStage={paymentStage}
          onPaymentSubmitted={onPaymentComplete}
        />
      </div>
    );
  }

  // Online payment mode (HyperPay widget)
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => { setMode("select"); setCheckoutId(null); }} className="gap-1">
        <ArrowLeft className="w-4 h-4" />
        رجوع
      </Button>
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            الدفع الإلكتروني - {stageLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Amount */}
          <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-2xl font-bold text-primary" dir="ltr">
              {formatNumber(Number(amount))} <SAR />
            </p>
          </div>

          {preparing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري إعداد صفحة الدفع...</p>
            </div>
          ) : checkoutId ? (
            <div className="space-y-4">
              {/* HyperPay COPYandPay form placeholder */}
              <div id="hyperpay-payment-form" className="min-h-[200px]">
                <form
                  action={`${window.location.origin}/client/payment-result?paymentId=${paymentId}`}
                  className="paymentWidgets"
                  data-brands="MADA VISA MASTER APPLEPAY"
                />
              </div>

              {/* Manual result check */}
              <div className="border-t border-border pt-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={checkPaymentResult}
                  disabled={checkingResult}
                >
                  {checkingResult ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-1" />
                  ) : (
                    <CheckCircle className="w-4 h-4 ml-1" />
                  )}
                  التحقق من حالة الدفع
                </Button>
              </div>

              {paymentResult === "failed" && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-xs text-destructive">
                  <XCircle className="w-3 h-3 shrink-0" />
                  <span>فشل الدفع - يرجى المحاولة مرة أخرى</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              فشل في تحميل بوابة الدفع
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
