/**
 * المستوى 27 — التوأم الرقمي للأصول
 * إنشاء بصمة رقمية لكل أصل تتتبع تاريخه الكامل وتُحدّث قيمته تلقائياً
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DigitalTwinSnapshot {
  assetName: string;
  currentValue: number;
  originalCost: number;
  valueHistory: { date: string; value: number; event: string }[];
  depreciationRate: number; // annual %
  projectedValue12m: number;
  projectedValue36m: number;
  lifecycleStage: "new" | "prime" | "mature" | "aging" | "end_of_life";
  keyEvents: string[];
  valueTrend: "rising" | "stable" | "declining" | "rapid_decline";
}

export interface DigitalTwinResult {
  section: string;
  twins: DigitalTwinSnapshot[];
  totalCurrentValue: number;
  totalProjected12m: number;
  totalProjected36m: number;
}

export async function analyzeDigitalTwins(
  db: SupabaseClient,
  assignmentId?: string
): Promise<DigitalTwinResult> {
  const empty: DigitalTwinResult = {
    section: "",
    twins: [],
    totalCurrentValue: 0,
    totalProjected12m: 0,
    totalProjected36m: 0,
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
      .select("name, asset_data, condition, category, created_at")
      .in("job_id", jobs.map(j => j.id))
      .limit(100);

    if (!assets?.length) return empty;

    const twins: DigitalTwinSnapshot[] = [];
    let totalCurrent = 0, total12m = 0, total36m = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const yearBuilt = Number(data.year_built || data.year || 0);
      const currentYear = new Date().getFullYear();
      const age = yearBuilt > 1900 ? currentYear - yearBuilt : Number(data.age || 5);
      const usefulLife = Number(data.useful_life || 15);
      const salvageRate = 0.10;

      // Current value (declining balance)
      const annualDepRate = 1 - Math.pow(salvageRate, 1 / usefulLife);
      const currentValue = Math.max(cost * salvageRate, cost * Math.pow(1 - annualDepRate, age));

      // Lifecycle stage
      const lifeRatio = age / usefulLife;
      const stage: DigitalTwinSnapshot["lifecycleStage"] =
        lifeRatio < 0.15 ? "new" :
        lifeRatio < 0.4 ? "prime" :
        lifeRatio < 0.7 ? "mature" :
        lifeRatio < 1.0 ? "aging" : "end_of_life";

      // Projections
      const projected12m = Math.max(cost * salvageRate, cost * Math.pow(1 - annualDepRate, age + 1));
      const projected36m = Math.max(cost * salvageRate, cost * Math.pow(1 - annualDepRate, age + 3));

      // Value history (simulated milestones)
      const history: DigitalTwinSnapshot["valueHistory"] = [];
      if (yearBuilt > 1900) {
        history.push({ date: `${yearBuilt}`, value: cost, event: "شراء/تركيب" });
        const midAge = Math.floor(age / 2);
        if (midAge > 0) {
          const midVal = Math.round(cost * Math.pow(1 - annualDepRate, midAge));
          history.push({ date: `${yearBuilt + midAge}`, value: midVal, event: "منتصف العمر" });
        }
        history.push({ date: `${currentYear}`, value: Math.round(currentValue), event: "التقييم الحالي" });
      }

      // Value trend
      const annualDecline = currentValue > 0 ? ((currentValue - projected12m) / currentValue) * 100 : 0;
      const trend: DigitalTwinSnapshot["valueTrend"] =
        annualDecline > 20 ? "rapid_decline" :
        annualDecline > 8 ? "declining" :
        annualDecline > 2 ? "stable" : "rising";

      // Key events
      const events: string[] = [];
      if (stage === "end_of_life") events.push("تجاوز العمر الافتراضي");
      if (stage === "aging") events.push("يقترب من نهاية العمر الافتراضي");
      if (data.last_maintenance) events.push(`آخر صيانة: ${data.last_maintenance}`);
      if (data.overhaul) events.push("تم إجراء عمرة شاملة");

      twins.push({
        assetName: asset.name,
        currentValue: Math.round(currentValue),
        originalCost: cost,
        valueHistory: history,
        depreciationRate: Math.round(annualDepRate * 100),
        projectedValue12m: Math.round(projected12m),
        projectedValue36m: Math.round(projected36m),
        lifecycleStage: stage,
        keyEvents: events,
        valueTrend: trend,
      });

      totalCurrent += currentValue;
      total12m += projected12m;
      total36m += projected36m;
    }

    if (twins.length === 0) return empty;

    // Build section
    const trendLabels = { rising: "صاعد", stable: "مستقر", declining: "منخفض", rapid_decline: "انخفاض حاد" };
    const stageLabels = { new: "جديد", prime: "ذروة", mature: "ناضج", aging: "شيخوخة", end_of_life: "نهاية العمر" };

    let section = "\n\n## التوأم الرقمي للأصول\n";
    section += `- إجمالي الأصول: ${twins.length}\n`;
    section += `\n| المؤشر | القيمة (ر.س) |\n|---|---|\n`;
    section += `| القيمة الحالية | ${Math.round(totalCurrent).toLocaleString()} |\n`;
    section += `| التوقع بعد 12 شهراً | ${Math.round(total12m).toLocaleString()} |\n`;
    section += `| التوقع بعد 36 شهراً | ${Math.round(total36m).toLocaleString()} |\n`;

    // Stage distribution
    const stageCounts: Record<string, number> = {};
    for (const t of twins) stageCounts[t.lifecycleStage] = (stageCounts[t.lifecycleStage] || 0) + 1;

    section += `\n### توزيع دورة الحياة:\n`;
    for (const [s, c] of Object.entries(stageCounts).sort((a, b) => b[1] - a[1])) {
      section += `• ${stageLabels[s as keyof typeof stageLabels] || s}: ${c} أصل\n`;
    }

    // Top declining assets
    const declining = twins.filter(t => t.valueTrend === "rapid_decline" || t.valueTrend === "declining")
      .sort((a, b) => b.depreciationRate - a.depreciationRate);

    if (declining.length > 0) {
      section += `\n### أصول بانخفاض ملحوظ:\n`;
      for (const d of declining.slice(0, 5)) {
        section += `• ${d.assetName}: ${trendLabels[d.valueTrend]} | إهلاك ${d.depreciationRate}%/سنة | ${d.currentValue.toLocaleString()} → ${d.projectedValue12m.toLocaleString()} ر.س\n`;
      }
    }

    section += "\n📊 التوأم الرقمي يوفر رؤية مستقبلية لقيمة كل أصل بناءً على نموذج الإهلاك والحالة الفعلية.\n";

    return { section, twins, totalCurrentValue: Math.round(totalCurrent), totalProjected12m: Math.round(total12m), totalProjected36m: Math.round(total36m) };
  } catch (e) {
    console.error("Digital twin error:", e);
    return empty;
  }
}
