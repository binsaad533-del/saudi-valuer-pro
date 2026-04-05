/**
 * Role-Based Permissions Engine — مصفوفة الصلاحيات المبسطة
 * AI-first platform: only 4 roles remain.
 */

export type PlatformRole = "owner" | "financial_manager" | "inspector" | "client";

export type PlatformAction =
  // Request lifecycle
  | "create_request"
  | "edit_request_data"
  | "cancel_request"
  // Asset review
  | "approve_asset_review"
  | "edit_extracted_assets"
  // Valuation
  | "run_valuation"
  | "edit_assumptions"
  | "override_value"
  | "approve_final_value"
  // Report
  | "edit_report_draft"
  | "approve_report_draft"
  | "issue_final_report"
  | "create_report_version"
  | "create_revaluation"
  // Administration
  | "manage_inspectors"
  | "manage_clients"
  | "view_financials"
  | "manage_settings"
  | "view_audit_logs";

/**
 * Permission matrix: role → allowed actions
 * Owner has full control. All other roles are narrowly scoped.
 */
const PERMISSION_MATRIX: Record<PlatformRole, Set<PlatformAction>> = {
  owner: new Set([
    "create_request",
    "edit_request_data",
    "cancel_request",
    "approve_asset_review",
    "edit_extracted_assets",
    "run_valuation",
    "edit_assumptions",
    "override_value",
    "approve_final_value",
    "edit_report_draft",
    "approve_report_draft",
    "issue_final_report",
    "create_report_version",
    "create_revaluation",
    "manage_inspectors",
    "manage_clients",
    "view_financials",
    "manage_settings",
    "view_audit_logs",
  ]),
  financial_manager: new Set([
    "view_financials",
    "view_audit_logs",
  ]),
  inspector: new Set([
    // Inspector can only perform field work — no valuation or report actions
  ]),
  client: new Set([
    "create_request",
    "cancel_request",
  ]),
};

/**
 * Roles allowed to issue final reports — owner only in AI-first model
 */
export const ISSUANCE_ROLES: PlatformRole[] = ["owner"];

/**
 * Roles allowed to approve final value
 */
export const VALUE_APPROVAL_ROLES: PlatformRole[] = ["owner"];

/**
 * Actions that require written justification when performed
 */
export const JUSTIFICATION_REQUIRED: PlatformAction[] = [
  "override_value",
  "cancel_request",
  "create_revaluation",
];

export function hasPermission(role: string | null, action: PlatformAction): boolean {
  if (!role) return false;
  // Backward compatibility: treat admin_coordinator as owner
  const normalizedRole = role === "admin_coordinator" || role === "valuation_manager" || role === "valuer"
    ? "owner" : role;
  const perms = PERMISSION_MATRIX[normalizedRole as PlatformRole];
  if (!perms) return false;
  return perms.has(action);
}

export function canIssueReport(role: string | null): boolean {
  if (!role) return false;
  const normalized = role === "admin_coordinator" || role === "valuation_manager" ? "owner" : role;
  return ISSUANCE_ROLES.includes(normalized as PlatformRole);
}

export function canApproveValue(role: string | null): boolean {
  if (!role) return false;
  const normalized = role === "admin_coordinator" || role === "valuation_manager" || role === "valuer" ? "owner" : role;
  return VALUE_APPROVAL_ROLES.includes(normalized as PlatformRole);
}

export function requiresJustification(action: PlatformAction): boolean {
  return JUSTIFICATION_REQUIRED.includes(action);
}

export function getAllowedActions(role: string | null): PlatformAction[] {
  if (!role) return [];
  const normalized = role === "admin_coordinator" || role === "valuation_manager" || role === "valuer" ? "owner" : role;
  const perms = PERMISSION_MATRIX[normalized as PlatformRole];
  if (!perms) return [];
  return Array.from(perms);
}

export function getActionLabel(action: PlatformAction): { ar: string; en: string } {
  const labels: Record<PlatformAction, { ar: string; en: string }> = {
    create_request: { ar: "إنشاء طلب", en: "Create request" },
    edit_request_data: { ar: "تعديل بيانات الطلب", en: "Edit request data" },
    cancel_request: { ar: "إلغاء طلب", en: "Cancel request" },
    approve_asset_review: { ar: "اعتماد مراجعة الأصول", en: "Approve asset review" },
    edit_extracted_assets: { ar: "تعديل الأصول المستخرجة", en: "Edit extracted assets" },
    run_valuation: { ar: "تشغيل التقييم", en: "Run valuation" },
    edit_assumptions: { ar: "تعديل الافتراضات", en: "Edit assumptions" },
    override_value: { ar: "تجاوز القيمة", en: "Override value" },
    approve_final_value: { ar: "اعتماد القيمة النهائية", en: "Approve final value" },
    edit_report_draft: { ar: "تعديل مسودة التقرير", en: "Edit report draft" },
    approve_report_draft: { ar: "اعتماد مسودة التقرير", en: "Approve report draft" },
    issue_final_report: { ar: "إصدار التقرير النهائي", en: "Issue final report" },
    create_report_version: { ar: "إنشاء إصدار جديد", en: "Create report version" },
    create_revaluation: { ar: "إعادة تقييم", en: "Create revaluation" },
    manage_inspectors: { ar: "إدارة المعاينين", en: "Manage inspectors" },
    manage_clients: { ar: "إدارة العملاء", en: "Manage clients" },
    view_financials: { ar: "عرض البيانات المالية", en: "View financials" },
    manage_settings: { ar: "إدارة الإعدادات", en: "Manage settings" },
    view_audit_logs: { ar: "عرض سجلات التدقيق", en: "View audit logs" },
  };
  return labels[action];
}
