import { supabase } from "@/integrations/supabase/client";

export interface ValuationEngineResult {
  success: boolean;
  report_id: string;
  final_value: number;
  final_value_text_ar: string;
  confidence_level: string;
  compliance: {
    ready: boolean;
    passed: number;
    total: number;
    mandatory_failures: number;
  };
  pipeline_steps: {
    normalized_data: any;
    market_data: any;
    hbu: any;
    valuation: any;
    reconciliation: any;
  };
}

export interface ComplianceResult {
  checks: Array<{
    code: string;
    name_ar: string;
    name_en: string;
    category: string;
    passed: boolean;
    mandatory: boolean;
  }>;
  total: number;
  passed: number;
  failed: number;
  mandatory_failures: number;
  ready_for_issuance: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  report_url: string;
  report_json: any;
  type: "draft" | "final";
  signature_hash?: string;
}

export type ReportVersionType =
  | "revision"
  | "change_intended_users"
  | "change_purpose"
  | "minor_update"
  | "revaluation"
  | "addendum";

export async function runFullValuation(
  assignmentId: string,
  requestId?: string
): Promise<ValuationEngineResult> {
  const { data, error } = await supabase.functions.invoke("valuation-engine", {
    body: {
      action: "run_full_valuation",
      assignment_id: assignmentId,
      request_id: requestId,
    },
  });

  if (error) throw new Error(error.message || "Valuation engine failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function runComplianceCheck(
  assignmentId: string
): Promise<ComplianceResult> {
  const { data, error } = await supabase.functions.invoke("valuation-engine", {
    body: {
      action: "compliance_check",
      assignment_id: assignmentId,
    },
  });

  if (error) throw new Error(error.message || "Compliance check failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function generateReportPDF(
  assignmentId: string,
  reportId: string,
  type: "draft" | "final"
): Promise<ReportGenerationResult> {
  const { data, error } = await supabase.functions.invoke("generate-report-pdf", {
    body: {
      assignment_id: assignmentId,
      report_id: reportId,
      type,
    },
  });

  if (error) throw new Error(error.message || "Report generation failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createNewReportVersion(
  assignmentId: string,
  previousReportId: string
): Promise<{ report_id: string; version: number }> {
  // Fetch previous report
  const { data: prevReport, error: fetchErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", previousReportId)
    .single();

  if (fetchErr || !prevReport) throw new Error("Previous report not found");

  const newVersion = (prevReport.version || 1) + 1;

  // Create new version
  const { data: newReport, error: createErr } = await supabase
    .from("reports")
    .insert({
      assignment_id: assignmentId,
      report_type: prevReport.report_type,
      language: prevReport.language,
      title_ar: prevReport.title_ar,
      title_en: prevReport.title_en,
      content_ar: prevReport.content_ar as any,
      content_en: prevReport.content_en as any,
      cover_page: prevReport.cover_page as any,
      version: newVersion,
      status: "draft",
      is_final: false,
      previous_version_id: previousReportId,
    })
    .select()
    .single();

  if (createErr || !newReport) throw new Error("Failed to create new report version");

  // Mark previous as superseded
  await supabase
    .from("reports")
    .update({ superseded_by: newReport.id } as any)
    .eq("id", previousReportId);

  // Log the version creation
  await supabase.from("report_change_log").insert({
    report_id: newReport.id,
    version_from: prevReport.version,
    version_to: newVersion,
    change_type: "new_version",
    change_summary_ar: `إنشاء إصدار جديد ${newVersion} من التقرير`,
    change_summary_en: `Created new version ${newVersion} of the report`,
  });

  return { report_id: newReport.id, version: newVersion };
}
