import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";
import { runIssuanceGate } from "./issuance-gate";

// ══════════════════════════════════════════════════════════════
// Master Status Matrix v1.0 — 18 حالة موحدة
// مصدر واحد للحقيقة: valuation_assignments.status
// ══════════════════════════════════════════════════════════════

export const WORKFLOW_STATUSES = [
  "draft",
  "submitted",
  "scope_generated",
  "scope_approved",
  "first_payment_confirmed",
  "data_collection",
  "data_collection_complete",
  "data_validated",
  "inspection_pending",
  "inspection_completed",
  "analysis_complete",
  "professional_review",
  "draft_report_ready",
  "client_review",
  "draft_approved",
  "final_payment_confirmed",
  "issued",
  "archived",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

// ── Allowed transitions ──
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:                    ["submitted"],
  submitted:                ["scope_generated"],
  scope_generated:          ["scope_approved"],
  scope_approved:           ["first_payment_confirmed"],
  first_payment_confirmed:  ["data_collection"],
  data_collection:          ["data_collection_complete"],
  data_collection_complete: ["data_validated"],
  data_validated:           ["inspection_pending", "analysis_complete"], // field vs desktop
  inspection_pending:       ["inspection_completed"],
  inspection_completed:     ["analysis_complete"],
  analysis_complete:        ["professional_review"],
  professional_review:      ["draft_report_ready"],
  draft_report_ready:       ["client_review"],
  client_review:            ["draft_approved", "professional_review"], // approve or revision
  draft_approved:           ["final_payment_confirmed"],
  final_payment_confirmed:  ["issued"],
  issued:                   ["archived"],
  archived:                 [],
};

// ── Payment gates: mandatory payment before entry ──
export const PAYMENT_GATES: Record<string, { required_stage: "first" | "final"; label_ar: string }> = {
  first_payment_confirmed: { required_stage: "first", label_ar: "يجب تأكيد الدفعة الأولى قبل فتح المهمة" },
  final_payment_confirmed: { required_stage: "final", label_ar: "يجب تأكيد الدفعة النهائية قبل الإصدار" },
};

// ── Blocking conditions (human-readable) ──
export const BLOCKING_RULES: Record<string, string> = {
  scope_generated:          "يجب فحص تعارض المصالح وتوليد نطاق العمل",
  scope_approved:           "يجب موافقة العميل على نطاق العمل",
  first_payment_confirmed:  "يجب تأكيد الدفعة الأولى (50%)",
  data_collection_complete: "يجب إكمال جمع كافة البيانات والمستندات",
  data_validated:           "يجب التحقق من صحة واكتمال البيانات",
  inspection_pending:       "يجب إسناد المعاين",
  inspection_completed:     "يجب إكمال المعاينة الميدانية",
  analysis_complete:        "يجب إكمال التحليل الآلي",
  professional_review:      "يجب مراجعة الحكم المهني من المقيّم المعتمد",
  draft_report_ready:       "يجب اعتماد القيمة النهائية وإنشاء المسودة",
  client_review:            "يجب إرسال المسودة للعميل",
  draft_approved:           "يجب اعتماد العميل للمسودة",
  final_payment_confirmed:  "يجب تأكيد الدفعة النهائية (50%)",
  issued:                   "يجب اجتياز بوابة الإصدار النهائي",
  archived:                 "يجب إصدار التقرير أولاً",
};

// ── Status labels: per-role views ──
export const STATUS_LABELS: Record<string, {
  ar: string;
  en: string;
  icon: string;
  phase: string;
  client_ar: string;
  owner_ar: string;
  inspector_ar: string;
  finance_ar: string;
}> = {
  draft:                    { ar: "مسودة", en: "Draft", icon: "📝", phase: "intake", client_ar: "مسودة الطلب", owner_ar: "طلب جديد (مسودة)", inspector_ar: "—", finance_ar: "—" },
  submitted:                { ar: "تم الإرسال", en: "Submitted", icon: "📤", phase: "intake", client_ar: "تم الإرسال", owner_ar: "طلب وارد جديد", inspector_ar: "—", finance_ar: "—" },
  scope_generated:          { ar: "نطاق العمل جاهز", en: "Scope Generated", icon: "📋", phase: "intake", client_ar: "بانتظار موافقتك", owner_ar: "نطاق عمل جاهز", inspector_ar: "—", finance_ar: "عرض سعر جاهز" },
  scope_approved:           { ar: "نطاق العمل معتمد", en: "Scope Approved", icon: "✅", phase: "intake", client_ar: "بانتظار السداد", owner_ar: "العميل وافق", inspector_ar: "—", finance_ar: "بانتظار الدفعة الأولى" },
  first_payment_confirmed:  { ar: "الدفعة الأولى مؤكدة", en: "First Payment Confirmed", icon: "💰", phase: "intake", client_ar: "جاري التنفيذ", owner_ar: "المهمة مفتوحة", inspector_ar: "—", finance_ar: "الدفعة الأولى مستلمة" },
  data_collection:          { ar: "جمع البيانات", en: "Data Collection", icon: "📂", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "جمع بيانات", inspector_ar: "—", finance_ar: "—" },
  data_collection_complete: { ar: "جمع البيانات مكتمل", en: "Data Collection Complete", icon: "📁", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "البيانات مكتملة", inspector_ar: "—", finance_ar: "—" },
  data_validated:           { ar: "البيانات مُتحققة", en: "Data Validated", icon: "🔍", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "البيانات مُتحققة", inspector_ar: "—", finance_ar: "—" },
  inspection_pending:       { ar: "بانتظار المعاينة", en: "Inspection Pending", icon: "🏗️", phase: "inspection", client_ar: "جاري التنفيذ", owner_ar: "بانتظار المعاينة", inspector_ar: "مهمة جديدة", finance_ar: "—" },
  inspection_completed:     { ar: "المعاينة مكتملة", en: "Inspection Completed", icon: "✔️", phase: "inspection", client_ar: "جاري التنفيذ", owner_ar: "المعاينة مكتملة", inspector_ar: "مكتملة ✓", finance_ar: "—" },
  analysis_complete:        { ar: "التحليل مكتمل", en: "Analysis Complete", icon: "🤖", phase: "valuation", client_ar: "جاري التنفيذ", owner_ar: "تحليل مكتمل", inspector_ar: "—", finance_ar: "—" },
  professional_review:      { ar: "مراجعة الحكم المهني", en: "Professional Review", icon: "👑", phase: "valuation", client_ar: "جاري التنفيذ", owner_ar: "مراجعتك مطلوبة", inspector_ar: "—", finance_ar: "—" },
  draft_report_ready:       { ar: "المسودة جاهزة", en: "Draft Report Ready", icon: "📄", phase: "review", client_ar: "مسودة جاهزة للمراجعة", owner_ar: "مسودة جاهزة", inspector_ar: "—", finance_ar: "—" },
  client_review:            { ar: "مراجعة العميل", en: "Client Review", icon: "👤", phase: "review", client_ar: "يرجى مراجعة المسودة", owner_ar: "بانتظار ملاحظات العميل", inspector_ar: "—", finance_ar: "—" },
  draft_approved:           { ar: "المسودة معتمدة", en: "Draft Approved", icon: "✅", phase: "review", client_ar: "بانتظار السداد النهائي", owner_ar: "العميل اعتمد المسودة", inspector_ar: "—", finance_ar: "بانتظار الدفعة النهائية" },
  final_payment_confirmed:  { ar: "الدفعة النهائية مؤكدة", en: "Final Payment Confirmed", icon: "💰", phase: "finalization", client_ar: "جاري الإصدار", owner_ar: "جاهز للإصدار النهائي", inspector_ar: "—", finance_ar: "مدفوع بالكامل ✓" },
  issued:                   { ar: "صادر", en: "Issued", icon: "📜", phase: "finalization", client_ar: "التقرير جاهز", owner_ar: "صادر ✓", inspector_ar: "—", finance_ar: "صادر ✓" },
  archived:                 { ar: "مؤرشف", en: "Archived", icon: "🗄️", phase: "finalization", client_ar: "مكتمل", owner_ar: "مؤرشف", inspector_ar: "—", finance_ar: "مؤرشف" },
};

// ── Client-facing simplified labels ──
export const CLIENT_STATUS_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.client_ar])
);

// ── Inspector-facing statuses (only shows when relevant) ──
export const INSPECTOR_STATUS_MAP: Record<string, string> = {
  inspection_pending: "معاينة مطلوبة",
  inspection_completed: "مكتملة ✓",
};

// ── Status color classes using design tokens ──
export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  scope_generated: "bg-primary/10 text-primary",
  scope_approved: "bg-primary/10 text-primary",
  first_payment_confirmed: "bg-success/10 text-success",
  data_collection: "bg-accent text-accent-foreground",
  data_collection_complete: "bg-accent text-accent-foreground",
  data_validated: "bg-accent text-accent-foreground",
  inspection_pending: "bg-warning/10 text-warning",
  inspection_completed: "bg-success/10 text-success",
  analysis_complete: "bg-primary/10 text-primary",
  professional_review: "bg-warning/10 text-warning",
  draft_report_ready: "bg-primary/10 text-primary",
  client_review: "bg-warning/10 text-warning",
  draft_approved: "bg-success/10 text-success",
  final_payment_confirmed: "bg-success/10 text-success",
  issued: "bg-success/10 text-success",
  archived: "bg-muted text-muted-foreground",
};

// ── Phase grouping for pipeline view ──
export const PIPELINE_PHASES = [
  { key: "intake", label: "الاستقبال والنطاق", statuses: ["draft", "submitted", "scope_generated", "scope_approved", "first_payment_confirmed"] },
  { key: "processing", label: "المعالجة والبيانات", statuses: ["data_collection", "data_collection_complete", "data_validated"] },
  { key: "inspection", label: "المعاينة", statuses: ["inspection_pending", "inspection_completed"] },
  { key: "valuation", label: "التقييم والحكم المهني", statuses: ["analysis_complete", "professional_review"] },
  { key: "review", label: "المراجعة والاعتماد", statuses: ["draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"] },
  { key: "finalization", label: "الإصدار والأرشفة", statuses: ["issued", "archived"] },
];

// ── Automation: AI-driven transitions (no human needed) ──
export const AUTOMATED_TRANSITIONS: Record<string, { to: string; trigger: string }> = {
  submitted:                { to: "scope_generated", trigger: "ai_intake_and_sow" },
  first_payment_confirmed:  { to: "data_collection", trigger: "auto_open_data_collection" },
  data_collection_complete: { to: "data_validated", trigger: "ai_data_validation" },
  inspection_completed:     { to: "analysis_complete", trigger: "ai_analysis" },
  issued:                   { to: "archived", trigger: "auto_archive" },
};

// ── Human checkpoints — require manual action ──
export const HUMAN_CHECKPOINTS: Record<string, { role: string; action_ar: string }> = {
  scope_approved:      { role: "client", action_ar: "موافقة العميل على نطاق العمل" },
  inspection_completed: { role: "inspector", action_ar: "إتمام المعاينة الميدانية" },
  professional_review: { role: "owner", action_ar: "مراجعة الحكم المهني واعتماد القيمة" },
  draft_report_ready:  { role: "owner", action_ar: "إنشاء مسودة التقرير" },
  client_review:       { role: "owner", action_ar: "إرسال المسودة للعميل" },
  draft_approved:      { role: "client", action_ar: "اعتماد المسودة" },
  issued:              { role: "owner", action_ar: "إصدار التقرير النهائي" },
};

// ── Lock points ──
export const LOCK_POINTS: Record<string, { what_ar: string; reversible: boolean }> = {
  first_payment_confirmed: { what_ar: "بيانات الطلب الأساسية", reversible: false },
  issued:                  { what_ar: "محتوى التقرير", reversible: false },
  archived:                { what_ar: "ملف العمل كاملاً (10 سنوات)", reversible: false },
};

// ══════════════════════════════════════════════════════════════
// Core Functions
// ══════════════════════════════════════════════════════════════

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

// ── Payment gate check ──
export async function checkPaymentGate(
  toStatus: string,
  requestId: string
): Promise<{ blocked: boolean; reason_ar?: string }> {
  const gate = PAYMENT_GATES[toStatus];
  if (!gate) return { blocked: false };

  const { isFirstPaymentConfirmed, isFinalPaymentConfirmed } = await import("./payment-workflow");

  if (gate.required_stage === "first") {
    const paid = await isFirstPaymentConfirmed(requestId);
    if (!paid) return { blocked: true, reason_ar: gate.label_ar };
  } else if (gate.required_stage === "final") {
    const paid = await isFinalPaymentConfirmed(requestId);
    if (!paid) return { blocked: true, reason_ar: gate.label_ar };
  }

  return { blocked: false };
}

// ── Backward compatibility: map old statuses to new ──
export function normalizeStatus(status: string): WorkflowStatus {
  const mapping: Record<string, WorkflowStatus> = {
    // Old 8-status mapping
    processing: "data_collection",
    inspection: "inspection_pending",
    valuation_ready: "analysis_complete",
    under_review: "professional_review",
    approved: "final_payment_confirmed",
    // Legacy statuses from old enum
    client_submitted: "submitted",
    under_ai_review: "data_collection",
    awaiting_client_info: "data_collection",
    priced: "scope_generated",
    intake: "submitted",
    scope_definition: "scope_generated",
    awaiting_payment_initial: "scope_approved",
    payment_received_initial: "first_payment_confirmed",
    inspection_required: "inspection_pending",
    inspection_assigned: "inspection_pending",
    inspection_in_progress: "inspection_pending",
    inspection_submitted: "inspection_completed",
    analysis: "analysis_complete",
    valuation: "professional_review",
    valuation_in_progress: "professional_review",
    reconciliation: "professional_review",
    draft_report: "draft_report_ready",
    internal_review: "professional_review",
    revision: "professional_review",
    under_client_review: "client_review",
    revision_in_progress: "professional_review",
    awaiting_final_payment: "draft_approved",
    final_payment_received: "final_payment_confirmed",
    final_approval: "final_payment_confirmed",
    report_issued: "issued",
    closed: "archived",
    rejected: "draft",
    returned: "professional_review",
  };
  return mapping[status] || (status as WorkflowStatus);
}

// ══════════════════════════════════════════════════════════════
// Transition with audit logging + payment gate enforcement
// ══════════════════════════════════════════════════════════════

export async function transitionStatus(
  assignmentId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string,
  automatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  if (!canTransition(fromStatus, toStatus)) {
    return {
      success: false,
      error: `لا يمكن الانتقال من "${STATUS_LABELS[fromStatus]?.ar || fromStatus}" إلى "${STATUS_LABELS[toStatus]?.ar || toStatus}"`,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !automatedBy) return { success: false, error: "غير مسجل الدخول" };

  // ── Payment gate enforcement ──
  const { data: linkedRequest } = await supabase
    .from("valuation_requests")
    .select("id")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (linkedRequest?.id) {
    const paymentCheck = await checkPaymentGate(toStatus, linkedRequest.id);
    if (paymentCheck.blocked) {
      return { success: false, error: paymentCheck.reason_ar || "بوابة الدفع تمنع الانتقال" };
    }
  }

  // ── Inspection enforcement ──
  if (toStatus === "analysis_complete" && fromStatus === "inspection_completed") {
    // Verify inspection is actually completed
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, status, completed, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    const insp = inspections?.[0];
    if (!insp) {
      return { success: false, error: "لا يمكن الانتقال بدون معاينة ميدانية." };
    }
    if (insp.status !== "completed" && !insp.completed && !insp.submitted_at) {
      return { success: false, error: "المعاينة الميدانية غير مكتملة بعد." };
    }
  }

  // ── Issuance gate enforcement ──
  if (toStatus === "issued") {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id || "")
      .maybeSingle();

    const userRole = roleData?.role || null;
    const gate = await runIssuanceGate(assignmentId, userRole);
    if (!gate.can_issue) {
      const reasons = gate.blocked_reasons_ar.join("، ");
      return { success: false, error: `لا يمكن الإصدار: ${reasons}` };
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
    action: "status_change" as any,
    table_name: "valuation_assignments",
    record_id: assignmentId,
    assignment_id: assignmentId,
    old_data: { status: fromStatus },
    new_data: { status: toStatus },
    description,
  });

  // ── Apply lock points ──
  if (toStatus in LOCK_POINTS) {
    if (toStatus === "issued" || toStatus === "archived") {
      await supabase
        .from("valuation_assignments")
        .update({ is_locked: true } as any)
        .eq("id", assignmentId);
    }
  }

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Owner final approval & issuance (combined flow)
// ══════════════════════════════════════════════════════════════

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

  const currentStatus = data.status as string;

  // Must be at final_payment_confirmed to issue
  if (currentStatus !== "final_payment_confirmed") {
    return { success: false, error: `الملف في مرحلة "${STATUS_LABELS[currentStatus]?.ar || currentStatus}" — يجب أن يكون في مرحلة "الدفعة النهائية مؤكدة"` };
  }

  // Run issuance gate
  const gate = await runIssuanceGate(assignmentId, userRole);
  if (!gate.can_issue) {
    const reasons = gate.blocked_reasons_ar.join("، ");
    return { success: false, error: `لا يمكن إصدار التقرير: ${reasons}` };
  }

  // Issue
  const issued = await transitionStatus(assignmentId, "final_payment_confirmed", "issued", "إصدار نهائي بعد اعتماد المالك");
  if (!issued.success) return issued;

  return { success: true };
}

// Keep backward compat aliases
export const superAdminFinalApproval = ownerFinalApproval;
export const adminApproveDraft = ownerFinalApproval;

// ══════════════════════════════════════════════════════════════
// Automation pipelines
// ══════════════════════════════════════════════════════════════

/**
 * Full pipeline after client submits + first payment confirmed
 */
export async function triggerAutomationPipeline(assignmentId: string) {
  try {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("status, valuation_mode, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const currentStatus = (data?.status as string) || "";

    // Step through: submitted → scope_generated (AI generates SOW)
    if (currentStatus === "submitted" || currentStatus === "first_payment_confirmed") {
      // If already past submitted, skip
      if (currentStatus === "submitted") {
        await transitionStatus(assignmentId, "submitted", "scope_generated", undefined, "توليد نطاق العمل");
        await supabase.functions.invoke("ai-intake", { body: { assignment_id: assignmentId } });
      }
    }

    // After first payment: data_collection → data_collection_complete → data_validated
    if (currentStatus === "first_payment_confirmed") {
      await transitionStatus(assignmentId, "first_payment_confirmed", "data_collection", undefined, "فتح جمع البيانات");
    }
  } catch (err) {
    console.error("Automation pipeline error:", err);
  }
}

/**
 * After data validated: route to inspection or analysis
 */
export async function triggerPostDataPipeline(assignmentId: string) {
  try {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("valuation_mode, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const isDesktop = data?.valuation_mode === "desktop";

    if (isDesktop) {
      await transitionStatus(assignmentId, "data_validated", "analysis_complete", undefined, "تقييم مكتبي — تخطي المعاينة");
    } else {
      await transitionStatus(assignmentId, "data_validated", "inspection_pending", undefined, "معاينة ميدانية مطلوبة");

      // Auto-assign inspector
      const subject = (data as any)?.subjects?.[0];
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
    console.error("Post-data pipeline error:", err);
  }
}

/**
 * After inspection completed: analysis → professional review
 */
export async function triggerPostInspectionPipeline(assignmentId: string) {
  try {
    await transitionStatus(assignmentId, "inspection_completed", "analysis_complete", undefined, "التحليل الآلي");

    await supabase.functions.invoke("valuation-engine", { body: { assignment_id: assignmentId } });
    await supabase.functions.invoke("analyze-inspection", { body: { assignment_id: assignmentId } });

    await transitionStatus(assignmentId, "analysis_complete", "professional_review", undefined, "جاهز لمراجعة الحكم المهني");
  } catch (err) {
    console.error("Post-inspection pipeline error:", err);
  }
}

// ── Auto-advance after payment confirmation ──
export async function autoAdvanceAfterPayment(assignmentId: string, paymentStage: "first" | "final") {
  try {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("status")
      .eq("id", assignmentId)
      .single();

    const currentStatus = data?.status as string;

    if (paymentStage === "first" && currentStatus === "scope_approved") {
      await transitionStatus(assignmentId, "scope_approved", "first_payment_confirmed", undefined, "تأكيد الدفعة الأولى — فتح المهمة");
      // Continue pipeline
      await transitionStatus(assignmentId, "first_payment_confirmed", "data_collection", undefined, "بدء جمع البيانات");
    }

    if (paymentStage === "final" && currentStatus === "draft_approved") {
      await transitionStatus(assignmentId, "draft_approved", "final_payment_confirmed", undefined, "تأكيد الدفعة النهائية");
    }
  } catch (err) {
    console.error("Auto-advance after payment error:", err);
  }
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

  if ((data?.status as string) === "professional_review") {
    await transitionStatus(assignmentId, "professional_review", "draft_report_ready", undefined, "إنشاء مسودة تقرير تلقائي");
  }
}
