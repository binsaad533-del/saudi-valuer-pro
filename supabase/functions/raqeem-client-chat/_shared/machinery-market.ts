/**
 * المستوى 22 — سوق المعدات المستعملة
 * مقارنات سوقية متخصصة، فارق القيمة، قيمة التصفية
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MachineryMarketComparable {
  name: string;
  manufacturer: string | null;
  age: number;
  price: number;
  condition: string | null;
  source: string;
}

export interface ValueGapAnalysis {
  bookValue: number;
  marketValue: number;
  replacementCost: number;
  liquidationValue: number;
  gapPercent: number;
  recommendation: string;
}

export interface MachineryMarketResult {
  section: string;
  comparablesFound: number;
  valueGap: ValueGapAnalysis | null;
  marketTrend: string;
}

export async function analyzeMachineryMarket(
  db: SupabaseClient,
  assignmentId?: string,
  organizationId?: string
): Promise<MachineryMarketResult> {
  const empty: MachineryMarketResult = {
    section: "",
    comparablesFound: 0,
    valueGap: null,
    marketTrend: "stable",
  };

  if (!assignmentId || !organizationId) return empty;

  try {
    // Check if this is a machinery assignment
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || !["machinery_equipment", "mixed"].includes(assignment.valuation_type || "")) {
      return empty;
    }

    // Get extracted assets
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    if (!jobs || jobs.length === 0) return empty;

    const jobIds = jobs.map(j => j.id);
    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, asset_type")
      .in("job_id", jobIds)
      .limit(100);

    if (!assets || assets.length === 0) return empty;

    // Analyze each asset for market comparison
    let totalBookValue = 0;
    let totalReplacementCost = 0;
    let totalMarketEstimate = 0;
    let totalLiquidation = 0;
    let assetCount = 0;

    const assetAnalyses: string[] = [];

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const yearBuilt = Number(data.year_built || data.year || 0);
      const currentYear = new Date().getFullYear();
      const age = yearBuilt > 1900 ? currentYear - yearBuilt : Number(data.age || 5);

      // Book value (straight-line, 10% salvage)
      const usefulLife = Number(data.useful_life || 15);
      const depRate = Math.min(age / usefulLife, 0.90);
      const bookValue = cost * (1 - depRate * 0.9);

      // Replacement cost (inflation adjusted ~3% per year)
      const inflationFactor = Math.pow(1.03, age);
      const replacementCost = cost * inflationFactor;

      // Market estimate (60-85% of replacement for used)
      const conditionFactor = getConditionMarketFactor(asset.condition || data.condition);
      const ageFactor = Math.max(0.3, 1 - (age / (usefulLife * 1.2)));
      const marketEstimate = replacementCost * ageFactor * conditionFactor;

      // Liquidation value (40-60% of market)
      const liquidationFactor = age > usefulLife ? 0.35 : 0.55;
      const liquidationValue = marketEstimate * liquidationFactor;

      totalBookValue += bookValue;
      totalReplacementCost += replacementCost;
      totalMarketEstimate += marketEstimate;
      totalLiquidation += liquidationValue;
      assetCount++;

      if (assetCount <= 5) {
        const gap = Math.round(((marketEstimate - bookValue) / bookValue) * 100);
        assetAnalyses.push(
          `• ${asset.name}: دفترية ${Math.round(bookValue).toLocaleString()} | سوقية ~${Math.round(marketEstimate).toLocaleString()} | فارق ${gap > 0 ? "+" : ""}${gap}%`
        );
      }
    }

    if (assetCount === 0) return empty;

    // Value gap analysis
    const gapPercent = totalBookValue > 0
      ? Math.round(((totalMarketEstimate - totalBookValue) / totalBookValue) * 100)
      : 0;

    let recommendation: string;
    if (gapPercent > 20) {
      recommendation = "القيمة السوقية أعلى من الدفترية بشكل ملحوظ — يُنصح بإعادة تقييم الأصول محاسبياً";
    } else if (gapPercent < -20) {
      recommendation = "القيمة الدفترية أعلى من السوقية — يُنصح بمراجعة سياسة الإهلاك";
    } else {
      recommendation = "الفارق بين القيمة الدفترية والسوقية ضمن النطاق المقبول";
    }

    const valueGap: ValueGapAnalysis = {
      bookValue: Math.round(totalBookValue),
      marketValue: Math.round(totalMarketEstimate),
      replacementCost: Math.round(totalReplacementCost),
      liquidationValue: Math.round(totalLiquidation),
      gapPercent,
      recommendation,
    };

    // Build section
    let section = "\n\n## تحليل سوق المعدات المستعملة\n";
    section += `- عدد الأصول المحللة: ${assetCount}\n`;
    section += `\n### ملخص القيم:\n`;
    section += `| النوع | القيمة (ر.س) |\n|---|---|\n`;
    section += `| القيمة الدفترية | ${valueGap.bookValue.toLocaleString()} |\n`;
    section += `| تكلفة الإحلال | ${valueGap.replacementCost.toLocaleString()} |\n`;
    section += `| القيمة السوقية التقديرية | ${valueGap.marketValue.toLocaleString()} |\n`;
    section += `| قيمة التصفية | ${valueGap.liquidationValue.toLocaleString()} |\n`;
    section += `\n### فارق القيمة: ${gapPercent > 0 ? "+" : ""}${gapPercent}%\n`;
    section += `📋 ${recommendation}\n`;

    if (assetAnalyses.length > 0) {
      section += `\n### تفاصيل أبرز الأصول:\n`;
      for (const a of assetAnalyses) section += `${a}\n`;
    }

    section += "\n⚠️ هذه تقديرات أولية مبنية على نماذج حسابية. القيمة النهائية تتطلب معاينة ومراجعة مهنية.\n";

    return {
      section,
      comparablesFound: assetCount,
      valueGap,
      marketTrend: gapPercent > 5 ? "up" : gapPercent < -5 ? "down" : "stable",
    };
  } catch (e) {
    console.error("Machinery market error:", e);
    return empty;
  }
}

function getConditionMarketFactor(condition: string | null): number {
  if (!condition) return 0.75;
  const map: Record<string, number> = {
    "ممتاز": 0.90, "جيد جداً": 0.82, "جيد": 0.75,
    "متوسط": 0.60, "سيء": 0.40, "خردة": 0.15,
    "excellent": 0.90, "very_good": 0.82, "good": 0.75,
    "fair": 0.60, "poor": 0.40, "scrap": 0.15,
  };
  return map[condition] || 0.75;
}
