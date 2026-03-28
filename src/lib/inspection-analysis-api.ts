import { supabase } from "@/integrations/supabase/client";

export interface InspectionAnalysisResult {
  success: boolean;
  analysis_id: string;
  condition_rating: string;
  condition_score: number;
  quality_score: number;
  defects_count: number;
  risk_flags_count: number;
  depreciation: {
    physical: number;
    functional: number;
    external: number;
  };
}

export async function triggerInspectionAnalysis(inspectionId: string): Promise<InspectionAnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-inspection", {
    body: { inspection_id: inspectionId },
  });
  if (error) throw new Error(error.message || "Analysis failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getInspectionAnalysis(inspectionId: string) {
  const { data, error } = await supabase
    .from("inspection_analysis" as any)
    .select("*")
    .eq("inspection_id", inspectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function overrideAnalysis(
  analysisId: string,
  overrides: {
    condition_rating?: string;
    condition_score?: number;
    quality_score?: number;
    finishing_level?: string;
    physical_depreciation_pct?: number;
    functional_obsolescence_pct?: number;
    external_obsolescence_pct?: number;
    condition_adjustment_pct?: number;
    override_notes?: string;
  }
) {
  // First get current data to save as original
  const { data: current } = await supabase
    .from("inspection_analysis" as any)
    .select("*")
    .eq("id", analysisId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("inspection_analysis" as any)
    .update({
      ...overrides,
      is_overridden: true,
      override_by: user?.id,
      override_at: new Date().toISOString(),
      original_ai_data: current ? {
        condition_rating: (current as any).condition_rating,
        condition_score: (current as any).condition_score,
        quality_score: (current as any).quality_score,
        finishing_level: (current as any).finishing_level,
        physical_depreciation_pct: (current as any).physical_depreciation_pct,
        functional_obsolescence_pct: (current as any).functional_obsolescence_pct,
        external_obsolescence_pct: (current as any).external_obsolescence_pct,
        condition_adjustment_pct: (current as any).condition_adjustment_pct,
      } : null,
    } as any)
    .eq("id", analysisId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
