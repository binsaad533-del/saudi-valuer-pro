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
  under_ai_review: ["awaiting_client_info", "priced"],
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
  under_client_review: ["revision_in_progress", "awaiting_final_payment"],
  revision_in_progress: ["draft_report_ready"],
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
  final_payment_received: "يجب استلام الدفعة النهائية",
  report_issued: "يجب اجتياز فحوصات الامتثال واستلام الدفعة النهائية",
  draft_report_ready: "يجب إنشاء مسودة التقرير",
  valuation_in_progress: "يجب إكمال المعاينة الميدانية وتسليم البيانات قبل بدء التقييم",
};

// ── Status labels (Arabic) for each role ──
export const STATUS_LABELS: Record<string, { ar: string; icon: string; phase: string }> = {
  draft: { ar: "مسودة", icon: "📝", phase: "intake" },
  client_submitted: { ar: "تم الإرسال", icon: "📤", phase: "intake" },
  under_ai_review: { ar: "مراجعة ذكية", icon: "🤖", phase: "intake" },
  awaiting_client_info: { ar: "بانتظار معلومات العميل", icon: "⏳", phase: "intake" },
  priced: { ar: "تم التسعير", icon: "💰", phase: "pricing" },
  awaiting_payment_initial: { ar: "بانتظار الدفعة الأولى", icon: "💳", phase: "pricing" },
  payment_received_initial: { ar: "تم استلام الدفعة", icon: "✅", phase: "pricing" },
  inspection_required: { ar: "معاينة مطلوبة", icon: "🔍", phase: "inspection" },
  inspection_assigned: { ar: "تم تعيين المعاين", icon: "👤", phase: "inspection" },
  inspection_in_progress: { ar: "المعاينة جارية", icon: "🏗️", phase: "inspection" },
  inspection_submitted: { ar: "تم إرسال المعاينة", icon: "📋", phase: "inspection" },
  valuation_in_progress: { ar: "التقييم جارٍ", icon: "📊", phase: "valuation" },
  draft_report_ready: { ar: "مسودة التقرير جاهزة", icon: "📄", phase: "report" },
  under_client_review: { ar: "مراجعة العميل", icon: "👁️", phase: "report" },
  revision_in_progress: { ar: "التعديل جارٍ", icon: "✏️", phase: "report" },
  awaiting_final_payment: { ar: "بانتظار الدفعة النهائية", icon: "💳", phase: "finalization" },
  final_payment_received: { ar: "تم استلام الدفعة النهائية", icon: "✅", phase: "finalization" },
  report_issued: { ar: "تم إصدار التقرير", icon: "📜", phase: "finalization" },
  closed: { ar: "مغلق", icon: "🔒", phase: "finalization" },
};

// ── Client-facing simplified labels ──
export const CLIENT_STATUS_MAP: Record<string, string> = {
  draft: "مسودة",
  client_submitted: "تم الإرسال",
  under_ai_review: "قيد المراجعة",
  awaiting_client_info: "يحتاج معلومات إضافية",
  priced: "تم التسعير",
  awaiting_payment_initial: "بانتظار الدفع",
  payment_received_initial: "تم الدفع",
  inspection_required: "قيد التنفيذ",
  inspection_assigned: "قيد التنفيذ",
  inspection_in_progress: "قيد التنفيذ",
  inspection_submitted: "قيد التنفيذ",
  valuation_in_progress: "قيد التنفيذ",
  draft_report_ready: "مسودة التقرير جاهزة",
  under_client_review: "بانتظار ملاحظاتك",
  revision_in_progress: "قيد التعديل",
  awaiting_final_payment: "بانتظار الدفعة النهائية",
  final_payment_received: "جارٍ إصدار التقرير",
  report_issued: "التقرير جاهز",
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
  { key: "valuation", label: "التقييم", statuses: ["valuation_in_progress"] },
  { key: "report", label: "التقرير", statuses: ["draft_report_ready", "under_client_review", "revision_in_progress"] },
  { key: "finalization", label: "الإصدار", statuses: ["awaiting_final_payment", "final_payment_received", "report_issued", "closed"] },
];

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

// ── Transition with audit logging ──
export async function transitionStatus(
  assignmentId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!canTransition(fromStatus, toStatus)) {
    return { success: false, error: `لا يمكن الانتقال من "${STATUS_LABELS[fromStatus]?.ar}" إلى "${STATUS_LABELS[toStatus]?.ar}"` };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  // Update assignment status
  const { error: updateErr } = await supabase
    .from("valuation_assignments")
    .update({ status: toStatus as any })
    .eq("id", assignmentId);

  if (updateErr) return { success: false, error: updateErr.message };

  // Log in status_history
  await supabase.from("status_history").insert({
    assignment_id: assignmentId,
    from_status: fromStatus as any,
    to_status: toStatus as any,
    changed_by: user.id,
    reason: reason || null,
  });

  // Log in audit_logs
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "update" as any,
    table_name: "valuation_assignments",
    record_id: assignmentId,
    assignment_id: assignmentId,
    old_data: { status: fromStatus },
    new_data: { status: toStatus },
    description: `تغيير الحالة: ${STATUS_LABELS[fromStatus]?.ar} → ${STATUS_LABELS[toStatus]?.ar}${reason ? ` | السبب: ${reason}` : ""}`,
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
    await transitionStatus(assignmentId, current, "payment_received_initial", "دفعة أولى مؤكدة تلقائياً");
  }
  if (paymentStage === "final" && current === "awaiting_final_payment") {
    await transitionStatus(assignmentId, current, "final_payment_received", "دفعة نهائية مؤكدة تلقائياً");
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
    await transitionStatus(assignmentId, data.status as string, "inspection_submitted", "إرسال معاينة تلقائي");
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
    await transitionStatus(assignmentId, data.status as string, "draft_report_ready", "إنشاء مسودة تقرير تلقائي");
  }
}
