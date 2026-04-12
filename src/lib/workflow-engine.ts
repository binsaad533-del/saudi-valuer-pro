import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";
import { runIssuanceGate } from "./issuance-gate";

// ── 13-stage lifecycle — Jassas specification ──────────────────────────────────
export const WORKFLOW_STATUSES = [
  "draft",
  "stage_1_processing",
  "stage_2_client_review",
  "stage_3_owner_scope",
  "stage_4_client_scope",
  "pending_payment_1",
  "stage_5_inspection",
  "stage_6_owner_draft",
  "stage_7_client_draft",
  "pending_payment_2",
  "signing",
  "issued",
  "archived",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

// ── Allowed transitions ────────────────────────────────────────────────────────
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:                 ["stage_1_processing"],
  stage_1_processing:    ["stage_2_client_review"],
  stage_2_client_review: ["stage_3_owner_scope"],
  stage_3_owner_scope:   ["stage_4_client_scope"],
  stage_4_client_scope:  ["pending_payment_1"],
  pending_payment_1:     ["stage_5_inspection", "stage_6_owner_draft"], // field | desktop
  stage_5_inspection:    ["stage_6_owner_draft"],
  stage_6_owner_draft:   ["stage_7_client_draft"],
  stage_7_client_draft:  ["pending_payment_2"],
  pending_payment_2:     ["signing"],
  signing:               ["issued"],
  issued:                ["archived"],
  archived:              [],
};

// ── Status metadata ───────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<string, { ar: string; icon: string; phase: string }> = {
  draft:                  { ar: "مسودة الطلب",              icon: "📝", phase: "intake" },
  stage_1_processing:     { ar: "تحليل المستندات (رقيم)",   icon: "🤖", phase: "processing" },
  stage_2_client_review:  { ar: "مراجعة الفهرس",             icon: "👁️", phase: "client_action" },
  stage_3_owner_scope:    { ar: "نطاق العمل والسعر",         icon: "📋", phase: "owner_action" },
  stage_4_client_scope:   { ar: "موافقة العميل على النطاق",  icon: "✋", phase: "client_action" },
  pending_payment_1:      { ar: "انتظار الدفعة الأولى 50%",  icon: "💳", phase: "payment" },
  stage_5_inspection:     { ar: "المعاينة الميدانية",        icon: "🏗️", phase: "inspection" },
  stage_6_owner_draft:    { ar: "حكم المالك المهني",         icon: "👑", phase: "owner_action" },
  stage_7_client_draft:   { ar: "مراجعة المسودة",            icon: "📄", phase: "client_action" },
  pending_payment_2:      { ar: "انتظار الدفعة الثانية 50%", icon: "💳", phase: "payment" },
  signing:                { ar: "التوقيع الإلكتروني",         icon: "✍️", phase: "finalization" },
  issued:                 { ar: "تم الإصدار",                icon: "📜", phase: "finalization" },
  archived:               { ar: "مؤرشف",                    icon: "🗄️", phase: "archive" },
};

// ── Client-facing simplified labels ──────────────────────────────────────────
export const CLIENT_STATUS_MAP: Record<string, string> = {
  draft:                  "مسودة",
  stage_1_processing:     "جارٍ التحليل",
  stage_2_client_review:  "يحتاج موافقتك على الفهرس",
  stage_3_owner_scope:    "جارٍ تحديد النطاق والسعر",
  stage_4_client_scope:   "يحتاج موافقتك على النطاق",
  pending_payment_1:      "بانتظار الدفعة الأولى",
  stage_5_inspection:     "جارٍ المعاينة الميدانية",
  stage_6_owner_draft:    "جارٍ إعداد التقرير",
  stage_7_client_draft:   "يحتاج مراجعتك للمسودة",
  pending_payment_2:      "بانتظار الدفعة الأخيرة",
  signing:                "جارٍ توقيع التقرير",
  issued:                 "مكتمل — التقرير صادر",
  archived:               "مؤرشف",
};

// ── Inspector-facing statuses ─────────────────────────────────────────────────
export const INSPECTOR_STATUS_MAP: Record<string, string> = {
  stage_5_inspection: "معاينة مطلوبة",
};

// ── Status color tokens ───────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  draft:                  "bg-muted text-muted-foreground",
  stage_1_processing:     "bg-accent text-accent-foreground",
  stage_2_client_review:  "bg-info/10 text-info",
  stage_3_owner_scope:    "bg-warning/10 text-warning",
  stage_4_client_scope:   "bg-info/10 text-info",
  pending_payment_1:      "bg-warning/10 text-warning",
  stage_5_inspection:     "bg-primary/10 text-primary",
  stage_6_owner_draft:    "bg-warning/10 text-warning",
  stage_7_client_draft:   "bg-info/10 text-info",
  pending_payment_2:      "bg-warning/10 text-warning",
  signing:                "bg-success/10 text-success",
  issued:                 "bg-success/10 text-success",
  archived:               "bg-muted text-muted-foreground",
};

// ── Pipeline phases for dashboard view ───────────────────────────────────────
export const PIPELINE_PHASES = [
  { key: "intake",        label: "الاستقبال",          statuses: ["draft", "stage_1_processing"] },
  { key: "client_review", label: "مراجعة العميل",       statuses: ["stage_2_client_review", "stage_4_client_scope"] },
  { key: "owner_scope",   label: "نطاق وسعر",           statuses: ["stage_3_owner_scope"] },
  { key: "payment_1",     label: "الدفعة الأولى",       statuses: ["pending_payment_1"] },
  { key: "inspection",    label: "المعاينة",            statuses: ["stage_5_inspection"] },
  { key: "valuation",     label: "التقييم والمسودة",    statuses: ["stage_6_owner_draft", "stage_7_client_draft"] },
  { key: "payment_2",     label: "الدفعة الثانية",      statuses: ["pending_payment_2"] },
  { key: "finalization",  label: "التوقيع والإصدار",    statuses: ["signing", "issued"] },
];

// ── AI-automated transitions ──────────────────────────────────────────────────
export const AUTOMATED_TRANSITIONS: Record<string, { to: string; trigger: string }> = {
  draft:              { to: "stage_1_processing",    trigger: "client_submit" },
  stage_1_processing: { to: "stage_2_client_review", trigger: "ai_analysis_complete" },
  stage_5_inspection: { to: "stage_6_owner_draft",   trigger: "inspection_submitted" },
};

// ── Human approval checkpoints ────────────────────────────────────────────────
export const HUMAN_CHECKPOINTS: Record<string, { role: string; action: string }> = {
  stage_2_client_review: { role: "client",  action: "اعتماد فهرس الأصول" },
  stage_3_owner_scope:   { role: "owner",   action: "اعتماد نطاق العمل والسعر" },
  stage_4_client_scope:  { role: "client",  action: "الموافقة على النطاق والسعر" },
  pending_payment_1:     { role: "system",  action: "تأكيد الدفعة الأولى 50%" },
  stage_6_owner_draft:   { role: "owner",   action: "تطبيق الحكم المهني واعتماد المسودة" },
  stage_7_client_draft:  { role: "client",  action: "مراجعة المسودة والموافقة" },
  pending_payment_2:     { role: "system",  action: "تأكيد الدفعة الثانية 50%" },
  signing:               { role: "owner",   action: "التوقيع الإلكتروني على التقرير النهائي" },
};

// ── Normalize all legacy statuses → new 13 ───────────────────────────────────
export function normalizeStatus(status: string): WorkflowStatus {
  const mapping: Record<string, WorkflowStatus> = {
    // Old intake / AI
    submitted:               "stage_1_processing",
    client_submitted:        "stage_1_processing",
    intake:                  "stage_1_processing",
    under_ai_review:         "stage_1_processing",
    processing:              "stage_1_processing",
    awaiting_client_info:    "stage_2_client_review",
    data_collection:         "stage_2_client_review",
    // Old scope / pricing
    scope_definition:        "stage_3_owner_scope",
    priced:                  "stage_4_client_scope",
    // Old payment 1
    awaiting_payment_initial:"pending_payment_1",
    payment_received_initial:"stage_5_inspection",
    // Old inspection
    inspection_required:     "stage_5_inspection",
    inspection_assigned:     "stage_5_inspection",
    inspection_in_progress:  "stage_5_inspection",
    inspection_submitted:    "stage_6_owner_draft",
    // Old valuation / analysis
    analysis:                "stage_6_owner_draft",
    valuation:               "stage_6_owner_draft",
    valuation_in_progress:   "stage_6_owner_draft",
    valuation_ready:         "stage_6_owner_draft",
    reconciliation:          "stage_6_owner_draft",
    draft_report:            "stage_6_owner_draft",
    draft_report_ready:      "stage_6_owner_draft",
    internal_review:         "stage_6_owner_draft",
    under_review:            "stage_6_owner_draft",
    // Old client review
    under_client_review:     "stage_7_client_draft",
    revision_in_progress:    "stage_7_client_draft",
    revision:                "stage_7_client_draft",
    returned:                "stage_7_client_draft",
    // Old payment 2
    awaiting_final_payment:  "pending_payment_2",
    final_payment_received:  "signing",
    // Old approval / issuance
    final_approval:          "signing",
    approved:                "signing",
    report_issued:           "issued",
    closed:                  "archived",
    rejected:                "archived",
  };
  return mapping[status] ?? (status as WorkflowStatus);
}

// ── Core helpers ──────────────────────────────────────────────────────────────
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

// ── Internal transition function (with audit) ─────────────────────────────────
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

  // Payment gates: only advance via autoAdvanceAfterPayment (system-triggered)
  if ((fromStatus === "pending_payment_1" || fromStatus === "pending_payment_2") && !automatedBy) {
    return { success: false, error: "هذه المرحلة تتطلب تأكيد الدفع من النظام" };
  }

  // Signing gate: only advance via ownerSignReport
  if (fromStatus === "signing" && !automatedBy) {
    return { success: false, error: "هذه المرحلة تتطلب التوقيع الإلكتروني من المالك" };
  }

  // Inspection completion gate
  if (fromStatus === "stage_5_inspection" && toStatus === "stage_6_owner_draft" && !automatedBy) {
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, status, completed, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1);
    const ins = inspections?.[0];
    if (!ins || (ins.status !== "completed" && !ins.completed && !ins.submitted_at)) {
      return { success: false, error: "المعاينة الميدانية غير مكتملة بعد" };
    }
  }

  const { error: updateErr } = await supabase
    .from("valuation_assignments")
    .update({ status: toStatus as any })
    .eq("id", assignmentId);

  if (updateErr) return { success: false, error: updateErr.message };

  const userId = user?.id || "system";
  const fromLabel = STATUS_LABELS[fromStatus]?.ar || fromStatus;
  const toLabel   = STATUS_LABELS[toStatus]?.ar   || toStatus;
  const description = automatedBy
    ? `[تلقائي: ${automatedBy}] ${fromLabel} → ${toLabel}`
    : `تغيير الحالة: ${fromLabel} → ${toLabel}${reason ? ` | السبب: ${reason}` : ""}`;

  await supabase.from("status_history").insert({
    assignment_id: assignmentId,
    from_status: fromStatus as any,
    to_status: toStatus as any,
    changed_by: userId,
    reason: automatedBy ? `تلقائي: ${automatedBy}` : reason || null,
  });

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

// ── Gate 1: Client approves asset inventory (stage_2 → stage_3) ──────────────
export async function clientApproveAssetInventory(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionStatus(
    assignmentId,
    "stage_2_client_review",
    "stage_3_owner_scope",
    "اعتماد العميل لفهرس الأصول",
    "client_approve_assets"
  );
}

// ── Gate 2: Owner approves scope + price (stage_3 → stage_4) ─────────────────
export async function ownerApproveScopeAndPrice(
  assignmentId: string,
  price: number
): Promise<{ success: boolean; error?: string }> {
  await supabase
    .from("valuation_assignments")
    .update({ fee_amount: price } as any)
    .eq("id", assignmentId);

  return transitionStatus(
    assignmentId,
    "stage_3_owner_scope",
    "stage_4_client_scope",
    "اعتماد المالك للنطاق والسعر",
    "owner_approve_scope"
  );
}

// ── Gate 3: Client approves scope → pending_payment_1 ────────────────────────
export async function clientApproveScopeAndPay(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionStatus(
    assignmentId,
    "stage_4_client_scope",
    "pending_payment_1",
    "موافقة العميل على النطاق",
    "client_approve_scope"
  );
}

// ── Gate 4: Payment confirmed → advance (BLOCKS until called) ────────────────
export async function autoAdvanceAfterPayment(
  assignmentId: string,
  paymentStage: "first" | "final"
): Promise<{ success: boolean; error?: string }> {
  if (paymentStage === "first") {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("valuation_mode")
      .eq("id", assignmentId)
      .single();

    const isDesktop = data?.valuation_mode === "desktop";
    const toStatus  = isDesktop ? "stage_6_owner_draft" : "stage_5_inspection";

    const result = await transitionStatus(
      assignmentId,
      "pending_payment_1",
      toStatus,
      undefined,
      "تأكيد الدفعة الأولى"
    );
    if (!result.success) return result;

    if (!isDesktop) {
      const { data: asgn } = await supabase
        .from("valuation_assignments")
        .select("id, subjects(city_ar, district_ar, latitude, longitude)")
        .eq("id", assignmentId)
        .single();
      const subject = (asgn as any)?.subjects?.[0];
      await supabase.functions.invoke("smart-inspector-assignment", {
        body: {
          assignment_id: assignmentId,
          property_city_ar:      subject?.city_ar || "",
          property_district_ar:  subject?.district_ar || "",
          property_latitude:     subject?.latitude,
          property_longitude:    subject?.longitude,
        },
      });
    } else {
      await supabase.functions.invoke("valuation-engine", { body: { assignment_id: assignmentId } });
    }
    return { success: true };
  }

  // Final payment → signing
  return transitionStatus(
    assignmentId,
    "pending_payment_2",
    "signing",
    undefined,
    "تأكيد الدفعة الثانية"
  );
}

// ── Gate 5: Owner applies professional judgment + approves draft (stage_6 → stage_7) ──
export async function ownerApproveDraft(
  assignmentId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleData?.role !== "owner") return { success: false, error: "مطلوب دور المالك" };

  if (notes) {
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "approve" as any,
      table_name: "valuation_assignments",
      record_id: assignmentId,
      assignment_id: assignmentId,
      description: `حكم مهني: ${notes}`,
    });
  }

  return transitionStatus(
    assignmentId,
    "stage_6_owner_draft",
    "stage_7_client_draft",
    notes || "اعتماد المالك للمسودة"
  );
}

// ── Gate 6: Client approves draft → pending_payment_2 ────────────────────────
export async function clientApproveDraft(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionStatus(
    assignmentId,
    "stage_7_client_draft",
    "pending_payment_2",
    "موافقة العميل على المسودة",
    "client_approve_draft"
  );
}

// ── Gate 7: Owner electronic signature → issued ───────────────────────────────
export async function ownerSignReport(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!hasPermission(roleData?.role, "issue_final_report")) {
    return { success: false, error: "مطلوب صلاحية المالك لإصدار التقرير" };
  }

  const gate = await runIssuanceGate(assignmentId, roleData?.role);
  if (!gate.can_issue) {
    return { success: false, error: `لا يمكن الإصدار: ${gate.blocked_reasons_ar.join("، ")}` };
  }

  await supabase
    .from("valuation_assignments")
    .update({ is_locked: true, issue_date: new Date().toISOString().split("T")[0] } as any)
    .eq("id", assignmentId);

  return transitionStatus(
    assignmentId,
    "signing",
    "issued",
    "توقيع إلكتروني من المالك",
    "owner_sign"
  );
}

// ── AI automation: draft → stage_1_processing → stage_2_client_review ─────────
export async function triggerAutomationPipeline(assignmentId: string) {
  try {
    await transitionStatus(assignmentId, "draft", "stage_1_processing", undefined, "بدء التحليل الذكي");
    await supabase.functions.invoke("ai-intake", { body: { assignment_id: assignmentId } });
    await transitionStatus(
      assignmentId,
      "stage_1_processing",
      "stage_2_client_review",
      undefined,
      "اكتمال التحليل — انتظار مراجعة العميل"
    );
  } catch (err) {
    console.error("Automation pipeline error:", err);
  }
}

// ── After inspection submitted ─────────────────────────────────────────────────
export async function triggerPostInspectionPipeline(assignmentId: string) {
  try {
    await transitionStatus(
      assignmentId,
      "stage_5_inspection",
      "stage_6_owner_draft",
      undefined,
      "المعاينة مكتملة"
    );
    await supabase.functions.invoke("valuation-engine",   { body: { assignment_id: assignmentId } });
    await supabase.functions.invoke("analyze-inspection", { body: { assignment_id: assignmentId } });
    await supabase.functions.invoke("generate-report-pdf", { body: { assignment_id: assignmentId } });
  } catch (err) {
    console.error("Post-inspection pipeline error:", err);
  }
}

// ── Backward-compat aliases ────────────────────────────────────────────────────
export async function ownerFinalApproval(assignmentId: string) {
  return ownerSignReport(assignmentId);
}
export const superAdminFinalApproval = ownerFinalApproval;
export const adminApproveDraft       = ownerApproveDraft;
export const autoAdvanceAfterInspection = triggerPostInspectionPipeline;

export async function autoAdvanceAfterReport(assignmentId: string) {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();
  if ((data?.status as string) === "stage_6_owner_draft") {
    await ownerApproveDraft(assignmentId);
  }
}
