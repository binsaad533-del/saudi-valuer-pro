/**
 * Workflow Status Helper
 * Ensures ALL status changes go through update_request_status RPC
 * Direct .update({ status }) on valuation_requests is PROHIBITED
 */
import { supabase } from "@/integrations/supabase/client";

interface StatusChangeResult {
  success: boolean;
  error?: string;
  old_status?: string;
  new_status?: string;
}

/**
 * Change request status via the centralized RPC.
 * This is the ONLY allowed way to change valuation_requests/assignments status.
 */
export async function changeRequestStatus(
  assignmentId: string,
  newStatus: string,
  options?: {
    userId?: string;
    actionType?: "normal" | "auto" | "simulated" | "bypass";
    reason?: string;
    bypassJustification?: string;
  }
): Promise<StatusChangeResult> {
  const { data, error } = await supabase.rpc("update_request_status", {
    _assignment_id: assignmentId,
    _new_status: newStatus,
    _user_id: options?.userId || null,
    _action_type: options?.actionType || "normal",
    _reason: options?.reason || null,
    _bypass_justification: options?.bypassJustification || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as any;
  if (!result?.success) {
    return { success: false, error: result?.error || "فشل تغيير الحالة" };
  }

  return {
    success: true,
    old_status: result.old_status,
    new_status: result.new_status,
  };
}

/**
 * Resolve assignment_id from a request_id, then change status.
 * Use when only request_id is available.
 */
export async function changeStatusByRequestId(
  requestId: string,
  newStatus: string,
  options?: {
    userId?: string;
    actionType?: "normal" | "auto" | "simulated" | "bypass";
    reason?: string;
    bypassJustification?: string;
  }
): Promise<StatusChangeResult> {
  // Look up assignment_id from request
  const { data: req, error: lookupErr } = await supabase
    .from("valuation_requests" as any)
    .select("assignment_id")
    .eq("id", requestId)
    .single();

  const reqData = req as any;
  if (lookupErr || !reqData?.assignment_id) {
    return { success: false, error: "لم يتم العثور على ملف التقييم المرتبط بالطلب" };
  }

  return changeRequestStatus(reqData.assignment_id, newStatus, options);
}
