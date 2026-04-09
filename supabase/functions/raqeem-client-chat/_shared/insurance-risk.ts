/**
 * المستوى 30 — تقييم التأمين والمخاطر
 * حساب قيمة التأمين الأمثل، تحليل مخاطر التوقف، وتقدير خسارة الإنتاج
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface InsuranceValuation {
  assetName: string;
  replacementValue: number;
  insuredValue: number;
  insuranceGap: number;
  underInsured: boolean;
  downtimeRiskDays: number;
  dailyProductionLoss: number;
  totalDowntimeCost: number;
  riskTier: "low" | "medium" | "high" | "critical";
}

export interface InsuranceRiskResult {
  section: string;
  valuations: InsuranceValuation[];
  totalReplacementValue: number;
  totalInsuredValue: number;
  portfolioInsuranceGap: number;
  totalDowntimeExposure: number;
  averageRiskTier: string;
}

export async function analyzeInsuranceRisk(
  db: SupabaseClient,
  assignmentId?: string
): Promise<InsuranceRiskResult> {
  const empty: InsuranceRiskResult = {
    section: "", valuations: [], totalReplacementValue: 0, totalInsuredValue: 0,
    portfolioInsuranceGap: 0, totalDowntimeExposure: 0, averageRiskTier: "medium",
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

    const valuations: InsuranceValuation[] = [];
    let totalReplacement = 0, totalInsured = 0, totalDowntime = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const age = getAge(data);
      const usefulLife = Number(data.useful_life || 15);
      const category = asset.category || "عام";

      // Replacement value (inflation-adjusted current cost)
      const inflationFactor = Math.pow(1.03, age);
      const replacementValue = Math.round(cost * inflationFactor);

      // Insured value (typically what's declared — estimated)
      const declaredInsurance = Number(data.insured_value || data.insurance_value || 0);
      const insuredValue = declaredInsurance > 0 ? declaredInsurance : Math.round(cost * (1 - (age / usefulLife) * 0.5));

      const insuranceGap = replacementValue - insuredValue;
      const underInsured = insuranceGap > replacementValue * 0.15; // >15% gap

      // Downtime risk (days to replace/repair)
      const downtimeDays = getDowntimeEstimate(category, age, usefulLife);

      // Daily production loss
      const annualCapacity = Number(data.annual_revenue || data.capacity_value || replacementValue * 0.08);
      const dailyLoss = Math.round(annualCapacity / 300); // working days
      const totalDowntimeCost = dailyLoss * downtimeDays;

      // Risk tier
      const riskScore = (underInsured ? 30 : 0) + (downtimeDays > 30 ? 30 : downtimeDays > 14 ? 15 : 0) +
        (age > usefulLife ? 25 : age > usefulLife * 0.8 ? 10 : 0);
      const riskTier: InsuranceValuation["riskTier"] =
        riskScore > 60 ? "critical" : riskScore > 40 ? "high" : riskScore > 20 ? "medium" : "low";

      valuations.push({
        assetName: asset.name, replacementValue, insuredValue, insuranceGap,
        underInsured, downtimeRiskDays: downtimeDays, dailyProductionLoss: dailyLoss,
        totalDowntimeCost, riskTier,
      });

      totalReplacement += replacementValue;
      totalInsured += insuredValue;
      totalDowntime += totalDowntimeCost;
    }

    if (valuations.length === 0) return empty;

    const portfolioGap = totalReplacement - totalInsured;
    const riskScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const avgRisk = valuations.reduce((s, v) => s + riskScores[v.riskTier], 0) / valuations.length;
    const avgRiskLabel = avgRisk > 3 ? "critical" : avgRisk > 2 ? "high" : avgRisk > 1.5 ? "medium" : "low";

    let section = "\n\n## تقييم التأمين وتحليل المخاطر\n";
    section += `\n| المؤشر | القيمة |\n|---|---|\n`;
    section += `| قيمة الإحلال الكلية | ${totalReplacement.toLocaleString()} ر.س |\n`;
    section += `| القيمة المؤمنة التقديرية | ${totalInsured.toLocaleString()} ر.س |\n`;
    section += `| فجوة التأمين | ${portfolioGap.toLocaleString()} ر.س ${portfolioGap > 0 ? "⚠️" : "✅"} |\n`;
    section += `| تعرض التوقف الكلي | ${totalDowntime.toLocaleString()} ر.س |\n`;

    const underInsuredAssets = valuations.filter(v => v.underInsured);
    if (underInsuredAssets.length > 0) {
      section += `\n### ⚠️ أصول مؤمنة بأقل من قيمتها (${underInsuredAssets.length}):\n`;
      for (const u of underInsuredAssets.slice(0, 5)) {
        section += `• ${u.assetName}: إحلال ${u.replacementValue.toLocaleString()} | مؤمن ${u.insuredValue.toLocaleString()} | فجوة ${u.insuranceGap.toLocaleString()} ر.س\n`;
      }
    }

    const highRisk = valuations.filter(v => v.riskTier === "critical" || v.riskTier === "high");
    if (highRisk.length > 0) {
      section += `\n### 🔴 أصول عالية المخاطر (${highRisk.length}):\n`;
      for (const h of highRisk.slice(0, 5)) {
        section += `• ${h.assetName}: توقف متوقع ${h.downtimeRiskDays} يوم | خسارة يومية ${h.dailyProductionLoss.toLocaleString()} ر.س\n`;
      }
    }

    section += "\n💡 يُنصح بمراجعة وثائق التأمين مع شركة التأمين لضمان تغطية كافية تشمل قيمة الإحلال وتكاليف التوقف.\n";

    return {
      section, valuations, totalReplacementValue: totalReplacement, totalInsuredValue: totalInsured,
      portfolioInsuranceGap: portfolioGap, totalDowntimeExposure: totalDowntime, averageRiskTier: avgRiskLabel,
    };
  } catch (e) {
    console.error("Insurance risk error:", e);
    return empty;
  }
}

function getAge(data: Record<string, any>): number {
  const y = Number(data.year_built || data.year || 0);
  return y > 1900 ? new Date().getFullYear() - y : Number(data.age || 5);
}

function getDowntimeEstimate(category: string, age: number, usefulLife: number): number {
  const base: Record<string, number> = {
    "معدات ثقيلة": 45, "معدات خفيفة": 21, "أنظمة كهربائية": 14,
    "أنظمة ميكانيكية": 21, "معدات إنتاج": 30, "مركبات": 14,
    "تقنية معلومات": 7, "معدات طبية": 21, "أثاث ومفروشات": 7,
  };
  const baseDays = base[category] || 21;
  const ageFactor = age > usefulLife ? 1.5 : age > usefulLife * 0.7 ? 1.2 : 1.0;
  return Math.round(baseDays * ageFactor);
}
