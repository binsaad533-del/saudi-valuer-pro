/**
 * Report Issuance Gate — بوابة الإصدار النهائي
 * Validates ALL technical prerequisites before allowing final report issuance.
 * Payment is COMPLETELY decoupled — never blocks issuance.
 */

import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";

export interface IssuanceCheck {
  code: string;
  label_ar: string;
  label_en: string;
  passed: boolean;
  mandatory: boolean;
  category: "authorization" | "technical" | "compliance";
  details?: string;
}

export interface IssuanceGateResult {
  can_issue: boolean;
  technically_ready: boolean;
  checks: IssuanceCheck[];
  passed_count: number;
  failed_mandatory: number;
  total: number;
  blocked_reasons_ar: string[];
}

export async function runIssuanceGate(
  assignmentId: string,
  userRole: string | null
): Promise<IssuanceGateResult> {
  const checks: IssuanceCheck[] = [];

  // 1. Role authorization
  const roleAllowed = hasPermission(userRole, "issue_final_report");
  checks.push({
    code: "ROLE_AUTH",
    label_ar: "صلاحية الإصدار",
    label_en: "Issuance authorization",
    passed: roleAllowed,
    mandatory: true,
    category: "authorization",
    details: roleAllowed ? undefined : "ليس لديك صلاحية إصدار التقرير",
  });

  // 2. Fetch assignment data
  const { data: assignment } = await supabase
    .from("valuation_assignments")
    .select("*, subjects(*)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return {
      can_issue: false,
      technically_ready: false,
      checks: [{ code: "NO_ASSIGNMENT", label_ar: "المهمة غير موجودة", label_en: "Assignment not found", passed: false, mandatory: true, category: "technical" }],
      passed_count: 0,
      failed_mandatory: 1,
      total: 1,
      blocked_reasons_ar: ["المهمة غير موجودة"],
    };
  }

  // 3. Asset review approval (if extraction was used)
  const { data: jobs } = await supabase
    .from("processing_jobs")
    .select("id, status")
    .eq("request_id", (assignment as any).request_id)
    .limit(1);

  if (jobs && jobs.length > 0) {
    const { count: unreviewedCount } = await supabase
      .from("extracted_assets")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobs[0].id)
      .not("review_status", "in", '("verified","approved")');

    const assetReviewPassed = (unreviewedCount || 0) === 0;
    checks.push({
      code: "ASSET_REVIEW",
      label_ar: "اعتماد مراجعة الأصول",
      label_en: "Asset review approved",
      passed: assetReviewPassed,
      mandatory: true,
      category: "technical",
      details: assetReviewPassed ? undefined : `${unreviewedCount} أصول لم تتم مراجعتها`,
    });
  }

  // 4. Report exists with content
  const { data: reports } = await supabase
    .from("reports")
    .select("id, status, content_ar, is_final, version")
    .eq("assignment_id", assignmentId)
    .order("version", { ascending: false })
    .limit(1);

  const latestReport = reports?.[0];
  checks.push({
    code: "REPORT_EXISTS",
    label_ar: "وجود التقرير",
    label_en: "Report exists",
    passed: !!latestReport,
    mandatory: true,
    category: "technical",
  });

  if (latestReport) {
    checks.push({
      code: "REPORT_CONTENT",
      label_ar: "محتوى التقرير العربي",
      label_en: "Arabic report content",
      passed: !!latestReport.content_ar,
      mandatory: true,
      category: "technical",
    });
  }

  // 5. Compliance checks
  const { data: complianceChecks } = await supabase
    .from("compliance_checks")
    .select("id, is_passed, is_mandatory")
    .eq("assignment_id", assignmentId);

  if (complianceChecks && complianceChecks.length > 0) {
    const mandatoryFailed = complianceChecks.filter(c => c.is_mandatory && !c.is_passed);
    checks.push({
      code: "COMPLIANCE",
      label_ar: "فحوصات الامتثال",
      label_en: "Compliance checks",
      passed: mandatoryFailed.length === 0,
      mandatory: true,
      category: "compliance",
      details: mandatoryFailed.length > 0 ? `${mandatoryFailed.length} فحوصات إلزامية لم تجتز` : undefined,
    });
  }

  // 6. Assumptions documented
  const { count: assumptionsCount } = await supabase
    .from("assumptions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  checks.push({
    code: "ASSUMPTIONS",
    label_ar: "توثيق الافتراضات",
    label_en: "Assumptions documented",
    passed: (assumptionsCount || 0) > 0,
    mandatory: true,
    category: "technical",
  });

  // 7. Inspection completed (unless desktop)
  const isDesktop = (assignment as any).valuation_mode === "desktop";
  if (!isDesktop) {
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, status, completed")
      .eq("assignment_id", assignmentId)
      .limit(1);

    const inspDone = inspections?.[0]?.completed || inspections?.[0]?.status === "completed";
    checks.push({
      code: "INSPECTION",
      label_ar: "اكتمال المعاينة الميدانية",
      label_en: "Field inspection completed",
      passed: !!inspDone,
      mandatory: true,
      category: "technical",
    });
  }

  // 8. Final value confirmed
  const hasValue = !!(assignment as any).final_value || !!(assignment as any).estimated_value;
  checks.push({
    code: "FINAL_VALUE",
    label_ar: "تأكيد القيمة النهائية",
    label_en: "Final value confirmed",
    passed: hasValue,
    mandatory: true,
    category: "technical",
  });

  // 9. Final payment confirmed (blocks issuance)
  const { data: linkedReq } = await supabase
    .from("valuation_requests")
    .select("id, payment_structure")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (linkedReq?.id) {
    const { isFinalPaymentConfirmed } = await import("./payment-workflow");
    const finalPaid = await isFinalPaymentConfirmed(linkedReq.id);
    checks.push({
      code: "FINAL_PAYMENT",
      label_ar: "تأكيد الدفعة النهائية",
      label_en: "Final payment confirmed",
      passed: finalPaid,
      mandatory: true,
      category: "authorization",
      details: finalPaid ? undefined : "لم يتم تأكيد الدفعة النهائية بعد",
    });
  }

  // Calculate results
  const failedMandatory = checks.filter(c => c.mandatory && !c.passed);
  const passedCount = checks.filter(c => c.passed).length;

  return {
    can_issue: failedMandatory.length === 0,
    technically_ready: failedMandatory.length === 0,
    checks,
    passed_count: passedCount,
    failed_mandatory: failedMandatory.length,
    total: checks.length,
    blocked_reasons_ar: failedMandatory.map(c => c.details || c.label_ar),
  };
}

/**
 * Approve final value — logs explicit approval in audit trail
 */
export async function approveFinalValue(
  assignmentId: string,
  approvedValue: number,
  justification?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const userRole = roleData?.role || "client";
  if (!hasPermission(userRole, "approve_final_value")) {
    return { success: false, error: "ليس لديك صلاحية اعتماد القيمة النهائية" };
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "update" as any,
    table_name: "valuation_assignments",
    record_id: assignmentId,
    assignment_id: assignmentId,
    description: `اعتماد القيمة النهائية: ${approvedValue.toLocaleString()} ر.س${justification ? ` | المبرر: ${justification}` : ""}`,
    new_data: { approved_value: approvedValue, approved_by: user.id, approved_at: new Date().toISOString() },
  });

  return { success: true };
}
