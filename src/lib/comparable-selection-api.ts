import { supabase } from "@/integrations/supabase/client";

export interface SelectedComparable {
  id: string;
  city_ar: string;
  district_ar: string;
  property_type: string;
  land_area: number;
  price: number;
  price_per_sqm: number;
  adjusted_price_per_sqm: number;
  transaction_date: string;
  transaction_type: string;
  is_verified: boolean;
  similarity_score: number;
  adjustments: Array<{
    type: string;
    percentage: number;
    justification_ar: string;
  }>;
  total_adjustment_pct: number;
  sources: Array<{ name_ar: string; type: string; reference: string }>;
}

export interface ComparableSelectionResult {
  success: boolean;
  selected: SelectedComparable[];
  weighted_average_sqm: number;
  estimated_value: number | null;
  value_range: { min: number; max: number };
  confidence_score: number;
  summary: {
    total_found: number;
    after_cleaning: number;
    after_filtering: number;
    final_selected: number;
  };
  explanation_ar: string;
}

export interface ComparableSelectionParams {
  assignment_id: string;
  subject_city_ar?: string;
  subject_district_ar?: string;
  subject_property_type?: string;
  subject_area_sqm?: number;
  subject_age_years?: number;
  subject_condition?: string;
  max_results?: number;
  area_tolerance?: number;
}

export async function runComparableSelection(
  params: ComparableSelectionParams
): Promise<ComparableSelectionResult> {
  const { data, error } = await supabase.functions.invoke(
    "smart-comparable-selection",
    { body: params }
  );

  if (error) throw new Error(error.message || "Comparable selection failed");
  if (data?.error) throw new Error(data.error);
  return data;
}
