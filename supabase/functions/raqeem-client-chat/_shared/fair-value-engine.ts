/**
 * المستوى 36 — محرك القيمة العادلة IFRS 13
 * قياس القيمة العادلة وتصنيف المدخلات (المستوى 1/2/3)
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface FairValueMeasurement {
  assetName: string;
  fairValue: number;
  inputLevel: 1 | 2 | 3;
  inputLevelAr: string;
  valuationTechnique: string;
  keyInputs: string[];
  uncertainty: "low" | "medium" | "high";
}

export interface FairValueResult {
  section: string;
  measurements: FairValueMeasurement[];
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalFairValue: number;
}

export async function analyzeFairValue(
  db: SupabaseClient,
  assignmentId?: string
): Promise<FairValueResult> {
  const empty: FairValueResult = { section: "", measurements: [], level1Count: 0, level2Count: 0, level3Count: 0, totalFairValue: 0 };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, category, asset_type")
      .in("job_id", jobs.map(j => j.id))
      .limit(200);
    if (!assets?.length) return empty;

    const measurements: FairValueMeasurement[] = [];
    let l1 = 0, l2 = 0, l3 = 0, totalFV = 0;

    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      const value = Number(d.fair_value || d.value || d.market_value || d.cost || 0);
      if (value <= 0) continue;

      const type = (asset.asset_type || asset.category || "").toLowerCase();

      // Determine input level based on asset type and data availability
      let inputLevel: 1 | 2 | 3;
      let technique: string;
      let inputs: string[];
      let uncertainty: FairValueMeasurement["uncertainty"];

      if (d.market_price || d.listed_price || type.includes("سهم") || type.includes("stock")) {
        // Level 1 — quoted prices in active markets
        inputLevel = 1;
        technique = "أسعار معلنة في سوق نشط";
        inputs = ["سعر الإغلاق", "حجم التداول", "سوق تداول"];
        uncertainty = "low";
      } else if (d.comparable_price || d.transaction_price || type.includes("عقار") || type.includes("أرض")) {
        // Level 2 — observable inputs
        inputLevel = 2;
        technique = "أسلوب المقارنة بالصفقات المماثلة";
        inputs = ["أسعار صفقات مماثلة", "تعديلات الموقع والمساحة", "بيانات وزارة العدل"];
        uncertainty = "medium";
      } else {
        // Level 3 — unobservable inputs
        inputLevel = 3;
        technique = "أسلوب التكلفة / الدخل (مدخلات غير ملحوظة)";
        inputs = ["تكلفة الإحلال", "معدلات الإهلاك", "تقدير الإيرادات المستقبلية", "معدل الخصم"];
        uncertainty = "high";
      }

      measurements.push({
        assetName: asset.name, fairValue: Math.round(value), inputLevel,
        inputLevelAr: `المستوى ${inputLevel}`,
        valuationTechnique: technique, keyInputs: inputs, uncertainty,
      });

      if (inputLevel === 1) l1++; else if (inputLevel === 2) l2++; else l3++;
      totalFV += value;
    }

    if (measurements.length === 0) return empty;

    let section = "\n\n## قياس القيمة العادلة (IFRS 13)\n";
    section += `- إجمالي القيمة العادلة: ${Math.round(totalFV).toLocaleString()} ر.س\n`;

    section += `\n### هرمية المدخلات:\n`;
    section += `| المستوى | الوصف | العدد | النسبة |\n|---|---|---|---|\n`;
    section += `| المستوى 1 | أسعار معلنة في أسواق نشطة | ${l1} | ${Math.round((l1 / measurements.length) * 100)}% |\n`;
    section += `| المستوى 2 | مدخلات ملحوظة أخرى | ${l2} | ${Math.round((l2 / measurements.length) * 100)}% |\n`;
    section += `| المستوى 3 | مدخلات غير ملحوظة | ${l3} | ${Math.round((l3 / measurements.length) * 100)}% |\n`;

    if (l3 > 0) {
      section += `\n### ⚠️ أصول المستوى 3 (تتطلب إفصاحاً إضافياً):\n`;
      for (const m of measurements.filter(m => m.inputLevel === 3).slice(0, 8)) {
        section += `• ${m.assetName}: ${m.fairValue.toLocaleString()} ر.س | ${m.valuationTechnique}\n`;
        section += `  المدخلات: ${m.keyInputs.join("، ")}\n`;
      }
    }

    section += `\n### المرجعية:\n`;
    section += `• IFRS 13.72 — يجب الإفصاح عن مستوى المدخلات لكل فئة أصول\n`;
    section += `• IFRS 13.93 — إفصاحات إضافية مطلوبة للمستوى 3 (تحليل الحساسية)\n`;
    section += `• IVS 104 — أُسس القيمة المتوافقة مع القيمة العادلة\n`;

    return { section, measurements, level1Count: l1, level2Count: l2, level3Count: l3, totalFairValue: Math.round(totalFV) };
  } catch (e) {
    console.error("Fair value analysis error:", e);
    return empty;
  }
}
