import { supabase } from "@/integrations/supabase/client";
import type { ReportLanguage } from "./report-types";

export async function translateReportSections(
  sections: Record<string, string>,
  sourceLang: "ar" | "en",
  targetLang: "ar" | "en"
): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("translate-report", {
    body: { sections, sourceLang, targetLang },
  });

  if (error) throw new Error(error.message || "Translation failed");
  return data.translated_sections;
}

export async function checkBilingualConsistency(params: {
  arabic_conclusion: string;
  english_conclusion: string;
  arabic_value?: number;
  english_value?: number;
}): Promise<{
  consistent: boolean;
  issues: Array<{
    type: string;
    description_ar: string;
    description_en: string;
  }>;
}> {
  const { data, error } = await supabase.functions.invoke("check-consistency", {
    body: params,
  });

  if (error) throw new Error(error.message || "Consistency check failed");
  return data;
}
