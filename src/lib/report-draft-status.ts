/**
 * Centralized report_drafts status management.
 * All report draft status transitions MUST go through this module.
 * Direct .update({ status }) on report_drafts is PROHIBITED.
 */
import { supabase } from "@/integrations/supabase/client";

export type ReportDraftStatus =
  | "draft"
  | "approved"
  | "sent_to_client"
  | "client_approved"
  | "client_revision_requested"
  | "issued"
  | "archived";

const ALLOWED_TRANSITIONS: Record<ReportDraftStatus, ReportDraftStatus[]> = {
  draft: ["approved"],
  approved: ["sent_to_client"],
  sent_to_client: ["client_approved", "client_revision_requested"],
  client_approved: ["issued"],
  client_revision_requested: ["draft", "approved"],
  issued: ["archived"],
  archived: [],
};

interface TransitionResult {
  success: boolean;
  error?: string;
}

/**
 * Update report_drafts status with transition validation.
 * This is the ONLY allowed way to change report_drafts.status.
 */
export async function updateReportDraftStatus(
  draftId: string,
  newStatus: ReportDraftStatus,
  extraFields?: Record<string, any>
): Promise<TransitionResult> {
  // Fetch current status
  const { data: current, error: fetchErr } = await supabase
    .from("report_drafts" as any)
    .select("status")
    .eq("id", draftId)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: "تعذر العثور على المسودة" };
  }

  const currentStatus = (current as any).status as ReportDraftStatus;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `انتقال غير مسموح للمسودة: ${currentStatus} → ${newStatus}`,
    };
  }

  const updatePayload: Record<string, any> = {
    status: newStatus,
    ...extraFields,
  };

  const { error: updateErr } = await supabase
    .from("report_drafts" as any)
    .update(updatePayload as any)
    .eq("id", draftId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  return { success: true };
}
