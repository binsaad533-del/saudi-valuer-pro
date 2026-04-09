/**
 * المستوى 46 — قوالب التقارير الجماعية (Fleet Report Templates)
 * ملخص تنفيذي وتقارير فرعية لكل فئة وموقع
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CategorySummary {
  category: string;
  count: number;
  totalValue: number;
  avgAge: number;
  avgConditionScore: number;
}

export interface FleetReportResult {
  section: string;
  executiveSummary: string;
  categorySummaries: CategorySummary[];
  totalFleetValue: number;
  weightedAvgAge: number;
  depreciationCurveData: { year: number; value: number }[];
}

export async function generateFleetReport(
  db: SupabaseClient,
  assignmentId?: string
): Promise<FleetReportResult> {
  const empty: FleetReportResult = {
    section: "", executiveSummary: "", categorySummaries: [],
    totalFleetValue: 0, weightedAvgAge: 0, depreciationCurveData: [],
  };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(20);
    if (!jobs?.length) return empty;

    const { data: assets, count } = await db
      .from("extracted_assets")
      .select("name, category, condition, asset_data, quantity", { count: "exact" })
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);
    if (!assets?.length || !count || count < 10) return empty;

    const catMap = new Map<string, { count: number; totalCost: number; totalAge: number; condScores: number[] }>();
    let grandTotalValue = 0, totalWeightedAge = 0, totalQty = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cat = asset.category || "غير مصنف";
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      const yr = Number(data.year_built || data.year || 0);
      const age = yr > 1900 ? new Date().getFullYear() - yr : Number(data.age || 5);
      const qty = asset.quantity || 1;

      const usefulLife = Number(data.useful_life || 15);
      const depRate = Math.min(age / usefulLife, 0.9);
      const value = cost > 0 ? Math.round(cost * (1 - depRate * 0.85)) : 0;

      if (!catMap.has(cat)) catMap.set(cat, { count: 0, totalCost: 0, totalAge: 0, condScores: [] });
      const entry = catMap.get(cat)!;
      entry.count += qty;
      entry.totalCost += value * qty;
      entry.totalAge += age * qty;
      entry.condScores.push(conditionToScore(asset.condition));

      grandTotalValue += value * qty;
      totalWeightedAge += age * qty;
      totalQty += qty;
    }

    const weightedAvgAge = totalQty > 0 ? Math.round(totalWeightedAge / totalQty) : 0;

    const summaries: CategorySummary[] = [];
    for (const [cat, info] of catMap) {
      summaries.push({
        category: cat,
        count: info.count,
        totalValue: info.totalCost,
        avgAge: Math.round(info.totalAge / info.count),
        avgConditionScore: Math.round(info.condScores.reduce((s, v) => s + v, 0) / info.condScores.length),
      });
    }
    summaries.sort((a, b) => b.totalValue - a.totalValue);

    // Depreciation curve (5 years projection)
    const curve: { year: number; value: number }[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i <= 5; i++) {
      const projectedValue = Math.round(grandTotalValue * Math.pow(0.88, i));
      curve.push({ year: currentYear + i, value: projectedValue });
    }

    const executiveSummary = `أسطول مكوّن من ${count} أصل موزعة على ${summaries.length} فئة، ` +
      `بقيمة إجمالية تقديرية ${grandTotalValue.toLocaleString()} ر.س ` +
      `ومتوسط عمر مرجّح ${weightedAvgAge} سنة.`;

    let section = `\n\n## تقرير الأسطول التنفيذي\n`;
    section += `${executiveSummary}\n\n`;
    section += `| الفئة | العدد | القيمة الإجمالية | متوسط العمر | الحالة |\n|---|---|---|---|---|\n`;
    for (const s of summaries.slice(0, 10)) {
      const condLabel = s.avgConditionScore > 70 ? "جيد ✅" : s.avgConditionScore > 40 ? "مقبول ⚠️" : "ضعيف 🔴";
      section += `| ${s.category} | ${s.count} | ${s.totalValue.toLocaleString()} ر.س | ${s.avgAge} سنة | ${condLabel} |\n`;
    }

    section += `\n### منحنى الإهلاك المتوقع (5 سنوات):\n`;
    for (const p of curve) {
      const pct = Math.round((p.value / grandTotalValue) * 100);
      section += `• ${p.year}: ${p.value.toLocaleString()} ر.س (${pct}%)\n`;
    }

    return {
      section, executiveSummary, categorySummaries: summaries,
      totalFleetValue: grandTotalValue, weightedAvgAge, depreciationCurveData: curve,
    };
  } catch (e) {
    console.error("Fleet report error:", e);
    return empty;
  }
}

function conditionToScore(condition: string | null): number {
  const c = (condition || "").toLowerCase();
  if (c.includes("ممتاز") || c.includes("excellent") || c.includes("new")) return 95;
  if (c.includes("جيد جداً") || c.includes("very good")) return 80;
  if (c.includes("جيد") || c.includes("good")) return 65;
  if (c.includes("مقبول") || c.includes("fair")) return 45;
  if (c.includes("ضعيف") || c.includes("poor")) return 25;
  return 60;
}
