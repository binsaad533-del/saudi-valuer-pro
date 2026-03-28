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
}

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
