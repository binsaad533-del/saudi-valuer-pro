import { supabase } from "@/integrations/supabase/client";

/* ── Types ─────────────────────────────────────────── */

export interface PricingRule {
  id: string;
  service_type: string;
  label_ar: string;
  label_en: string | null;
  base_fee: number;
  inspection_fee: number;
  complexity_multiplier: number;
  income_analysis_fee: number;
  description_ar: string | null;
  is_active: boolean;
}

export interface PricingBreakdown {
  baseFee: number;
  inspectionFee: number;
  incomeAnalysisFee: number;
  complexityMultiplier: number;
  subtotal: number;
  discountAmount: number;
  discountCodeId: string | null;
  vatPercentage: number;
  vatAmount: number;
  totalAmount: number;
}

export interface DiscountValidation {
  is_valid: boolean;
  discount_id: string | null;
  discount_type: string | null;
  discount_value: number;
  calculated_discount: number;
  rejection_reason: string | null;
}

export interface CommercialSettings {
  report_release_policy: "anytime" | "require_payment" | "require_approval";
  vat_percentage: number;
  allow_partial_payment: boolean;
  default_payment_terms_ar: string;
  default_validity_days: number;
}

/* ── Pricing ───────────────────────────────────────── */

export async function getPricingRules(): Promise<PricingRule[]> {
  const { data } = await supabase
    .from("pricing_rules" as any)
    .select("*")
    .eq("is_active", true)
    .order("service_type");
  return (data as PricingRule[]) || [];
}

export async function calculatePricing(
  serviceType: string,
  options: {
    includeInspection?: boolean;
    includeIncomeAnalysis?: boolean;
    complexityLevel?: number; // 1-3
    discountCode?: string;
    clientId?: string;
  } = {}
): Promise<PricingBreakdown> {
  // Get pricing rule
  const { data: rules } = await supabase
    .from("pricing_rules" as any)
    .select("*")
    .eq("service_type", serviceType)
    .eq("is_active", true)
    .limit(1);

  const rule = (rules as PricingRule[])?.[0];
  const baseFee = rule?.base_fee || 3500;
  const inspectionFee = options.includeInspection !== false ? (rule?.inspection_fee || 500) : 0;
  const incomeAnalysisFee = options.includeIncomeAnalysis ? (rule?.income_analysis_fee || 0) : 0;
  const complexityMultiplier = options.complexityLevel === 3 ? 1.5 : options.complexityLevel === 2 ? 1.2 : 1.0;

  const subtotal = Math.round((baseFee * complexityMultiplier) + inspectionFee + incomeAnalysisFee);

  // Get commercial settings for VAT
  const settings = await getCommercialSettings();
  const vatPct = settings.vat_percentage;

  // Validate discount
  let discountAmount = 0;
  let discountCodeId: string | null = null;

  if (options.discountCode) {
    const validation = await validateDiscountCode(
      options.discountCode,
      options.clientId,
      serviceType,
      subtotal
    );
    if (validation.is_valid) {
      discountAmount = validation.calculated_discount;
      discountCodeId = validation.discount_id;
    }
  }

  const afterDiscount = subtotal - discountAmount;
  const vatAmount = Math.round(afterDiscount * vatPct / 100);
  const totalAmount = afterDiscount + vatAmount;

  return {
    baseFee,
    inspectionFee,
    incomeAnalysisFee,
    complexityMultiplier,
    subtotal,
    discountAmount,
    discountCodeId,
    vatPercentage: vatPct,
    vatAmount,
    totalAmount,
  };
}

/* ── Discount ──────────────────────────────────────── */

export async function validateDiscountCode(
  code: string,
  clientId?: string,
  serviceType?: string,
  orderAmount: number = 0
): Promise<DiscountValidation> {
  const { data, error } = await supabase.rpc("validate_discount_code" as any, {
    _code: code.toUpperCase(),
    _client_id: clientId || null,
    _service_type: serviceType || null,
    _order_amount: orderAmount,
  });

  if (error || !data || data.length === 0) {
    return {
      is_valid: false,
      discount_id: null,
      discount_type: null,
      discount_value: 0,
      calculated_discount: 0,
      rejection_reason: error?.message || "فشل التحقق من كود الخصم",
    };
  }

  const row = data[0];
  return {
    is_valid: row.is_valid,
    discount_id: row.discount_id,
    discount_type: row.discount_type,
    discount_value: row.discount_value || 0,
    calculated_discount: row.calculated_discount || 0,
    rejection_reason: row.rejection_reason,
  };
}

/* ── Commercial Settings ───────────────────────────── */

export async function getCommercialSettings(): Promise<CommercialSettings> {
  const { data } = await supabase
    .from("commercial_settings" as any)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return {
    report_release_policy: data?.report_release_policy || "anytime",
    vat_percentage: data?.vat_percentage ?? 15,
    allow_partial_payment: data?.allow_partial_payment || false,
    default_payment_terms_ar: data?.default_payment_terms_ar || "الدفع مطلوب خلال 7 أيام",
    default_validity_days: data?.default_validity_days || 14,
  };
}

export async function updateCommercialSettings(settings: Partial<CommercialSettings>) {
  return supabase.from("commercial_settings" as any).update({
    ...settings,
    updated_at: new Date().toISOString(),
  } as any).eq("id", 1);
}

/* ── Invoice ───────────────────────────────────────── */

export async function createInvoice(params: {
  assignmentId: string;
  clientId: string;
  organizationId: string;
  subtotal: number;
  discountAmount?: number;
  discountCodeId?: string;
  vatPercentage?: number;
  dueDate?: string;
  notesAr?: string;
}) {
  const vat = params.vatPercentage ?? 15;
  const afterDiscount = params.subtotal - (params.discountAmount || 0);
  const vatAmount = Math.round(afterDiscount * vat / 100);
  const total = afterDiscount + vatAmount;

  return supabase.from("invoices" as any).insert({
    assignment_id: params.assignmentId,
    client_id: params.clientId,
    organization_id: params.organizationId,
    subtotal: params.subtotal,
    discount_amount: params.discountAmount || 0,
    discount_code_id: params.discountCodeId || null,
    vat_percentage: vat,
    vat_amount: vatAmount,
    total_amount: total,
    due_date: params.dueDate || null,
    notes_ar: params.notesAr || null,
    payment_status: "draft",
  } as any).select("*").single();
}

/* ── Quotation helpers ─────────────────────────────── */

export const PAYMENT_STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  draft: { ar: "مسودة", color: "bg-muted text-muted-foreground" },
  sent: { ar: "مرسل", color: "bg-sky-500/10 text-sky-600" },
  approved: { ar: "معتمد", color: "bg-emerald-500/10 text-emerald-600" },
  awaiting_payment: { ar: "بانتظار الدفع", color: "bg-amber-500/10 text-amber-600" },
  partially_paid: { ar: "مدفوع جزئياً", color: "bg-orange-500/10 text-orange-600" },
  paid: { ar: "مدفوع", color: "bg-emerald-500/10 text-emerald-600" },
  overdue: { ar: "متأخر", color: "bg-destructive/10 text-destructive" },
  cancelled: { ar: "ملغي", color: "bg-muted text-muted-foreground" },
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  real_estate: "تقييم عقاري",
  machinery: "تقييم آلات ومعدات",
  mixed: "تقييم مختلط",
  revaluation: "إعادة تقييم",
  report_copy: "نسخة تقرير / تحديث",
};
