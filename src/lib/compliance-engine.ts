/**
 * Compliance Engine Client — محرك الامتثال
 * Client-side interface to the compliance enforcement system.
 */

import { supabase } from "@/integrations/supabase/client";

export type ComplianceStage =
  | "asset_extraction"
  | "asset_review"
  | "valuation_calculation"
  | "reconciliation"
  | "report_generation"
  | "report_issuance";

export interface ComplianceResult {
  rule_id: string;
  rule_title_ar: string;
  severity: "warning" | "blocking";
  passed: boolean;
  violation_message: string | null;
}

export interface ComplianceReport {
  stage: ComplianceStage;
  total_rules: number;
  passed: number;
  failed: number;
  blockers: number;
  can_proceed: boolean;
  results: ComplianceResult[];
}

export async function runComplianceCheck(
  assignmentId: string,
  stage: ComplianceStage
): Promise<ComplianceReport> {
  const { data, error } = await supabase.functions.invoke("enforce-compliance", {
    body: { assignment_id: assignmentId, stage },
  });

  if (error) throw new Error(error.message || "فشل فحص الامتثال");
  return data as ComplianceReport;
}

export async function getComplianceHistory(
  assignmentId: string
): Promise<Record<string, { passed: number; failed: number; blockers: number }>> {
  const { data, error } = await supabase
    .from("compliance_check_results")
    .select("stage, passed, raqeem_rules(severity)")
    .eq("assignment_id", assignmentId);

  if (error || !data) return {};

  const grouped: Record<string, { passed: number; failed: number; blockers: number }> = {};

  for (const row of data as any[]) {
    const stage = row.stage;
    if (!grouped[stage]) grouped[stage] = { passed: 0, failed: 0, blockers: 0 };

    if (row.passed) {
      grouped[stage].passed++;
    } else {
      grouped[stage].failed++;
      if (row.raqeem_rules?.severity === "blocking") {
        grouped[stage].blockers++;
      }
    }
  }

  return grouped;
}

export async function ingestKnowledgeDocument(knowledgeId: string) {
  const { data, error } = await supabase.functions.invoke("ingest-knowledge", {
    body: { knowledge_id: knowledgeId },
  });

  if (error) throw new Error(error.message || "فشل استخراج القواعد");
  return data as { rules_extracted: number; rules_inserted: number; chunks_processed: number };
}

export const STAGE_LABELS: Record<ComplianceStage, { ar: string; en: string }> = {
  asset_extraction: { ar: "استخراج الأصول", en: "Asset Extraction" },
  asset_review: { ar: "مراجعة الأصول", en: "Asset Review" },
  valuation_calculation: { ar: "حسابات التقييم", en: "Valuation Calculation" },
  reconciliation: { ar: "المصالحة", en: "Reconciliation" },
  report_generation: { ar: "إعداد التقرير", en: "Report Generation" },
  report_issuance: { ar: "إصدار التقرير", en: "Report Issuance" },
};
