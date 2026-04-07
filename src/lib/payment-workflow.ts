/**
 * Payment-Workflow Integration Engine
 * Manages test/production payment modes and their effect on the valuation workflow.
 * 
 * payment_mode = "test"  → instant confirmation via UI button, no real gateway
 * payment_mode = "production" → confirmation via HyperPay/bank transfer webhook
 * 
 * Both modes use IDENTICAL workflow states and DB records.
 */

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit-logger";
import { hasPermission, type PlatformAction } from "./permissions-engine";

export type PaymentMode = "test" | "production";
export type PaymentStage = "first" | "final" | "full";

// ── Get current payment mode for a request ──
export async function getPaymentMode(requestId: string): Promise<PaymentMode> {
  const { data } = await supabase
    .from("valuation_requests")
    .select("payment_mode")
    .eq("id", requestId)
    .single();
  return ((data as any)?.payment_mode as PaymentMode) || "test";
}

// ── Check if first payment is confirmed ──
export async function isFirstPaymentConfirmed(requestId: string): Promise<boolean> {
  const { data } = await supabase
    .from("payments")
    .select("id, payment_status")
    .eq("request_id", requestId)
    .in("payment_stage", ["first", "full"])
    .eq("payment_status", "paid")
    .limit(1);
  return (data?.length || 0) > 0;
}

// ── Check if final payment is confirmed ──
export async function isFinalPaymentConfirmed(requestId: string): Promise<boolean> {
  const { data: request } = await supabase
    .from("valuation_requests")
    .select("payment_structure")
    .eq("id", requestId)
    .single();

  // If full payment structure, first payment = final payment
  if (request?.payment_structure === "full") {
    return isFirstPaymentConfirmed(requestId);
  }

  const { data } = await supabase
    .from("payments")
    .select("id, payment_status")
    .eq("request_id", requestId)
    .eq("payment_stage", "final")
    .eq("payment_status", "paid")
    .limit(1);
  return (data?.length || 0) > 0;
}

// ── Confirm test payment (instant — no real gateway) ──
export async function confirmTestPayment(
  requestId: string,
  stage: PaymentStage,
  amount: number,
  assignmentId?: string | null
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  // Verify test mode
  const mode = await getPaymentMode(requestId);
  if (mode !== "test") {
    return { success: false, error: "الطلب في وضع الدفع الحقيقي. لا يمكن استخدام التأكيد التجريبي." };
  }

  const txId = `test_${stage}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payRef = `TEST-${stage.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      request_id: requestId,
      assignment_id: assignmentId || null,
      amount,
      currency: "SAR",
      payment_stage: stage,
      payment_status: "paid",
      payment_type: "test_payment",
      gateway_name: "test_gateway",
      payment_method: "test",
      payment_reference: payRef,
      transaction_id: txId,
      is_mock: true,
      paid_at: new Date().toISOString(),
      created_by: user.id,
      notes: `تأكيد دفع تجريبي — ${stage === "first" ? "الدفعة الأولى" : stage === "final" ? "الدفعة النهائية" : "دفعة كاملة"}`,
      gateway_response_json: {
        mode: "test",
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        test_disclaimer: "TEST PAYMENT — NOT A REAL TRANSACTION",
      },
    } as any)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // The DB trigger (auto_unlock_after_payment) handles:
  // - Updating valuation_requests.payment_status
  // - Unlocking the assignment (for first payment)
  // - Audit logging

  await logAudit({
    action: "approve",
    tableName: "payments",
    entityType: "payment",
    recordId: payment?.id,
    assignmentId: assignmentId || undefined,
    description: `تأكيد دفعة تجريبية (${stage}) — المبلغ: ${amount.toLocaleString()} ر.س — مرجع: ${payRef}`,
    newData: { payment_mode: "test", stage, amount, txId },
  });

  return { success: true, paymentId: payment?.id };
}

// ── Payment bypass (admin override with audit) ──
export async function bypassPaymentGate(
  requestId: string,
  stage: PaymentStage,
  justification: string,
  assignmentId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  // Only owner can bypass
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const userRole = roleData?.role || "client";
  if (!hasPermission(userRole, "manage_settings" as PlatformAction)) {
    return { success: false, error: "فقط المالك يمكنه تجاوز بوابة الدفع" };
  }

  if (!justification || justification.trim().length < 10) {
    return { success: false, error: "يجب كتابة مبرر واضح (10 أحرف على الأقل) لتسجيله في سجل التدقيق" };
  }

  // Create a bypass payment record
  const bypassRef = `BYPASS-${stage.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  
  await supabase.from("payments").insert({
    request_id: requestId,
    assignment_id: assignmentId || null,
    amount: 0,
    currency: "SAR",
    payment_stage: stage,
    payment_status: "paid",
    payment_type: "admin_bypass",
    gateway_name: "admin_override",
    payment_method: "bypass",
    payment_reference: bypassRef,
    transaction_id: `bypass_${Date.now()}`,
    is_mock: true,
    paid_at: new Date().toISOString(),
    created_by: user.id,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_notes: justification,
    notes: `تجاوز إداري لبوابة الدفع — المبرر: ${justification}`,
    gateway_response_json: {
      type: "admin_bypass",
      bypassed_by: user.id,
      justification,
      timestamp: new Date().toISOString(),
    },
  } as any);

  await logAudit({
    action: "override",
    tableName: "payments",
    entityType: "payment",
    recordId: requestId,
    assignmentId: assignmentId || undefined,
    description: `⚠️ تجاوز إداري لبوابة الدفع (${stage}) — المبرر: ${justification}`,
    newData: {
      bypass_type: "payment_gate_override",
      stage,
      justification,
      bypassed_by: user.id,
    },
  });

  return { success: true };
}

// ── Check if request is in test mode ──
export async function isTestMode(requestId: string): Promise<boolean> {
  const mode = await getPaymentMode(requestId);
  return mode === "test";
}

// ── Get payment summary for a request ──
export async function getPaymentSummary(requestId: string): Promise<{
  mode: PaymentMode;
  firstPaid: boolean;
  finalPaid: boolean;
  totalPaid: number;
  payments: any[];
}> {
  const [mode, firstPaid, finalPaid] = await Promise.all([
    getPaymentMode(requestId),
    isFirstPaymentConfirmed(requestId),
    isFinalPaymentConfirmed(requestId),
  ]);

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  const totalPaid = (payments || [])
    .filter((p: any) => p.payment_status === "paid")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return { mode, firstPaid, finalPaid, totalPaid, payments: payments || [] };
}

// ── TEST watermark text ──
export const TEST_WATERMARK_AR = "تقرير تجريبي غير معتمد للاستخدام الرسمي";
export const TEST_WATERMARK_EN = "TEST REPORT — NOT FOR OFFICIAL USE";
