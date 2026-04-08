import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "./permissions-engine";
import { runIssuanceGate } from "./issuance-gate";

// ══════════════════════════════════════════════════════════════
// Master Status Matrix v2.0 — 18 حالة موحدة (FINAL)
// مصدر واحد للحقيقة: valuation_assignments.status
// ══════════════════════════════════════════════════════════════

export const WORKFLOW_STATUSES = [
  "draft",
  "submitted",
  "scope_generated",
  "scope_approved",
  "first_payment_confirmed",
  "data_collection_open",
  "data_collection_complete",
  "inspection_pending",
  "inspection_completed",
  "data_validated",
  "analysis_complete",
  "professional_review",
  "draft_report_ready",
  "client_review",
  "draft_approved",
  "final_payment_confirmed",
  "issued",
  "archived",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

// ══════════════════════════════════════════════════════════════
// ALLOWED_TRANSITIONS — المرجع الوحيد لكل انتقال
// ══════════════════════════════════════════════════════════════

export type TransitionType = "auto" | "manual" | "trigger" | "payment_gate";

export interface TransitionRule {
  to: WorkflowStatus;
  type: TransitionType;
  /** Role(s) that can trigger this transition */
  allowed_roles: ("owner" | "client" | "inspector" | "financial_manager" | "system")[];
  /** Human-readable precondition */
  condition_ar: string;
  /** What blocks this transition */
  blocker_ar: string;
  /** Audit log event description */
  audit_event_ar: string;
  /** Available in test mode, production mode, or both */
  payment_mode: "test" | "production" | "both";
  /** Can be bypassed? */
  bypassable: boolean;
  /** Who can bypass and how */
  bypass_info?: { role: "owner"; requires_reason: true };
}

export const TRANSITION_RULES: Record<string, TransitionRule[]> = {
  // ─── 1. INTAKE ───
  draft: [{
    to: "submitted",
    type: "manual",
    allowed_roles: ["client"],
    condition_ar: "إكمال بيانات الطلب الأساسية",
    blocker_ar: "بيانات الطلب غير مكتملة",
    audit_event_ar: "العميل أرسل الطلب",
    payment_mode: "both",
    bypassable: false,
  }, {
    to: "cancelled",
    type: "manual",
    allowed_roles: ["client", "owner"],
    condition_ar: "إلغاء الطلب",
    blocker_ar: "—",
    audit_event_ar: "تم إلغاء الطلب",
    payment_mode: "both",
    bypassable: false,
  }],

  submitted: [{
    to: "scope_generated",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "فحص تعارض المصالح + توليد نطاق العمل (AI أو يدوي)",
    blocker_ar: "لم يتم فحص التعارض أو توليد النطاق",
    audit_event_ar: "تم توليد نطاق العمل",
    payment_mode: "both",
    bypassable: true,
    bypass_info: { role: "owner", requires_reason: true },
  }, {
    to: "cancelled",
    type: "manual",
    allowed_roles: ["client", "owner"],
    condition_ar: "إلغاء الطلب",
    blocker_ar: "—",
    audit_event_ar: "تم إلغاء الطلب",
    payment_mode: "both",
    bypassable: false,
  }],

  scope_generated: [{
    to: "scope_approved",
    type: "manual",
    allowed_roles: ["client"],
    condition_ar: "موافقة العميل على نطاق العمل والسعر",
    blocker_ar: "لم يوافق العميل بعد",
    audit_event_ar: "العميل وافق على نطاق العمل",
    payment_mode: "both",
    bypassable: false,
  }, {
    to: "cancelled",
    type: "manual",
    allowed_roles: ["client", "owner"],
    condition_ar: "إلغاء الطلب",
    blocker_ar: "—",
    audit_event_ar: "تم إلغاء الطلب قبل الموافقة",
    payment_mode: "both",
    bypassable: false,
  }],

  scope_approved: [{
    to: "first_payment_confirmed",
    type: "payment_gate",
    allowed_roles: ["system", "owner"],
    condition_ar: "تأكيد استلام الدفعة الأولى (50%)",
    blocker_ar: "الدفعة الأولى غير مؤكدة",
    audit_event_ar: "تم تأكيد الدفعة الأولى — قفل بيانات الطلب",
    payment_mode: "both",
    bypassable: true,
    bypass_info: { role: "owner", requires_reason: true },
  }],

  // ─── 2. PROCESSING ───
  first_payment_confirmed: [{
    to: "data_collection_open",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "فتح المهمة تلقائياً بعد الدفع",
    blocker_ar: "—",
    audit_event_ar: "تم فتح جمع البيانات",
    payment_mode: "both",
    bypassable: false,
  }],

  data_collection_open: [{
    to: "data_collection_complete",
    type: "manual",
    allowed_roles: ["owner"],
    condition_ar: "تأكيد اكتمال جميع المستندات والبيانات",
    blocker_ar: "البيانات أو المستندات ناقصة",
    audit_event_ar: "تم تأكيد اكتمال جمع البيانات",
    payment_mode: "both",
    bypassable: false,
  }],

  data_collection_complete: [{
    to: "inspection_pending",
    type: "manual",
    allowed_roles: ["owner", "system"],
    condition_ar: "تعيين معاين ميداني",
    blocker_ar: "لم يتم تعيين المعاين",
    audit_event_ar: "تم إسناد المعاينة الميدانية",
    payment_mode: "both",
    bypassable: false,
  }, {
    to: "data_validated",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "تقييم مكتبي — لا حاجة لمعاينة",
    blocker_ar: "—",
    audit_event_ar: "تقييم مكتبي — تخطي المعاينة",
    payment_mode: "both",
    bypassable: false,
  }],

  // ─── 3. INSPECTION ───
  inspection_pending: [{
    to: "inspection_completed",
    type: "manual",
    allowed_roles: ["inspector"],
    condition_ar: "إتمام المعاينة الميدانية ورفع النتائج",
    blocker_ar: "المعاينة لم تكتمل",
    audit_event_ar: "المعاين أكمل المعاينة الميدانية",
    payment_mode: "both",
    bypassable: false,
  }],

  inspection_completed: [{
    to: "data_validated",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "التحقق من صحة البيانات بعد المعاينة (AI أو يدوي)",
    blocker_ar: "البيانات لم يتم التحقق منها",
    audit_event_ar: "تم التحقق من صحة البيانات",
    payment_mode: "both",
    bypassable: true,
    bypass_info: { role: "owner", requires_reason: true },
  }],

  // ─── 4. VALUATION ───
  data_validated: [{
    to: "analysis_complete",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "إكمال التحليل الآلي (AI أو يدوي)",
    blocker_ar: "التحليل الآلي لم يكتمل",
    audit_event_ar: "تم إكمال التحليل الآلي",
    payment_mode: "both",
    bypassable: true,
    bypass_info: { role: "owner", requires_reason: true },
  }],

  analysis_complete: [{
    to: "professional_review",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "التحليل جاهز لمراجعة الحكم المهني",
    blocker_ar: "—",
    audit_event_ar: "تم نقل الملف لمراجعة الحكم المهني",
    payment_mode: "both",
    bypassable: false,
  }],

  professional_review: [{
    to: "draft_report_ready",
    type: "manual",
    allowed_roles: ["owner"],
    condition_ar: "اعتماد القيمة النهائية وإنشاء مسودة التقرير",
    blocker_ar: "لم يتم اعتماد القيمة من المقيّم",
    audit_event_ar: "المقيّم اعتمد القيمة — مسودة التقرير جاهزة",
    payment_mode: "both",
    bypassable: false,
  }],

  // ─── 5. REVIEW ───
  draft_report_ready: [{
    to: "client_review",
    type: "manual",
    allowed_roles: ["owner"],
    condition_ar: "إرسال المسودة للعميل",
    blocker_ar: "المسودة لم تُرسل للعميل",
    audit_event_ar: "تم إرسال المسودة للعميل",
    payment_mode: "both",
    bypassable: false,
  }],

  client_review: [{
    to: "draft_approved",
    type: "manual",
    allowed_roles: ["client"],
    condition_ar: "اعتماد العميل للمسودة",
    blocker_ar: "العميل لم يعتمد المسودة بعد",
    audit_event_ar: "العميل اعتمد المسودة",
    payment_mode: "both",
    bypassable: false,
  }, {
    // ── Critical Reverse Path ──
    to: "professional_review",
    type: "manual",
    allowed_roles: ["owner"],
    condition_ar: "العميل طلب تعديلات جوهرية — إعادة للمراجعة المهنية",
    blocker_ar: "لا يوجد طلب تعديل معتمد",
    audit_event_ar: "إعادة الملف لمراجعة الحكم المهني بسبب ملاحظات العميل",
    payment_mode: "both",
    bypassable: false,
  }],

  // ─── 6. FINALIZATION ───
  draft_approved: [{
    to: "final_payment_confirmed",
    type: "payment_gate",
    allowed_roles: ["system", "owner"],
    condition_ar: "تأكيد استلام الدفعة النهائية (50%)",
    blocker_ar: "الدفعة النهائية غير مؤكدة",
    audit_event_ar: "تم تأكيد الدفعة النهائية",
    payment_mode: "both",
    bypassable: true,
    bypass_info: { role: "owner", requires_reason: true },
  }],

  final_payment_confirmed: [{
    to: "issued",
    type: "manual",
    allowed_roles: ["owner"],
    condition_ar: "اجتياز بوابة الإصدار النهائي (Issuance Gate)",
    blocker_ar: "بوابة الإصدار لم تُجتز",
    audit_event_ar: "تم إصدار التقرير النهائي — القفل الدائم",
    payment_mode: "both",
    bypassable: false,
  }],

  issued: [{
    to: "archived",
    type: "auto",
    allowed_roles: ["system", "owner"],
    condition_ar: "أرشفة ملف العمل كاملاً (10 سنوات)",
    blocker_ar: "—",
    audit_event_ar: "تم أرشفة الملف — لا تعديلات ممكنة",
    payment_mode: "both",
    bypassable: false,
  }],

  archived: [],
  cancelled: [],
};

// ── Flatten to simple map for backward compat ──
export const ALLOWED_TRANSITIONS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TRANSITION_RULES).map(([from, rules]) => [
    from,
    (rules as TransitionRule[]).map((r) => r.to),
  ])
);

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
  cancelled:                "—",
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
  data_collection_open:     { ar: "جمع البيانات", en: "Data Collection Open", icon: "📂", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "جمع بيانات", inspector_ar: "—", finance_ar: "—" },
  data_collection_complete: { ar: "جمع البيانات مكتمل", en: "Data Collection Complete", icon: "📁", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "البيانات مكتملة", inspector_ar: "—", finance_ar: "—" },
  inspection_pending:       { ar: "بانتظار المعاينة", en: "Inspection Pending", icon: "🏗️", phase: "inspection", client_ar: "جاري التنفيذ", owner_ar: "بانتظار المعاينة", inspector_ar: "مهمة جديدة", finance_ar: "—" },
  inspection_completed:     { ar: "المعاينة مكتملة", en: "Inspection Completed", icon: "✔️", phase: "inspection", client_ar: "جاري التنفيذ", owner_ar: "المعاينة مكتملة", inspector_ar: "مكتملة ✓", finance_ar: "—" },
  data_validated:           { ar: "البيانات مُتحققة", en: "Data Validated", icon: "🔍", phase: "processing", client_ar: "جاري التنفيذ", owner_ar: "البيانات مُتحققة", inspector_ar: "—", finance_ar: "—" },
  analysis_complete:        { ar: "التحليل مكتمل", en: "Analysis Complete", icon: "🤖", phase: "valuation", client_ar: "جاري التنفيذ", owner_ar: "تحليل مكتمل", inspector_ar: "—", finance_ar: "—" },
  professional_review:      { ar: "مراجعة الحكم المهني", en: "Professional Review", icon: "👑", phase: "valuation", client_ar: "جاري التنفيذ", owner_ar: "مراجعتك مطلوبة", inspector_ar: "—", finance_ar: "—" },
  draft_report_ready:       { ar: "المسودة جاهزة", en: "Draft Report Ready", icon: "📄", phase: "review", client_ar: "مسودة جاهزة للمراجعة", owner_ar: "مسودة جاهزة", inspector_ar: "—", finance_ar: "—" },
  client_review:            { ar: "مراجعة العميل", en: "Client Review", icon: "👤", phase: "review", client_ar: "يرجى مراجعة المسودة", owner_ar: "بانتظار ملاحظات العميل", inspector_ar: "—", finance_ar: "—" },
  draft_approved:           { ar: "المسودة معتمدة", en: "Draft Approved", icon: "✅", phase: "review", client_ar: "بانتظار السداد النهائي", owner_ar: "العميل اعتمد المسودة", inspector_ar: "—", finance_ar: "بانتظار الدفعة النهائية" },
  final_payment_confirmed:  { ar: "الدفعة النهائية مؤكدة", en: "Final Payment Confirmed", icon: "💰", phase: "finalization", client_ar: "جاري الإصدار", owner_ar: "جاهز للإصدار النهائي", inspector_ar: "—", finance_ar: "مدفوع بالكامل ✓" },
  issued:                   { ar: "صادر", en: "Issued", icon: "📜", phase: "finalization", client_ar: "التقرير جاهز", owner_ar: "صادر ✓", inspector_ar: "—", finance_ar: "صادر ✓" },
  archived:                 { ar: "مؤرشف", en: "Archived", icon: "🗄️", phase: "finalization", client_ar: "مكتمل", owner_ar: "مؤرشف", inspector_ar: "—", finance_ar: "مؤرشف" },
  cancelled:                { ar: "ملغي", en: "Cancelled", icon: "🚫", phase: "finalization", client_ar: "ملغي", owner_ar: "ملغي", inspector_ar: "—", finance_ar: "ملغي" },
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
  data_collection_open: "bg-accent text-accent-foreground",
  data_collection_complete: "bg-accent text-accent-foreground",
  inspection_pending: "bg-warning/10 text-warning",
  inspection_completed: "bg-success/10 text-success",
  data_validated: "bg-accent text-accent-foreground",
  analysis_complete: "bg-primary/10 text-primary",
  professional_review: "bg-warning/10 text-warning",
  draft_report_ready: "bg-primary/10 text-primary",
  client_review: "bg-warning/10 text-warning",
  draft_approved: "bg-success/10 text-success",
  final_payment_confirmed: "bg-success/10 text-success",
  issued: "bg-success/10 text-success",
  archived: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

// ── Phase grouping for pipeline view ──
export const PIPELINE_PHASES = [
  { key: "intake", label: "الاستقبال والنطاق", statuses: ["draft", "submitted", "scope_generated", "scope_approved", "first_payment_confirmed"] },
  { key: "processing", label: "المعالجة والبيانات", statuses: ["data_collection_open", "data_collection_complete"] },
  { key: "inspection", label: "المعاينة", statuses: ["inspection_pending", "inspection_completed"] },
  { key: "validation", label: "التحقق والتحليل", statuses: ["data_validated", "analysis_complete"] },
  { key: "valuation", label: "التقييم والحكم المهني", statuses: ["professional_review"] },
  { key: "review", label: "المراجعة والاعتماد", statuses: ["draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"] },
  { key: "finalization", label: "الإصدار والأرشفة", statuses: ["issued", "archived", "cancelled"] },
];

// ── AI steps with manual fallback ──
export const AI_STEPS_WITH_FALLBACK: Record<string, {
  ai_trigger: string;
  edge_function: string;
  fallback_label_ar: string;
  from_status: WorkflowStatus;
  to_status: WorkflowStatus;
}> = {
  sow_generation: {
    ai_trigger: "ai_intake_and_sow",
    edge_function: "ai-intake",
    fallback_label_ar: "إنشاء نطاق العمل يدوياً",
    from_status: "submitted",
    to_status: "scope_generated",
  },
  data_validation: {
    ai_trigger: "ai_data_validation",
    edge_function: "check-consistency",
    fallback_label_ar: "التحقق من البيانات يدوياً",
    from_status: "inspection_completed",
    to_status: "data_validated",
  },
  analysis: {
    ai_trigger: "ai_analysis",
    edge_function: "valuation-engine",
    fallback_label_ar: "إجراء التحليل يدوياً",
    from_status: "data_validated",
    to_status: "analysis_complete",
  },
  report_generation: {
    ai_trigger: "ai_report_generation",
    edge_function: "generate-report-content",
    fallback_label_ar: "إنشاء مسودة التقرير يدوياً",
    from_status: "professional_review",
    to_status: "draft_report_ready",
  },
};

// ── Automation: AI-driven transitions (no human needed) ──
export const AUTOMATED_TRANSITIONS: Record<string, { to: string; trigger: string }> = {
  submitted:                { to: "scope_generated", trigger: "ai_intake_and_sow" },
  first_payment_confirmed:  { to: "data_collection_open", trigger: "auto_open_data_collection" },
  inspection_completed:     { to: "data_validated", trigger: "ai_data_validation" },
  data_validated:           { to: "analysis_complete", trigger: "ai_analysis" },
  issued:                   { to: "archived", trigger: "auto_archive" },
};

// ── Human checkpoints — require manual action ──
export const HUMAN_CHECKPOINTS: Record<string, { role: string; action_ar: string }> = {
  scope_approved:      { role: "client", action_ar: "موافقة العميل على نطاق العمل" },
  data_collection_complete: { role: "owner", action_ar: "تأكيد اكتمال جمع البيانات" },
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

/** Get transition rules for a specific from→to pair */
export function getTransitionRule(from: string, to: string): TransitionRule | undefined {
  return TRANSITION_RULES[from]?.find((r) => r.to === to);
}

/** Check if a role can trigger a specific transition */
export function canRoleTransition(from: string, to: string, role: string): boolean {
  const rule = getTransitionRule(from, to);
  if (!rule) return false;
  return rule.allowed_roles.includes(role as any) || rule.allowed_roles.includes("system");
}

// ── Backward compatibility: map old statuses to new ──
export function normalizeStatus(status: string): WorkflowStatus {
  const mapping: Record<string, WorkflowStatus> = {
    // Old naming
    data_collection: "data_collection_open",
    // Old 8-status mapping
    processing: "data_collection_open",
    inspection: "inspection_pending",
    valuation_ready: "analysis_complete",
    under_review: "professional_review",
    approved: "final_payment_confirmed",
    // Legacy statuses from old enum
    client_submitted: "submitted",
    under_ai_review: "data_collection_open",
    awaiting_client_info: "data_collection_open",
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

// ══════════════════════════════════════════════════════════════
// Central transition — delegates to DB function update_request_status
// All validation, payment gates, locks, and audit logging happen server-side
// ══════════════════════════════════════════════════════════════

export async function transitionStatus(
  assignmentId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string,
  automatedBy?: string,
  options?: { actionType?: "normal" | "simulated" | "bypass" | "auto"; bypassJustification?: string }
): Promise<{ success: boolean; error?: string }> {
  // Client-side pre-check (fast fail before DB call)
  if (!canTransition(fromStatus, toStatus)) {
    return {
      success: false,
      error: `لا يمكن الانتقال من "${STATUS_LABELS[fromStatus]?.ar || fromStatus}" إلى "${STATUS_LABELS[toStatus]?.ar || toStatus}"`,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !automatedBy) return { success: false, error: "غير مسجل الدخول" };

  // Issuance gate (client-side check — also enforced by DB locks)
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

  const actionType = options?.actionType || (automatedBy ? "auto" : "normal");
  const transitionReason = automatedBy
    ? `[تلقائي: ${automatedBy}] ${reason || ""}`
    : reason || null;

  // Call the server-side function — single source of truth
  const { data, error } = await supabase.rpc("update_request_status", {
    _assignment_id: assignmentId,
    _new_status: toStatus,
    _user_id: user?.id || null,
    _action_type: actionType,
    _reason: transitionReason,
    _bypass_justification: options?.bypassJustification || null,
  });

  if (error) return { success: false, error: error.message };

  const result = data as any;
  if (result && typeof result === "object" && result.success === false) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// AI Manual Fallback — execute AI step or skip manually
// ══════════════════════════════════════════════════════════════

export async function executeAiStepWithFallback(
  assignmentId: string,
  stepKey: keyof typeof AI_STEPS_WITH_FALLBACK,
  mode: "ai" | "manual"
): Promise<{ success: boolean; error?: string }> {
  const step = AI_STEPS_WITH_FALLBACK[stepKey];
  if (!step) return { success: false, error: "خطوة غير معروفة" };

  const { data } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!data) return { success: false, error: "الملف غير موجود" };
  const currentStatus = data.status as string;

  // Verify we're at the right status
  if (normalizeStatus(currentStatus) !== step.from_status) {
    return { success: false, error: `الملف في حالة "${STATUS_LABELS[currentStatus]?.ar}" — يجب أن يكون في "${STATUS_LABELS[step.from_status]?.ar}"` };
  }

  if (mode === "ai") {
    try {
      await supabase.functions.invoke(step.edge_function, { body: { assignment_id: assignmentId } });
    } catch {
      // AI failed — notify but don't block
      console.error(`AI step ${stepKey} failed, manual fallback available`);
      return { success: false, error: `فشل التنفيذ الآلي — يمكن التنفيذ يدوياً` };
    }
  }

  // Transition regardless of mode
  const result = await transitionStatus(
    assignmentId,
    step.from_status,
    step.to_status,
    undefined,
    mode === "ai" ? step.ai_trigger : `تنفيذ يدوي: ${step.fallback_label_ar}`
  );

  return result;
}

// ══════════════════════════════════════════════════════════════
// Client Edit Request (post-payment)
// ══════════════════════════════════════════════════════════════

export async function requestPostPaymentEdit(
  assignmentId: string,
  editReason: string
): Promise<{ success: boolean; error?: string }> {
  if (!editReason || editReason.trim().length < 10) {
    return { success: false, error: "يجب كتابة سبب تفصيلي للتعديل (10 أحرف على الأقل)" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "غير مسجل الدخول" };

  const { data: assignment } = await supabase
    .from("valuation_assignments")
    .select("status")
    .eq("id", assignmentId)
    .single();

  if (!assignment) return { success: false, error: "الملف غير موجود" };

  const status = normalizeStatus(assignment.status as string);
  const editableStatuses: WorkflowStatus[] = [
    "data_collection_open", "data_collection_complete",
    "inspection_pending", "inspection_completed",
    "data_validated", "analysis_complete", "professional_review",
  ];

  if (!editableStatuses.includes(status)) {
    return { success: false, error: "لا يمكن طلب تعديل في هذه المرحلة" };
  }

  // Log the edit request in audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "status_change" as any,
    table_name: "valuation_assignments",
    record_id: assignmentId,
    assignment_id: assignmentId,
    description: `طلب تعديل بيانات بعد الدفع — السبب: ${editReason}`,
    new_data: { edit_request: true, reason: editReason, requested_by: "client" },
  });

  // Create notification for owner
  await supabase.from("notifications").insert({
    user_id: user.id, // Will be replaced by owner lookup
    title_ar: "طلب تعديل بيانات من العميل",
    body_ar: `العميل يطلب تعديل بيانات الطلب: ${editReason}`,
    category: "workflow",
    priority: "high",
    notification_type: "edit_request",
    channel: "in_app",
    delivery_status: "delivered",
    related_assignment_id: assignmentId,
  });

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
  if (currentStatus !== "final_payment_confirmed") {
    return { success: false, error: `الملف في مرحلة "${STATUS_LABELS[currentStatus]?.ar || currentStatus}" — يجب أن يكون في مرحلة "الدفعة النهائية مؤكدة"` };
  }

  const gate = await runIssuanceGate(assignmentId, userRole);
  if (!gate.can_issue) {
    const reasons = gate.blocked_reasons_ar.join("، ");
    return { success: false, error: `لا يمكن إصدار التقرير: ${reasons}` };
  }

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

export async function triggerAutomationPipeline(assignmentId: string) {
  try {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("status, valuation_mode, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const currentStatus = (data?.status as string) || "";

    if (currentStatus === "submitted" || currentStatus === "first_payment_confirmed") {
      if (currentStatus === "submitted") {
        await transitionStatus(assignmentId, "submitted", "scope_generated", undefined, "توليد نطاق العمل");
        await supabase.functions.invoke("ai-intake", { body: { assignment_id: assignmentId } });
      }
    }

    if (currentStatus === "first_payment_confirmed") {
      await transitionStatus(assignmentId, "first_payment_confirmed", "data_collection_open", undefined, "فتح جمع البيانات");
    }
  } catch (err) {
    console.error("Automation pipeline error:", err);
  }
}

export async function triggerPostDataPipeline(assignmentId: string) {
  try {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("valuation_mode, subjects(city_ar, district_ar, latitude, longitude)")
      .eq("id", assignmentId)
      .single();

    const isDesktop = data?.valuation_mode === "desktop";

    if (isDesktop) {
      await transitionStatus(assignmentId, "data_collection_complete", "data_validated", undefined, "تقييم مكتبي — تخطي المعاينة");
    } else {
      await transitionStatus(assignmentId, "data_collection_complete", "inspection_pending", undefined, "معاينة ميدانية مطلوبة");

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

export async function triggerPostInspectionPipeline(assignmentId: string) {
  try {
    await transitionStatus(assignmentId, "inspection_completed", "data_validated", undefined, "التحقق من البيانات بعد المعاينة");
    await transitionStatus(assignmentId, "data_validated", "analysis_complete", undefined, "التحليل الآلي");

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
      await transitionStatus(assignmentId, "first_payment_confirmed", "data_collection_open", undefined, "بدء جمع البيانات");
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

// ══════════════════════════════════════════════════════════════
// Role-based status visibility helpers
// ══════════════════════════════════════════════════════════════

export function getStatusLabelForRole(status: string, role: "client" | "owner" | "inspector" | "financial_manager"): string {
  const info = STATUS_LABELS[status];
  if (!info) return status;
  switch (role) {
    case "client": return info.client_ar;
    case "owner": return info.owner_ar;
    case "inspector": return info.inspector_ar;
    case "financial_manager": return info.finance_ar;
    default: return info.ar;
  }
}

export function getVisibleStatusesForRole(role: "client" | "owner" | "inspector" | "financial_manager"): WorkflowStatus[] {
  if (role === "owner" || role === "financial_manager") return [...WORKFLOW_STATUSES];
  if (role === "inspector") return ["inspection_pending", "inspection_completed"];
  // Client sees all but with simplified labels
  return [...WORKFLOW_STATUSES];
}

export function getActionableStatusesForRole(role: "client" | "owner" | "inspector" | "financial_manager"): WorkflowStatus[] {
  switch (role) {
    case "client":
      return ["draft", "scope_generated", "client_review"];
    case "inspector":
      return ["inspection_pending"];
    case "owner":
      return ["data_collection_open", "data_collection_complete", "professional_review", "draft_report_ready", "final_payment_confirmed"];
    case "financial_manager":
      return [];
    default:
      return [];
  }
}
