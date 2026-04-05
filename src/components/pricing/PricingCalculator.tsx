import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateDiscountCode, getCommercialSettings, type DiscountValidation } from "@/lib/commercial-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CurrencyDisplay } from "@/components/ui/saudi-riyal";
import {
  Calculator, Ticket, Lock, Unlock, CheckCircle, XCircle, AlertTriangle, Loader2, Save,
} from "lucide-react";
import { toast } from "sonner";

interface PricingRule {
  id: string;
  service_type: string;
  subcategory: string | null;
  label_ar: string;
  base_fee: number;
  inspection_fee: number;
  income_analysis_fee: number;
  per_unit_fee: number;
  surcharge_percentage: number;
  auto_discount_percentage: number;
  tier_min_units: number;
  tier_max_units: number | null;
}

interface PricingCalculatorProps {
  assignmentId: string;
  serviceType: string;
  subcategory?: string;
  unitCount?: number;
  clientId?: string;
  includeInspection?: boolean;
  includeIncomeAnalysis?: boolean;
  isOwner?: boolean;
  onPricingConfirmed?: (pricing: {
    subtotal: number;
    discountAmount: number;
    discountCodeId: string | null;
    vatAmount: number;
    totalAmount: number;
    isOverridden: boolean;
  }) => void;
}

export default function PricingCalculator({
  assignmentId,
  serviceType,
  subcategory,
  unitCount = 1,
  clientId,
  includeInspection = true,
  includeIncomeAnalysis = false,
  isOwner = false,
  onPricingConfirmed,
}: PricingCalculatorProps) {
  const [rule, setRule] = useState<PricingRule | null>(null);
  const [vatPct, setVatPct] = useState(15);
  const [loading, setLoading] = useState(true);

  // Calculated
  const [baseFee, setBaseFee] = useState(0);
  const [inspectionFee, setInspectionFee] = useState(0);
  const [incomeAnalysisFee, setIncomeAnalysisFee] = useState(0);
  const [perUnitTotal, setPerUnitTotal] = useState(0);
  const [surchargeAmount, setSurchargeAmount] = useState(0);
  const [autoDiscountAmount, setAutoDiscountAmount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);

  // Discount code
  const [discountCode, setDiscountCode] = useState("");
  const [discountValidation, setDiscountValidation] = useState<DiscountValidation | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null);

  // Override
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");

  // Final
  const [vatAmount, setVatAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadPricing();
  }, [serviceType, subcategory]);

  const loadPricing = async () => {
    const [ruleRes, settings] = await Promise.all([
      supabase
        .from("pricing_rules" as any)
        .select("*")
        .eq("service_type", serviceType)
        .eq("is_active", true)
        .order("sort_order"),
      getCommercialSettings(),
    ]);

    const allRules = (ruleRes.data as unknown as PricingRule[]) || [];
    // Pick matching subcategory or best tier
    let matched = subcategory
      ? allRules.find((r) => r.subcategory === subcategory)
      : null;

    // For machinery, pick by unit count
    if (!matched && serviceType === "machinery") {
      matched = allRules.find(
        (r) =>
          unitCount >= r.tier_min_units &&
          (r.tier_max_units === null || unitCount <= r.tier_max_units)
      );
    }

    if (!matched) matched = allRules[0] || null;

    setRule(matched);
    setVatPct(settings.vat_percentage);
    setLoading(false);
  };

  // Recalculate whenever inputs change
  const recalculate = useCallback(() => {
    if (!rule) return;

    const bf = rule.base_fee;
    const insp = includeInspection ? rule.inspection_fee : 0;
    const inc = includeIncomeAnalysis ? rule.income_analysis_fee : 0;
    const perUnit = unitCount > 1 ? (unitCount - 1) * rule.per_unit_fee : 0;

    const rawSubtotal = bf + insp + inc + perUnit;
    const surcharge = rule.surcharge_percentage > 0 ? Math.round(rawSubtotal * rule.surcharge_percentage / 100) : 0;
    const autoDisc = rule.auto_discount_percentage > 0 ? Math.round(rawSubtotal * rule.auto_discount_percentage / 100) : 0;

    const sub = rawSubtotal + surcharge - autoDisc;

    setBaseFee(bf);
    setInspectionFee(insp);
    setIncomeAnalysisFee(inc);
    setPerUnitTotal(perUnit);
    setSurchargeAmount(surcharge);
    setAutoDiscountAmount(autoDisc);
    setSubtotal(sub);

    // Apply discount
    const afterDiscount = sub - discountAmount;
    const finalBase = overrideEnabled ? overrideAmount : afterDiscount;
    const vat = Math.round(finalBase * vatPct / 100);
    const total = finalBase + vat;

    setVatAmount(vat);
    setTotalAmount(total);
  }, [rule, includeInspection, includeIncomeAnalysis, unitCount, discountAmount, overrideEnabled, overrideAmount, vatPct]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) return;
    setValidatingDiscount(true);
    const result = await validateDiscountCode(discountCode, clientId, serviceType, subtotal);
    setDiscountValidation(result);
    if (result.is_valid) {
      setDiscountAmount(result.calculated_discount);
      setDiscountCodeId(result.discount_id);
    } else {
      setDiscountAmount(0);
      setDiscountCodeId(null);
    }
    setValidatingDiscount(false);
  };

  const handleConfirm = async () => {
    // If override, log it
    if (overrideEnabled && isOwner) {
      await supabase.from("price_overrides" as any).insert({
        assignment_id: assignmentId,
        original_amount: subtotal - discountAmount,
        override_amount: overrideAmount,
        reason_ar: overrideReason || null,
        override_by: (await supabase.auth.getUser()).data.user?.id,
      } as any);
    }

    onPricingConfirmed?.({
      subtotal,
      discountAmount,
      discountCodeId,
      vatAmount,
      totalAmount,
      isOverridden: overrideEnabled,
    });

    toast.success("تم تأكيد التسعير");
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!rule) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
          لا توجد قاعدة تسعير لهذا النوع من الخدمة
        </CardContent>
      </Card>
    );
  }

  const afterDiscount = subtotal - discountAmount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          حاسبة التسعير — {rule.label_ar}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">الرسوم الأساسية</span>
            <CurrencyDisplay amount={baseFee} />
          </div>
          {inspectionFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم المعاينة</span>
              <CurrencyDisplay amount={inspectionFee} />
            </div>
          )}
          {incomeAnalysisFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">تحليل الدخل</span>
              <CurrencyDisplay amount={incomeAnalysisFee} />
            </div>
          )}
          {perUnitTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم وحدات إضافية ({unitCount - 1} × <CurrencyDisplay amount={rule.per_unit_fee} />)</span>
              <CurrencyDisplay amount={perUnitTotal} />
            </div>
          )}
          {surchargeAmount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>رسوم إضافية (+{rule.surcharge_percentage}%)</span>
              <span>+<CurrencyDisplay amount={surchargeAmount} /></span>
            </div>
          )}
          {autoDiscountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>خصم تلقائي (-{rule.auto_discount_percentage}%)</span>
              <span>-<CurrencyDisplay amount={autoDiscountAmount} /></span>
            </div>
          )}

          <Separator />
          <div className="flex justify-between font-semibold">
            <span>المجموع الفرعي</span>
            <CurrencyDisplay amount={subtotal} />
          </div>
        </div>

        {/* Discount Code */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5" />
            كود خصم
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="أدخل كود الخصم"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidateDiscount}
              disabled={validatingDiscount || !discountCode.trim()}
            >
              {validatingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : "تحقق"}
            </Button>
          </div>
          {discountValidation && (
            <div className={`flex items-center gap-1.5 text-xs ${discountValidation.is_valid ? "text-emerald-600" : "text-destructive"}`}>
              {discountValidation.is_valid ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {discountValidation.is_valid
                ? `خصم ${discountValidation.discount_type === "percentage" ? discountValidation.discount_value + "%" : ""} = -${discountValidation.calculated_discount} ر.س`
                : discountValidation.rejection_reason}
            </div>
          )}
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-destructive">
            <span>الخصم</span>
            <span>-<CurrencyDisplay amount={discountAmount} /></span>
          </div>
        )}

        {/* Manual Override (Owner Only) */}
        {isOwner && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  {overrideEnabled ? <Unlock className="w-3.5 h-3.5 text-amber-500" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  تعديل السعر يدوياً
                </Label>
                <Button
                  variant={overrideEnabled ? "destructive" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setOverrideEnabled(!overrideEnabled);
                    if (!overrideEnabled) setOverrideAmount(afterDiscount);
                  }}
                >
                  {overrideEnabled ? "إلغاء التعديل" : "تعديل يدوي"}
                </Button>
              </div>

              {overrideEnabled && (
                <div className="space-y-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">السعر المحسوب:</span>
                    <CurrencyDisplay amount={afterDiscount} className="text-xs line-through text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">السعر المعدّل</Label>
                    <Input
                      type="number"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">سبب التعديل (اختياري)</Label>
                    <Textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="مثال: خصم خاص للعميل المميز..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Final Total */}
        <Separator />
        <div className="space-y-2">
          {overrideEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المبلغ بعد التعديل</span>
              <CurrencyDisplay amount={overrideAmount} className="text-amber-600 font-semibold" />
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ضريبة القيمة المضافة ({vatPct}%)</span>
            <CurrencyDisplay amount={vatAmount} />
          </div>
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>الإجمالي النهائي</span>
            <CurrencyDisplay amount={totalAmount} className="text-primary" />
          </div>
        </div>

        {onPricingConfirmed && (
          <Button onClick={handleConfirm} className="w-full gap-1.5">
            <Save className="w-4 h-4" />
            تأكيد التسعير
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
