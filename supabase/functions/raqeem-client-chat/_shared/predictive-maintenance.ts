/**
 * المستوى 25 — تقييم الصيانة التنبؤية
 * تقدير القيمة بناءً على توقع الأعطال — المعدة التي ستحتاج صيانة تُخصم قيمتها
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MaintenancePrediction {
  assetName: string;
  failureProbability: number; // 0-100
  estimatedMaintenanceCost: number;
  valueDeduction: number; // percentage
  nextMaintenanceWindow: string;
  riskCategory: "low" | "medium" | "high" | "critical";
  factors: string[];
}

export interface PredictiveMaintenanceResult {
  section: string;
  predictions: MaintenancePrediction[];
  totalDeferredMaintenance: number;
  portfolioRiskScore: number;
}

// Failure probability curves by equipment category
const FAILURE_CURVES: Record<string, { earlyFailRate: number; wearOutStart: number; maxRate: number }> = {
  "معدات ثقيلة": { earlyFailRate: 0.02, wearOutStart: 12, maxRate: 0.35 },
  "معدات خفيفة": { earlyFailRate: 0.03, wearOutStart: 8, maxRate: 0.40 },
  "أنظمة كهربائية": { earlyFailRate: 0.01, wearOutStart: 15, maxRate: 0.25 },
  "أنظمة ميكانيكية": { earlyFailRate: 0.03, wearOutStart: 10, maxRate: 0.35 },
  "معدات إنتاج": { earlyFailRate: 0.02, wearOutStart: 10, maxRate: 0.30 },
  "مركبات": { earlyFailRate: 0.02, wearOutStart: 8, maxRate: 0.45 },
  "تقنية معلومات": { earlyFailRate: 0.05, wearOutStart: 5, maxRate: 0.50 },
  "معدات طبية": { earlyFailRate: 0.01, wearOutStart: 10, maxRate: 0.20 },
  "أثاث ومفروشات": { earlyFailRate: 0.005, wearOutStart: 15, maxRate: 0.15 },
};

export async function analyzePredictiveMaintenance(
  db: SupabaseClient,
  assignmentId?: string
): Promise<PredictiveMaintenanceResult> {
  const empty: PredictiveMaintenanceResult = {
    section: "",
    predictions: [],
    totalDeferredMaintenance: 0,
    portfolioRiskScore: 0,
  };

  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || !["machinery_equipment", "mixed"].includes(assignment.valuation_type || "")) {
      return empty;
    }

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, category")
      .in("job_id", jobs.map(j => j.id))
      .limit(100);

    if (!assets?.length) return empty;

    const predictions: MaintenancePrediction[] = [];
    let totalDeferred = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const yearBuilt = Number(data.year_built || data.year || 0);
      const age = yearBuilt > 1900 ? new Date().getFullYear() - yearBuilt : Number(data.age || 5);
      const usefulLife = Number(data.useful_life || 15);
      const category = asset.category || "عام";

      // Bathtub curve failure probability
      const curve = FAILURE_CURVES[category] || { earlyFailRate: 0.03, wearOutStart: 10, maxRate: 0.35 };
      let failProb: number;
      if (age <= 1) {
        failProb = curve.earlyFailRate * 100;
      } else if (age < curve.wearOutStart) {
        failProb = (curve.earlyFailRate * 0.5) * 100; // steady-state
      } else {
        const wearFactor = Math.min(1, (age - curve.wearOutStart) / (usefulLife - curve.wearOutStart + 1));
        failProb = (curve.earlyFailRate * 0.5 + wearFactor * curve.maxRate) * 100;
      }

      // Condition adjustment
      const condFactor = getConditionFailureFactor(asset.condition || data.condition);
      failProb = Math.min(95, failProb * condFactor);

      // Maintenance history impact
      const hasMaintenanceRecord = !!data.last_maintenance || !!data.maintenance_history;
      if (!hasMaintenanceRecord && age > 3) failProb = Math.min(95, failProb * 1.3);

      // Estimated maintenance cost (5-15% of replacement cost)
      const maintenancePct = failProb > 50 ? 0.15 : failProb > 25 ? 0.10 : 0.05;
      const maintenanceCost = Math.round(cost * maintenancePct);

      // Value deduction
      const valueDeduction = Math.round(failProb * 0.3); // max ~28%

      // Risk category
      const riskCat: MaintenancePrediction["riskCategory"] =
        failProb > 60 ? "critical" : failProb > 40 ? "high" : failProb > 20 ? "medium" : "low";

      // Factors
      const factors: string[] = [];
      if (age > usefulLife) factors.push("تجاوز العمر الافتراضي");
      if (age > curve.wearOutStart) factors.push("دخل مرحلة التآكل المتسارع");
      if (!hasMaintenanceRecord) factors.push("لا يوجد سجل صيانة موثق");
      if (condFactor > 1.3) factors.push("حالة فيزيائية متدهورة");
      if (failProb > 50) factors.push("احتمال عطل مرتفع خلال 12 شهراً");

      // Next maintenance window
      const monthsToMaintenance = failProb > 60 ? 1 : failProb > 40 ? 3 : failProb > 20 ? 6 : 12;
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + monthsToMaintenance);

      predictions.push({
        assetName: asset.name,
        failureProbability: Math.round(failProb),
        estimatedMaintenanceCost: maintenanceCost,
        valueDeduction,
        nextMaintenanceWindow: nextDate.toLocaleDateString("ar-SA"),
        riskCategory: riskCat,
        factors,
      });

      totalDeferred += maintenanceCost;
    }

    if (predictions.length === 0) return empty;

    const riskScores = { low: 10, medium: 30, high: 60, critical: 90 };
    const portfolioRisk = Math.round(
      predictions.reduce((sum, p) => sum + riskScores[p.riskCategory], 0) / predictions.length
    );

    // Build section
    let section = "\n\n## تقييم الصيانة التنبؤية\n";
    section += `- مؤشر المخاطر الكلي: ${portfolioRisk}% ${portfolioRisk > 60 ? "🔴" : portfolioRisk > 30 ? "⚠️" : "✅"}\n`;
    section += `- إجمالي تكاليف الصيانة المؤجلة: ${totalDeferred.toLocaleString()} ر.س\n`;

    const critical = predictions.filter(p => p.riskCategory === "critical");
    const high = predictions.filter(p => p.riskCategory === "high");

    section += `\n| المخاطر | العدد | خصم القيمة المقدر |\n|---|---|---|\n`;
    section += `| حرجة | ${critical.length} | ${critical.length > 0 ? Math.round(critical.reduce((s, p) => s + p.valueDeduction, 0) / critical.length) : 0}% |\n`;
    section += `| عالية | ${high.length} | ${high.length > 0 ? Math.round(high.reduce((s, p) => s + p.valueDeduction, 0) / high.length) : 0}% |\n`;
    section += `| متوسطة | ${predictions.filter(p => p.riskCategory === "medium").length} | - |\n`;
    section += `| منخفضة | ${predictions.filter(p => p.riskCategory === "low").length} | - |\n`;

    if (critical.length > 0) {
      section += `\n### 🔴 أصول حرجة تتطلب صيانة عاجلة:\n`;
      for (const c of critical.slice(0, 5)) {
        section += `• ${c.assetName}: احتمال عطل ${c.failureProbability}% | خصم ${c.valueDeduction}% | صيانة ~${c.estimatedMaintenanceCost.toLocaleString()} ر.س\n`;
        for (const f of c.factors) section += `  → ${f}\n`;
      }
    }

    section += "\n💡 تكاليف الصيانة المؤجلة تُخصم من القيمة السوقية العادلة للأصول.\n";

    return { section, predictions, totalDeferredMaintenance: totalDeferred, portfolioRiskScore: portfolioRisk };
  } catch (e) {
    console.error("Predictive maintenance error:", e);
    return empty;
  }
}

function getConditionFailureFactor(condition: string | null): number {
  if (!condition) return 1.0;
  const map: Record<string, number> = {
    "ممتاز": 0.5, "جيد جداً": 0.7, "جيد": 1.0, "متوسط": 1.5, "سيء": 2.0, "خردة": 3.0,
    "excellent": 0.5, "very_good": 0.7, "good": 1.0, "fair": 1.5, "poor": 2.0, "scrap": 3.0,
  };
  return map[condition] || 1.0;
}
