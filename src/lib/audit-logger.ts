import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create" | "update" | "delete" | "status_change"
  | "lock" | "unlock" | "sign" | "approve" | "reject" | "return"
  | "view" | "export" | "login" | "logout"
  | "upload" | "merge" | "link" | "generate" | "override";

export type EntityType = "request" | "report" | "client" | "asset" | "inspection" | "payment" | "setting" | "user";

export interface AuditLogParams {
  action: AuditAction;
  tableName: string;
  entityType: EntityType;
  recordId?: string;
  assignmentId?: string;
  clientId?: string;
  description?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

/**
 * Log an audit event. Resolves user name/role from the current session.
 */
export async function logAudit(params: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile for name and role
    let userName = user.email || "مستخدم";
    let userRole = "unknown";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name_ar, full_name_en")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      userName = profile.full_name_ar || profile.full_name_en || userName;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    if (roles && roles.length > 0) {
      userRole = roles[0].role;
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: params.action as any,
      table_name: params.tableName,
      entity_type: params.entityType,
      record_id: params.recordId || null,
      assignment_id: params.assignmentId || null,
      client_id: params.clientId || null,
      description: params.description || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      user_name: userName,
      user_role: userRole,
    } as any);
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

/** Action labels in Arabic */
export const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  status_change: "تغيير الحالة",
  lock: "قفل",
  unlock: "فتح القفل",
  sign: "توقيع",
  approve: "اعتماد",
  reject: "رفض",
  return: "إعادة",
  view: "عرض",
  export: "تصدير",
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  upload: "رفع ملف",
  merge: "دمج",
  link: "ربط",
  generate: "توليد",
  override: "تجاوز القيمة",
};

export const ENTITY_LABELS: Record<string, string> = {
  request: "طلب",
  report: "تقرير",
  client: "عميل",
  asset: "أصل",
  inspection: "معاينة",
  payment: "دفعة",
  setting: "إعداد",
  user: "مستخدم",
};
