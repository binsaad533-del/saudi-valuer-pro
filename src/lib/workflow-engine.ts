import { supabase } from "@/integrations/supabase/client";

// ── All 19 statuses in order ──
export const WORKFLOW_STATUSES = [
  "draft",
  "client_submitted",
  "under_ai_review",
  "awaiting_client_info",
  "priced",
  "awaiting_payment_initial",
  "payment_received_initial",
  "inspection_required",
  "inspection_assigned",
  "inspection_in_progress",
  "inspection_submitted",
  "valuation_in_progress",
  "draft_report_ready",
  "under_client_review",
  "revision_in_progress",
  "awaiting_final_payment",
  "final_payment_received",
  "report_issued",
  "closed",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

// ── Allowed transitions (from → to[]) ──
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["client_submitted"],
  client_submitted: ["under_ai_review", "awaiting_client_info"],
  under_ai_review: ["awaiting_client_info", "priced", "inspection_required"],
  awaiting_client_info: ["under_ai_review", "client_submitted"],
  priced: ["awaiting_payment_initial"],
  awaiting_payment_initial: ["payment_received_initial"],
  payment_received_initial: ["inspection_required", "valuation_in_progress"],
  inspection_required: ["inspection_assigned"],
  inspection_assigned: ["inspection_in_progress"],
  inspection_in_progress: ["inspection_submitted"],
  inspection_submitted: ["valuation_in_progress"],
  valuation_in_progress: ["draft_report_ready"],
  draft_report_ready: ["under_client_review"],
  // under_client_review = Admin reviews draft → approves or requests revision
  under_client_review: ["revision_in_progress", "awaiting_final_payment"],
  revision_in_progress: ["draft_report_ready"],
  // awaiting_final_payment = Super Admin final approval
  awaiting_final_payment: ["final_payment_received"],
  final_payment_received: ["report_issued"],
  report_issued: ["closed"],
  closed: [],
};

// ── Blocking conditions per status ──
export const BLOCKING_RULES: Record<string, string> = {
  inspection_assigned: "يجب تعيين معاين قبل الانتقال لهذه المرحلة",
  inspection_in_progress: "يجب أن يبدأ المعاين المعاينة",
  payment_received_initial: "يجب استلام الدفعة الأولى",
  final_payment_received: "يجب اعتماد المشرف العام النهائي",
  report_issued: "يجب اجتياز فحوصات الامتثال والاعتماد النهائي",
  draft_report_ready: "يجب إنشاء مسودة التقرير",
  valuation_in_progress: "يجب إكمال المعاينة الميدانية وتسليم البيانات قبل بدء التقييم",
};

// ── Status labels (Arabic) ──
export const STATUS_LABELS: Record<string, { ar: string; icon: string; phase: string }> = {
  draft: { ar: "مسودة", icon: "📝", phase: "intake" },
  client_submitted: { ar: "تم الإرسال", icon: "📤", phase: "intake" },
  under_ai_review: { ar: "مراجعة ذكية", icon: "🤖", phase: "intake" },
  awaiting_client_info: { ar: "بانتظار معلومات إضافية", icon: "⏳", phase: "intake" },
  priced: { ar: "تم التسعير", icon: "💰", phase: "pricing" },
  awaiting_payment_initial: { ar: "بانتظار الدفعة الأولى", icon: "💳", phase: "pricing" },
  payment_received_initial: { ar: "تم استلام الدفعة", icon: "✅", phase: "pricing" },
  inspection_required: { ar: "معاينة مطلوبة", icon: "🔍", phase: "inspection" },
  inspection_assigned: { ar: "تم تعيين المعاين (تلقائي)", icon: "🤖", phase: "inspection" },
  inspection_in_progress: { ar: "المعاينة جارية", icon: "🏗️", phase: "inspection" },
  inspection_submitted: { ar: "تم إرسال المعاينة", icon: "📋", phase: "inspection" },
  valuation_in_progress: { ar: "التقييم جارٍ (ذكاء اصطناعي)", icon: "🤖", phase: "valuation" },
  draft_report_ready: { ar: "مسودة التقرير جاهزة", icon: "📄", phase: "report" },
  under_client_review: { ar: "اعتماد الإداري", icon: "👤", phase: "report" },
  revision_in_progress: { ar: "التعديل جارٍ", icon: "✏️", phase: "report" },
  awaiting_final_payment: { ar: "اعتماد المشرف العام", icon: "👑", phase: "finalization" },
  final_payment_received: { ar: "تمت الموافقة النهائية", icon: "✅", phase: "finalization" },
  report_issued: { ar: "تم إصدار التقرير", icon: "📜", phase: "finalization" },
  closed: { ar: "مؤرشف", icon: "🗄️", phase: "finalization" },
};

// ── Client-facing simplified labels ──
export const CLIENT_STATUS_MAP: Record<string, string> = {
  draft: "مسودة",
  client_submitted: "جاري التنفيذ",
  under_ai_review: "جاري التنفيذ",
  awaiting_client_info: "يحتاج معلومات إضافية",
  priced: "جاري التنفيذ",
  awaiting_payment_initial: "بانتظار الدفع",
  payment_received_initial: "جاري التنفيذ",
  inspection_required: "جاري التنفيذ",
  inspection_assigned: "جاري التنفيذ",
  inspection_in_progress: "جاري التنفيذ",
  inspection_submitted: "جاري التنفيذ",
  valuation_in_progress: "جاري التنفيذ",
  draft_report_ready: "تحت المراجعة",
  under_client_review: "تحت المراجعة",
  revision_in_progress: "تحت المراجعة",
  awaiting_final_payment: "تحت المراجعة",
  final_payment_received: "جاري التنفيذ",
  report_issued: "مكتمل",
  closed: "مكتمل",
};

// ── Inspector-facing statuses ──
export const INSPECTOR_STATUS_MAP: Record<string, string> = {
  inspection_required: "معاينة مطلوبة",
  inspection_assigned: "مُسندة إليك",
  inspection_in_progress: "جارية",
  inspection_submitted: "تم الإرسال",
};

// ── Status color classes using design tokens ──
export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  client_submitted: "bg-primary/10 text-primary",
  under_ai_review: "bg-accent text-accent-foreground",
  awaiting_client_info: "bg-warning/10 text-warning",
  priced: "bg-primary/10 text-primary",
  awaiting_payment_initial: "bg-warning/10 text-warning",
  payment_received_initial: "bg-success/10 text-success",
  inspection_required: "bg-accent text-accent-foreground",
  inspection_assigned: "bg-primary/10 text-primary",
  inspection_in_progress: "bg-warning/10 text-warning",
  inspection_submitted: "bg-success/10 text-success",
  valuation_in_progress: "bg-primary/10 text-primary",
  draft_report_ready: "bg-accent text-accent-foreground",
  under_client_review: "bg-warning/10 text-warning",
  revision_in_progress: "bg-warning/10 text-warning",
  awaiting_final_payment: "bg-warning/10 text-warning",
  final_payment_received: "bg-success/10 text-success",
  report_issued: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

// ── Phase grouping for pipeline view ──
export const PIPELINE_PHASES = [
  { key: "intake", label: "الاستقبال", statuses: ["draft", "client_submitted", "under_ai_review", "awaiting_client_info"] },
  { key: "pricing", label: "التسعير والدفع", statuses: ["priced", "awaiting_payment_initial", "payment_received_initial"] },
  { key: "inspection", label: "المعاينة", statuses: ["inspection_required", "inspection_assigned", "inspection_in_progress", "inspection_submitted"] },
  { key: "valuation", label: "التقييم (AI)", statuses: ["valuation_in_progress"] },
  { key: "report", label: "التقرير والاعتماد", statuses: ["draft_report_ready", "under_client_review", "revision_in_progress"] },
  { key: "finalization", label: "الاعتماد النهائي والأرشفة", statuses: ["awaiting_final_payment", "final_payment_received", "report_issued", "closed"] },
];

// ── Automation configuration: which transitions are AI-driven ──
export const AUTOMATED_TRANSITIONS: Record<string, { to: string; trigger: string }> = {
  client_submitted: { to: "under_ai_review", trigger: "ai_intake" },
  under_ai_review: { to: "inspection_required", trigger: "ai_review_complete" },
  inspection_required: { to: "inspection_assigned", trigger: "auto_assign_inspector" },
  inspection_submitted: { to: "valuation_in_progress", trigger: "auto_start_valuation" },
  valuation_in_progress: { to: "draft_report_ready", trigger: "auto_generate_report" },
  final_payment_received: { to: "report_issued", trigger: "auto_issue_report" },
  report_issued: { to: "closed", trigger: "auto_archive" },
};

// ── Human checkpoints ──
export const HUMAN_CHECKPOINTS: Record<string, { role: string; action: string }> = {
  draft_report_ready: { role: "admin_coordinator", action: "اعتماد المسودة من المنسق" },
  under_client_review: { role: "admin_coordinator", action: "موافقة المنسق على المسودة" },
  awaiting_final_payment: { role: "owner", action: "الاعتماد النهائي من المالك" },
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

  // ── Inspection enforcement: block valuation without completed inspection ──
  if (toStatus === "valuation_in_progress") {
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, status, completed, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    const inspection = inspections?.[0];
    if (!inspection) {
      return { success: false, error: "لا يمكن بدء التقييم بدون معاينة ميدانية." };
    }
    if (inspection.status !== "completed" && !inspection.completed && !inspection.submitted_at) {
      return { success: false, error: "المعاينة الميدانية غير مكتملة بعد." };
    }

    const { count: photoCount } = await supabase
      .from("inspection_photos")
      .select("id", { count: "exact", head: true })
      .eq("inspection_id", inspection.id);

    if (!photoCount || photoCount === 0) {
      return { success: false, error: "لا يمكن بدء التقييم بدون صور المعاينة." };
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
    ? `[تلقائي: ${automatedBy}] ${STATUS_LABELS[fromStatus]?.ar} → ${STATUS_LABELS[toStatus]?.ar}`
    : `تغيير الحالة: ${STATUS_LABELS[fromStatus]?.ar} → ${STATUS_LABELS[toStatus]?.ar}${reason ? ` | السبب: ${reason}` : ""}`;

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

// ── Automation: auto-advance after events ──
export async function autoAdvanceAfterPayment(assignmentId: string, paymentStage: "first" | "final") {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return;
  const current = data.status as string;

  if (paymentStage === "first" && current === "awaiting_payment_initial") {
    await transitionStatus(assignmentId, current, "payment_received_initial", undefined, "دفعة أولى مؤكدة");
  }
  if (paymentStage === "final" && current === "awaiting_final_payment") {
    await transitionStatus(assignmentId, current, "final_payment_received", undefined, "دفعة نهائية مؤكدة");
  }
}

export async function autoAdvanceAfterInspection(assignmentId: string) {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return;
  if (data.status === "inspection_in_progress") {
    await transitionStatus(assignmentId, data.status as string, "inspection_submitted", undefined, "إرسال معاينة تلقائي");
  }
}

export async function autoAdvanceAfterReport(assignmentId: string) {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return;
  if (data.status === "valuation_in_progress") {
    await transitionStatus(assignmentId, data.status as string, "draft_report_ready", undefined, "إنشاء مسودة تقرير تلقائي");
  }
}

// ── Admin approval: admin approves draft ──
export async function adminApproveDraft(assignmentId: string): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return { success: false, error: "الملف غير موجود" };
  
  if (data.status === "draft_report_ready") {
    // Admin approves → move to under_client_review (admin review step)
    return transitionStatus(assignmentId, data.status as string, "under_client_review", "اعتماد الإداري للمسودة");
  }
  if (data.status === "under_client_review") {
    // Admin confirms → send to super admin
    return transitionStatus(assignmentId, data.status as string, "awaiting_final_payment", "الإداري أرسل للاعتماد النهائي");
  }
  return { success: false, error: "الحالة الحالية لا تسمح بالاعتماد" };
}

// ── Super Admin final approval ──
export async function superAdminFinalApproval(assignmentId: string): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return { success: false, error: "الملف غير موجود" };

  if (data.status !== "awaiting_final_payment") {
    return { success: false, error: "الملف ليس في مرحلة الاعتماد النهائي" };
  }

  // Super admin approves → auto chain: approved → issued → archived
  const approved = await transitionStatus(assignmentId, data.status as string, "final_payment_received", "اعتماد المشرف العام النهائي");
  if (!approved.success) return approved;

  // Auto-issue report
  const issued = await transitionStatus(assignmentId, "final_payment_received", "report_issued", undefined, "إصدار تلقائي بعد الاعتماد");
  if (!issued.success) return issued;

  // Auto-archive
  await transitionStatus(assignmentId, "report_issued", "closed", undefined, "أرشفة تلقائية");

  return { success: true };
}

// ── Trigger full automation pipeline after submission ──
export async function triggerAutomationPipeline(assignmentId: string) {
  try {
    // 1. Auto AI review
    await transitionStatus(assignmentId, "client_submitted", "under_ai_review", undefined, "بدء المراجعة الذكية");

    // 2. Call AI intake function
    await supabase.functions.invoke("ai-intake", { body: { assignment_id: assignmentId } });

    // 3. Move to inspection required
    await transitionStatus(assignmentId, "under_ai_review", "inspection_required", undefined, "المراجعة الذكية مكتملة");

    // 4. Auto-assign inspector
    const { data: assignment } = await supabase
      .from("valuation_assignments")
      .select("id, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const subject = (assignment as any)?.subjects?.[0];
    const { data: inspectorResult } = await supabase.functions.invoke("smart-inspector-assignment", {
      body: {
        assignment_id: assignmentId,
        property_city_ar: subject?.city_ar || "",
        property_district_ar: subject?.district_ar || "",
        property_latitude: subject?.latitude,
        property_longitude: subject?.longitude,
      },
    });

    if (inspectorResult?.assigned) {
      await transitionStatus(assignmentId, "inspection_required", "inspection_assigned", undefined, "تعيين معاين تلقائي");
    }
  } catch (err) {
    console.error("Automation pipeline error:", err);
  }
}

// ── Auto-chain after inspection submitted ──
export async function triggerPostInspectionPipeline(assignmentId: string) {
  try {
    // 1. Start AI valuation
    await transitionStatus(assignmentId, "inspection_submitted", "valuation_in_progress", undefined, "بدء التقييم الآلي");

    // 2. Run valuation engine
    await supabase.functions.invoke("valuation-engine", { body: { assignment_id: assignmentId } });

    // 3. Analyze inspection
    await supabase.functions.invoke("analyze-inspection", { body: { assignment_id: assignmentId } });

    // 4. Generate report
    await supabase.functions.invoke("generate-report-pdf", { body: { assignment_id: assignmentId } });

    // 5. Move to draft ready
    await transitionStatus(assignmentId, "valuation_in_progress", "draft_report_ready", undefined, "إنشاء مسودة تقرير تلقائي");

    // 6. Auto-move to admin review
    await transitionStatus(assignmentId, "draft_report_ready", "under_client_review", undefined, "إرسال للإداري للاعتماد");
  } catch (err) {
    console.error("Post-inspection pipeline error:", err);
  }
}
