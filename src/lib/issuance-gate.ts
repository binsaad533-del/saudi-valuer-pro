/**
 * Report Issuance Gate — بوابة الإصدار النهائي
 * Validates ALL prerequisites before allowing final report issuance.
 * This is the single source of truth for "can this report be issued?"
 */

import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";

export interface IssuanceCheck {
  code: string;
  label_ar: string;
  label_en: string;
  passed: boolean;
  mandatory: boolean;
  details?: string;
}

export interface IssuanceGateResult {
  can_issue: boolean;
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
    details: roleAllowed ? undefined : "فقط المالك يمكنه إصدار التقرير النهائي",
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
      checks: [{ code: "NO_ASSIGNMENT", label_ar: "المهمة غير موجودة", label_en: "Assignment not found", passed: false, mandatory: true }],
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
      details: assetReviewPassed ? undefined : `${unreviewedCount} أصول لم تتم مراجعتها`,
    });
  }

  // 4. Valuation calculations exist
  const { data: reports } = await supabase
    .from("reports")
    .select("id, status, content_ar, is_final, version")
    .eq("assignment_id", assignmentId)
    .order("version", { ascending: false })
    .limit(1);

  const latestReport = reports?.[0];
  const hasReport = !!latestReport;
  checks.push({
    code: "REPORT_EXISTS",
    label_ar: "وجود التقرير",
    label_en: "Report exists",
    passed: hasReport,
    mandatory: true,
  });

  if (latestReport) {
    checks.push({
      code: "REPORT_CONTENT",
      label_ar: "محتوى التقرير العربي",
      label_en: "Arabic report content",
      passed: !!latestReport.content_ar,
      mandatory: true,
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
  });

  // 9. Assignment status is in correct stage
  const correctStage = ["awaiting_final_payment", "final_payment_received"].includes((assignment as any).status);
  checks.push({
    code: "WORKFLOW_STAGE",
    label_ar: "مرحلة سير العمل صحيحة",
    label_en: "Correct workflow stage",
    passed: correctStage,
    mandatory: true,
    details: correctStage ? undefined : `الحالة الحالية: ${(assignment as any).status}`,
  });

  // Calculate results
  const failedMandatory = checks.filter(c => c.mandatory && !c.passed);
  const passedCount = checks.filter(c => c.passed).length;

  return {
    can_issue: failedMandatory.length === 0,
    checks,
    passed_count: passedCount,
    failed_mandatory: failedMandatory.length,
    total: checks.length,
    blocked_reasons_ar: failedMandatory.map(c => c.details || c.label_ar),
  };
}
