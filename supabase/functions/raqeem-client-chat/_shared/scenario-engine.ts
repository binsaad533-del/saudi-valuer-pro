/**
 * المستوى 41 — محرك السيناريوهات الاقتصادية
 * محاكاة سيناريوهات (ركود، نمو، تضخم) وأثرها على قيمة المحفظة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ScenarioProjection {
  scenarioName: string;
  scenarioNameAr: string;
  probability: number;
  valueMultiplier: number;
  projectedValue: number;
  keyAssumptions: string[];
  timeHorizon: string;
}

export interface ScenarioAnalysisResult {
  section: string;
  scenarios: ScenarioProjection[];
  baseValue: number;
  expectedValue: number; // probability-weighted
  valueRange: [number, number];
  volatility: number;
}

export async function analyzeScenarios(
  db: SupabaseClient,
  assignmentId?: string
): Promise<ScenarioAnalysisResult> {
  const empty: ScenarioAnalysisResult = { section: "", scenarios: [], baseValue: 0, expectedValue: 0, valueRange: [0, 0], volatility: 0 };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type, property_type")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    let baseValue = 0;
    if (jobs?.length) {
      const { data: assets } = await db
        .from("extracted_assets")
        .select("asset_data")
        .in("job_id", jobs.map(j => j.id))
        .limit(200);
      baseValue = (assets || []).reduce((s, a) => {
        const d = a.asset_data as Record<string, any> || {};
        return s + Number(d.value || d.fair_value || d.market_value || d.cost || 0);
      }, 0);
    }

    if (baseValue <= 0) return empty;

    const isMachinery = assignment.valuation_type === "machinery_equipment" || assignment.valuation_type === "mixed";

    const scenarios: ScenarioProjection[] = [
      {
        scenarioName: "Strong Growth",
        scenarioNameAr: "نمو قوي (رؤية 2030)",
        probability: 0.20,
        valueMultiplier: isMachinery ? 1.12 : 1.18,
        projectedValue: 0,
        keyAssumptions: [
          "نمو GDP بنسبة 5%+",
          "زيادة الإنفاق الحكومي على البنية التحتية",
          isMachinery ? "ارتفاع الطلب على المعدات الصناعية" : "ارتفاع أسعار العقارات 8-12%",
          "انخفاض أسعار الفائدة",
        ],
        timeHorizon: "12-24 شهراً",
      },
      {
        scenarioName: "Base Case",
        scenarioNameAr: "السيناريو الأساسي",
        probability: 0.45,
        valueMultiplier: 1.0,
        projectedValue: 0,
        keyAssumptions: [
          "نمو GDP بنسبة 2-3%",
          "استقرار أسعار الفائدة",
          isMachinery ? "طلب مستقر على المعدات" : "استقرار نسبي في أسعار العقارات",
          "تضخم معتدل 2-3%",
        ],
        timeHorizon: "12 شهراً",
      },
      {
        scenarioName: "Mild Recession",
        scenarioNameAr: "ركود معتدل",
        probability: 0.25,
        valueMultiplier: isMachinery ? 0.88 : 0.90,
        projectedValue: 0,
        keyAssumptions: [
          "تباطؤ نمو GDP إلى 0-1%",
          "ارتفاع أسعار الفائدة",
          isMachinery ? "انخفاض الطلب وزيادة المعروض من المعدات المستعملة" : "ضغط على الإيجارات وارتفاع الشواغر",
          "تشديد الائتمان المصرفي",
        ],
        timeHorizon: "12-18 شهراً",
      },
      {
        scenarioName: "Severe Downturn",
        scenarioNameAr: "أزمة حادة",
        probability: 0.07,
        valueMultiplier: isMachinery ? 0.70 : 0.75,
        projectedValue: 0,
        keyAssumptions: [
          "انكماش اقتصادي حاد",
          "انخفاض أسعار النفط دون 50$",
          isMachinery ? "توقف مشاريع وتصفية أصول" : "انخفاض حاد في الأسعار 20-25%",
          "أزمة سيولة مصرفية",
        ],
        timeHorizon: "12-24 شهراً",
      },
      {
        scenarioName: "High Inflation",
        scenarioNameAr: "تضخم مرتفع",
        probability: 0.03,
        valueMultiplier: isMachinery ? 1.05 : 1.10,
        projectedValue: 0,
        keyAssumptions: [
          "تضخم فوق 6%",
          "ارتفاع تكاليف البناء والمواد",
          isMachinery ? "ارتفاع تكلفة الإحلال = ارتفاع القيمة" : "الأصول العقارية كتحوط ضد التضخم",
          "ارتفاع أسعار الفائدة يكبح الطلب",
        ],
        timeHorizon: "12-18 شهراً",
      },
    ];

    // Calculate projected values
    for (const s of scenarios) {
      s.projectedValue = Math.round(baseValue * s.valueMultiplier);
    }

    const expectedValue = Math.round(scenarios.reduce((s, sc) => s + sc.projectedValue * sc.probability, 0));
    const valueRange: [number, number] = [
      Math.min(...scenarios.map(s => s.projectedValue)),
      Math.max(...scenarios.map(s => s.projectedValue)),
    ];
    const variance = scenarios.reduce((s, sc) => s + sc.probability * Math.pow(sc.projectedValue - expectedValue, 2), 0);
    const volatility = Math.round(Math.sqrt(variance) / expectedValue * 10000) / 100;

    let section = "\n\n## تحليل السيناريوهات الاقتصادية\n";
    section += `- القيمة الأساسية: ${baseValue.toLocaleString()} ر.س\n`;
    section += `- القيمة المتوقعة (مرجحة): ${expectedValue.toLocaleString()} ر.س\n`;
    section += `- نطاق القيمة: ${valueRange[0].toLocaleString()} — ${valueRange[1].toLocaleString()} ر.س\n`;
    section += `- التذبذب: ${volatility}%\n`;

    section += `\n| السيناريو | الاحتمال | المضاعف | القيمة المتوقعة |\n|---|---|---|---|\n`;
    for (const s of scenarios) {
      section += `| ${s.scenarioNameAr} | ${(s.probability * 100)}% | ${s.valueMultiplier}x | ${s.projectedValue.toLocaleString()} |\n`;
    }

    for (const s of scenarios.filter(sc => sc.probability >= 0.20)) {
      section += `\n### ${s.scenarioNameAr} (${(s.probability * 100)}%):\n`;
      for (const a of s.keyAssumptions) section += `• ${a}\n`;
    }

    section += "\n⚠️ السيناريوهات تقديرية ولا تمثل توقعات مؤكدة. يجب مراجعتها مع المقيم المعتمد.\n";

    return { section, scenarios, baseValue, expectedValue, valueRange, volatility };
  } catch (e) {
    console.error("Scenario analysis error:", e);
    return empty;
  }
}
