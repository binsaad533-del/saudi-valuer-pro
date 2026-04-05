import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  // Owner
  | "new_request" | "request_ready_review" | "critical_compliance"
  | "high_risk_valuation" | "report_ready_approval" | "report_issued"
  | "client_matching_issue" | "failed_processing" | "archive_import_issue"
  // Client
  | "request_submitted" | "request_processing" | "additional_info_requested"
  | "inspection_scheduled" | "report_completed" | "report_available"
  // Inspector
  | "new_inspection_assigned" | "inspection_date_update"
  | "overdue_inspection" | "inspection_submission_confirmed"
  // Financial
  | "new_payment" | "payment_received" | "overdue_payment" | "payment_mismatch";

export interface SendNotificationParams {
  userId: string;
  notificationType: NotificationType;
  titleAr?: string;
  bodyAr?: string;
  priority?: "low" | "medium" | "high" | "critical";
  actionUrl?: string;
  relatedAssignmentId?: string;
  relatedRequestId?: string;
}

export async function sendNotification(params: SendNotificationParams) {
  const { data, error } = await supabase.functions.invoke("send-notification", {
    body: {
      user_id: params.userId,
      notification_type: params.notificationType,
      title_ar: params.titleAr,
      body_ar: params.bodyAr,
      priority: params.priority,
      action_url: params.actionUrl,
      related_assignment_id: params.relatedAssignmentId,
      related_request_id: params.relatedRequestId,
    },
  });

  if (error) {
    console.error("Failed to send notification:", error);
  }

  return { data, error };
}

// Notification categories for UI display
export const NOTIFICATION_CATEGORIES = {
  workflow: { label: "سير العمل", icon: "ClipboardList" },
  inspection: { label: "المعاينات", icon: "MapPin" },
  report: { label: "التقارير", icon: "FileText" },
  compliance: { label: "الامتثال والمخاطر", icon: "Shield" },
  financial: { label: "المالية", icon: "DollarSign" },
  system: { label: "النظام", icon: "Monitor" },
} as const;

// All notification types grouped by role
export const NOTIFICATION_TYPES_BY_ROLE: Record<string, { type: NotificationType; label: string; category: string }[]> = {
  owner: [
    { type: "new_request", label: "طلب تقييم جديد", category: "workflow" },
    { type: "request_ready_review", label: "طلب جاهز للمراجعة", category: "workflow" },
    { type: "critical_compliance", label: "مشكلة حرجة في الامتثال", category: "compliance" },
    { type: "high_risk_valuation", label: "تقييم عالي المخاطر", category: "compliance" },
    { type: "report_ready_approval", label: "تقرير جاهز للاعتماد", category: "report" },
    { type: "report_issued", label: "تم إصدار التقرير", category: "report" },
    { type: "client_matching_issue", label: "مشكلة مطابقة عميل", category: "system" },
    { type: "failed_processing", label: "فشل في المعالجة", category: "system" },
    { type: "archive_import_issue", label: "مشكلة في استيراد الأرشيف", category: "system" },
  ],
  client: [
    { type: "request_submitted", label: "تم استلام الطلب", category: "workflow" },
    { type: "request_processing", label: "الطلب قيد المعالجة", category: "workflow" },
    { type: "additional_info_requested", label: "مطلوب معلومات إضافية", category: "workflow" },
    { type: "inspection_scheduled", label: "تم جدولة المعاينة", category: "inspection" },
    { type: "report_completed", label: "تم الانتهاء من التقرير", category: "report" },
    { type: "report_available", label: "التقرير متاح للتحميل", category: "report" },
  ],
  inspector: [
    { type: "new_inspection_assigned", label: "معاينة جديدة", category: "inspection" },
    { type: "inspection_date_update", label: "تحديث موعد المعاينة", category: "inspection" },
    { type: "overdue_inspection", label: "تأخير في المعاينة", category: "inspection" },
    { type: "inspection_submission_confirmed", label: "تم استلام المعاينة", category: "inspection" },
  ],
  financial_manager: [
    { type: "new_payment", label: "سجل دفع جديد", category: "financial" },
    { type: "payment_received", label: "تم استلام الدفعة", category: "financial" },
    { type: "overdue_payment", label: "فاتورة متأخرة", category: "financial" },
    { type: "payment_mismatch", label: "تفاوت في المدفوعات", category: "financial" },
  ],
};
