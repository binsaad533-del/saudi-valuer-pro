import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";
import { runIssuanceGate } from "./issuance-gate";

// ── Simplified 8-status workflow ──
export const WORKFLOW_STATUSES = [
  "draft",
  "submitted",
  "processing",
  "inspection",
  "valuation_ready",
  "under_review",
  "approved",
  "issued",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

// ── Allowed transitions ──
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["processing"],
  processing: ["inspection", "valuation_ready"], // skip inspection if desktop
  inspection: ["valuation_ready"],
  valuation_ready: ["under_review"],
  under_review: ["approved", "valuation_ready"], // owner can send back
  approved: ["issued"],
  issued: [],
};

// ── Blocking conditions per status ──
export const BLOCKING_RULES: Record<string, string> = {
  inspection: "يجب تعيين معاين قبل الانتقال لهذه المرحلة",
  valuation_ready: "يجب إكمال المعالجة والمعاينة (إن وُجدت)",
  under_review: "يجب إكمال التقييم وإنشاء المسودة",
  approved: "يجب اعتماد المالك للتقرير",
  issued: "يجب اجتياز فحوصات الامتثال والاعتماد النهائي",
};

// ── Status labels (Arabic) ──
export const STATUS_LABELS: Record<string, { ar: string; icon: string; phase: string }> = {
  draft: { ar: "مسودة", icon: "📝", phase: "intake" },
  submitted: { ar: "تم الإرسال", icon: "📤", phase: "intake" },
  processing: { ar: "معالجة ذكية", icon: "🤖", phase: "processing" },
  inspection: { ar: "المعاينة الميدانية", icon: "🏗️", phase: "inspection" },
  valuation_ready: { ar: "جاهز للتقييم", icon: "📊", phase: "valuation" },
  under_review: { ar: "مراجعة المالك", icon: "👑", phase: "review" },
  approved: { ar: "معتمد", icon: "✅", phase: "finalization" },
  issued: { ar: "تم الإصدار", icon: "📜", phase: "finalization" },
};

// ── Client-facing simplified labels ──
export const CLIENT_STATUS_MAP: Record<string, string> = {
  draft: "مسودة",
  submitted: "جاري التنفيذ",
  processing: "جاري التنفيذ",
  inspection: "جاري التنفيذ",
  valuation_ready: "جاري التنفيذ",
  under_review: "تحت المراجعة",
  approved: "مكتمل",
  issued: "مكتمل",
};

// ── Inspector-facing statuses ──
export const INSPECTOR_STATUS_MAP: Record<string, string> = {
  inspection: "معاينة مطلوبة",
};

// ── Status color classes using design tokens ──
export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  processing: "bg-accent text-accent-foreground",
  inspection: "bg-warning/10 text-warning",
  valuation_ready: "bg-primary/10 text-primary",
  under_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  issued: "bg-success/10 text-success",
};

// ── Phase grouping for pipeline view ──
export const PIPELINE_PHASES = [
  { key: "intake", label: "الاستقبال", statuses: ["draft", "submitted"] },
  { key: "processing", label: "المعالجة الذكية", statuses: ["processing"] },
  { key: "inspection", label: "المعاينة", statuses: ["inspection"] },
  { key: "valuation", label: "التقييم", statuses: ["valuation_ready"] },
  { key: "review", label: "المراجعة", statuses: ["under_review"] },
  { key: "finalization", label: "الاعتماد والإصدار", statuses: ["approved", "issued"] },
];

// ── Automation configuration: AI-driven transitions ──
export const AUTOMATED_TRANSITIONS: Record<string, { to: string; trigger: string }> = {
  submitted: { to: "processing", trigger: "ai_intake" },
  processing: { to: "valuation_ready", trigger: "ai_processing_complete" },
  inspection: { to: "valuation_ready", trigger: "inspection_complete" },
  approved: { to: "issued", trigger: "auto_issue_report" },
};

// ── Human checkpoints — only owner ──
export const HUMAN_CHECKPOINTS: Record<string, { role: string; action: string }> = {
  under_review: { role: "owner", action: "مراجعة واعتماد المالك" },
};

// ── Core transition function ──
export function canTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(current: string): string[] {
  return ALLOWED_TRANSITIONS[current] || [];
}

export function getStatusIndex(status: string): number {
  return WORKFLOW_STATUSES.indexOf(status as WorkflowStatus);
}

export function isAutomatedTransition(status: string): boolean {
  return status in AUTOMATED_TRANSITIONS;
}

export function isHumanCheckpoint(status: string): boolean {
  return status in HUMAN_CHECKPOINTS;
}

// ── Backward compatibility: map old statuses to new ──
export function normalizeStatus(status: string): WorkflowStatus {
  const mapping: Record<string, WorkflowStatus> = {
    client_submitted: "submitted",
    under_ai_review: "processing",
    awaiting_client_info: "processing",
    priced: "processing",
    awaiting_payment_initial: "processing",
    payment_received_initial: "processing",
    inspection_required: "inspection",
    inspection_assigned: "inspection",
    inspection_in_progress: "inspection",
    inspection_submitted: "valuation_ready",
    valuation_in_progress: "valuation_ready",
    draft_report_ready: "under_review",
    under_client_review: "under_review",
    revision_in_progress: "under_review",
    awaiting_final_payment: "under_review",
    final_payment_received: "approved",
    report_issued: "issued",
    closed: "issued",
  };
  return mapping[status] || (status as WorkflowStatus);
}

// ── Transition with audit logging ──
export async function transitionStatus(
  assignmentId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string,
  automatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  if (!canTransition(fromStatus, toStatus)) {
    return { success: false, error: `لا يمكن الانتقال من "${STATUS_LABELS[fromStatus]?.ar}" إلى "${STATUS_LABELS[toStatus]?.ar}"` };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !automatedBy) return { success: false, error: "غير مسجل الدخول" };

  // ── Inspection enforcement: block valuation without completed inspection (field mode only) ──
  if (toStatus === "valuation_ready" && fromStatus === "inspection") {
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, status, completed, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    const inspection = inspections?.[0];
    if (!inspection) {
      return { success: false, error: "لا يمكن الانتقال بدون معاينة ميدانية." };
    }
    if (inspection.status !== "completed" && !inspection.completed && !inspection.submitted_at) {
      return { success: false, error: "المعاينة الميدانية غير مكتملة بعد." };
    }
  }

  // Update assignment status
  const { error: updateErr } = await supabase
    .from("valuation_assignments")
    .update({ status: toStatus as any })
    .eq("id", assignmentId);

  if (updateErr) return { success: false, error: updateErr.message };

  const userId = user?.id || "system";
  const description = automatedBy
    ? `[تلقائي: ${automatedBy}] ${STATUS_LABELS[fromStatus]?.ar || fromStatus} → ${STATUS_LABELS[toStatus]?.ar || toStatus}`
    : `تغيير الحالة: ${STATUS_LABELS[fromStatus]?.ar || fromStatus} → ${STATUS_LABELS[toStatus]?.ar || toStatus}${reason ? ` | السبب: ${reason}` : ""}`;

  // Log in status_history
  await supabase.from("status_history").insert({
    assignment_id: assignmentId,
    from_status: fromStatus as any,
    to_status: toStatus as any,
    changed_by: userId,
    reason: automatedBy ? `تلقائي: ${automatedBy}` : reason || null,
  });

  // Log in audit_logs
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "update" as any,
    table_name: "valuation_assignments",
    record_id: assignmentId,
    assignment_id: assignmentId,
    old_data: { status: fromStatus },
    new_data: { status: toStatus },
    description,
  });

  return { success: true };
}

// ── Owner final approval & issuance ──
export async function ownerFinalApproval(assignmentId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const userRole = roleData?.role || "client";
  if (!hasPermission(userRole, "issue_final_report")) {
    return { success: false, error: "ليس لديك صلاحية إصدار التقرير النهائي. مطلوب دور: مالك." };
  }

  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return { success: false, error: "الملف غير موجود" };

  if ((data.status as string) !== "under_review") {
    return { success: false, error: "الملف ليس في مرحلة المراجعة" };
  }

  // Run issuance gate
  const gate = await runIssuanceGate(assignmentId, userRole);
  if (!gate.can_issue) {
    const reasons = gate.blocked_reasons_ar.join("، ");
    return { success: false, error: `لا يمكن إصدار التقرير: ${reasons}` };
  }

  // Approve
  const approved = await transitionStatus(assignmentId, "under_review", "approved", "اعتماد المالك");
  if (!approved.success) return approved;

  // Issue
  const issued = await transitionStatus(assignmentId, "approved", "issued", undefined, "إصدار تلقائي بعد الاعتماد");
  if (!issued.success) return issued;

  // Lock the assignment
  await supabase
    .from("valuation_assignments")
    .update({ is_locked: true } as any)
    .eq("id", assignmentId);

  return { success: true };
}

// Keep backward compat aliases
export const superAdminFinalApproval = ownerFinalApproval;
export const adminApproveDraft = ownerFinalApproval;

// ── Trigger full AI automation pipeline after submission ──
export async function triggerAutomationPipeline(assignmentId: string) {
  try {
    // 1. Move to processing
    await transitionStatus(assignmentId, "submitted", "processing", undefined, "بدء المعالجة الذكية");

    // 2. Call AI intake function
    await supabase.functions.invoke("ai-intake", { body: { assignment_id: assignmentId } });

    // Check if desktop valuation — skip inspection
    const { data: assignmentInfo } = await supabase
      .from("valuation_assignments")
      .select("valuation_mode, id, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const isDesktop = assignmentInfo?.valuation_mode === "desktop";

    if (isDesktop) {
      // Desktop: skip inspection → go directly to valuation
      await transitionStatus(assignmentId, "processing", "valuation_ready", undefined, "تقييم مكتبي — تخطي المعاينة");
    } else {
      // Field: needs inspection
      await transitionStatus(assignmentId, "processing", "inspection", undefined, "المعالجة مكتملة — معاينة مطلوبة");

      // Auto-assign inspector
      const subject = (assignmentInfo as any)?.subjects?.[0];
      await supabase.functions.invoke("smart-inspector-assignment", {
        body: {
          assignment_id: assignmentId,
          property_city_ar: subject?.city_ar || "",
          property_district_ar: subject?.district_ar || "",
          property_latitude: subject?.latitude,
          property_longitude: subject?.longitude,
        },
      });
    }
  } catch (err) {
    console.error("Automation pipeline error:", err);
  }
}

// ── Auto-chain after inspection submitted ──
export async function triggerPostInspectionPipeline(assignmentId: string) {
  try {
    // Move to valuation_ready
    await transitionStatus(assignmentId, "inspection", "valuation_ready", undefined, "المعاينة مكتملة");

    // Run valuation engine
    await supabase.functions.invoke("valuation-engine", { body: { assignment_id: assignmentId } });

    // Analyze inspection
    await supabase.functions.invoke("analyze-inspection", { body: { assignment_id: assignmentId } });

    // Generate report
    await supabase.functions.invoke("generate-report-pdf", { body: { assignment_id: assignmentId } });

    // Move to owner review
    await transitionStatus(assignmentId, "valuation_ready", "under_review", undefined, "التقرير جاهز للمراجعة");
  } catch (err) {
    console.error("Post-inspection pipeline error:", err);
  }
}

// ── Deprecated helpers kept for backward compat ──
export async function autoAdvanceAfterPayment(_assignmentId: string, _paymentStage: "first" | "final") {
  // Payment no longer blocks workflow — no-op
}

export async function autoAdvanceAfterInspection(assignmentId: string) {
  await triggerPostInspectionPipeline(assignmentId);
}

export async function autoAdvanceAfterReport(assignmentId: string) {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if ((data?.status as string) === "valuation_ready") {
    await transitionStatus(assignmentId, "valuation_ready", "under_review", undefined, "إنشاء مسودة تقرير تلقائي");
  }
}
