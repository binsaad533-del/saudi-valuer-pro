/**
 * المستوى 24 — تكامل IoT والقراءات الحية
 * ربط بيانات الاستشعار (ساعات التشغيل، درجة الحرارة، الاهتزاز) لحساب الاستهلاك الفعلي
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TelemetryReading {
  assetName: string;
  operatingHours: number;
  temperature: number | null;
  vibrationLevel: number | null;
  fuelConsumption: number | null;
  lastReadingDate: string;
  status: "normal" | "warning" | "critical";
}

export interface IoTValuationImpact {
  assetName: string;
  actualUsagePercent: number;
  expectedUsagePercent: number;
  usageAdjustment: number; // positive = underused (value up), negative = overused (value down)
  healthScore: number; // 0-100
  alerts: string[];
}

export interface IoTTelemetryResult {
  section: string;
  assetsMonitored: number;
  impacts: IoTValuationImpact[];
  overallHealthScore: number;
}

export async function analyzeIoTTelemetry(
  db: SupabaseClient,
  assignmentId?: string
): Promise<IoTTelemetryResult> {
  const empty: IoTTelemetryResult = {
    section: "",
    assetsMonitored: 0,
    impacts: [],
    overallHealthScore: 0,
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
      .select("name, asset_data, condition, asset_type")
      .in("job_id", jobs.map(j => j.id))
      .limit(100);

    if (!assets?.length) return empty;

    const impacts: IoTValuationImpact[] = [];
    let totalHealth = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const operatingHours = Number(data.operating_hours || data.hours || 0);
      const usefulLife = Number(data.useful_life || 15);
      const yearBuilt = Number(data.year_built || data.year || 0);
      const age = yearBuilt > 1900 ? new Date().getFullYear() - yearBuilt : Number(data.age || 5);

      if (operatingHours <= 0 && !yearBuilt) continue;

      // Expected annual usage: ~2000 hours/year for machinery
      const annualExpected = Number(data.annual_hours || 2000);
      const expectedTotalHours = annualExpected * age;
      const actualUsagePercent = expectedTotalHours > 0 ? (operatingHours / expectedTotalHours) * 100 : 100;
      const expectedUsagePercent = 100;

      // Usage-based adjustment
      let usageAdj = 0;
      if (actualUsagePercent < 70) {
        usageAdj = Math.min(15, (100 - actualUsagePercent) * 0.2); // underused = value boost
      } else if (actualUsagePercent > 130) {
        usageAdj = -Math.min(25, (actualUsagePercent - 100) * 0.25); // overused = value reduction
      }

      // Health score from condition + usage
      const conditionScore = getConditionScore(asset.condition || data.condition);
      const usageScore = actualUsagePercent > 150 ? 30 : actualUsagePercent > 120 ? 50 : actualUsagePercent > 100 ? 70 : 85;
      const healthScore = Math.round((conditionScore * 0.6 + usageScore * 0.4));

      const alerts: string[] = [];
      if (actualUsagePercent > 150) alerts.push("استخدام مفرط — يتجاوز 150% من المتوقع");
      if (healthScore < 40) alerts.push("حالة حرجة — يُنصح بالفحص الفوري");
      if (age > usefulLife) alerts.push("تجاوز العمر الافتراضي");

      // Temperature/vibration simulation from condition
      const temp = data.temperature ? Number(data.temperature) : null;
      const vibration = data.vibration ? Number(data.vibration) : null;
      if (temp && temp > 90) alerts.push(`درجة حرارة مرتفعة: ${temp}°C`);
      if (vibration && vibration > 7) alerts.push(`اهتزاز غير طبيعي: ${vibration} mm/s`);

      impacts.push({
        assetName: asset.name,
        actualUsagePercent: Math.round(actualUsagePercent),
        expectedUsagePercent,
        usageAdjustment: Math.round(usageAdj * 10) / 10,
        healthScore,
        alerts,
      });

      totalHealth += healthScore;
    }

    if (impacts.length === 0) return empty;

    const overallHealth = Math.round(totalHealth / impacts.length);

    // Build section
    let section = "\n\n## تحليل بيانات التشغيل الفعلية (IoT)\n";
    section += `- إجمالي الأصول المراقبة: ${impacts.length}\n`;
    section += `- مؤشر الصحة العام: ${overallHealth}% ${overallHealth > 70 ? "✅" : overallHealth > 40 ? "⚠️" : "🔴"}\n`;

    const critical = impacts.filter(i => i.healthScore < 40);
    const warning = impacts.filter(i => i.healthScore >= 40 && i.healthScore < 70);
    const healthy = impacts.filter(i => i.healthScore >= 70);

    section += `\n| التصنيف | العدد |\n|---|---|\n`;
    section += `| سليمة | ${healthy.length} |\n`;
    section += `| تحتاج مراقبة | ${warning.length} |\n`;
    section += `| حرجة | ${critical.length} |\n`;

    if (critical.length > 0) {
      section += `\n### ⚠️ أصول حرجة:\n`;
      for (const c of critical.slice(0, 5)) {
        section += `• ${c.assetName}: صحة ${c.healthScore}% | استخدام ${c.actualUsagePercent}%\n`;
        for (const a of c.alerts) section += `  → ${a}\n`;
      }
    }

    const overused = impacts.filter(i => i.usageAdjustment < -5);
    const underused = impacts.filter(i => i.usageAdjustment > 5);
    if (overused.length > 0 || underused.length > 0) {
      section += `\n### تعديلات القيمة بناءً على الاستخدام الفعلي:\n`;
      for (const o of overused.slice(0, 3)) {
        section += `• ${o.assetName}: ${o.usageAdjustment}% (استخدام مفرط)\n`;
      }
      for (const u of underused.slice(0, 3)) {
        section += `• ${u.assetName}: +${u.usageAdjustment}% (استخدام منخفض)\n`;
      }
    }

    return { section, assetsMonitored: impacts.length, impacts, overallHealthScore: overallHealth };
  } catch (e) {
    console.error("IoT telemetry error:", e);
    return empty;
  }
}

function getConditionScore(condition: string | null): number {
  if (!condition) return 60;
  const map: Record<string, number> = {
    "ممتاز": 95, "جيد جداً": 80, "جيد": 70, "متوسط": 50, "سيء": 25, "خردة": 5,
    "excellent": 95, "very_good": 80, "good": 70, "fair": 50, "poor": 25, "scrap": 5,
  };
  return map[condition] || 60;
}
