/**
 * المستوى 45 — محرك التقييم المكتبي للأساطيل (Desktop Fleet Valuator)
 * تقييم مكتبي متخصص للأساطيل مع نماذج إحصائية وعلاوة مخاطر
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DesktopFleetResult {
  section: string;
  valuationMode: "desktop_with_photos" | "desktop_without_photos" | "field" | "unknown";
  riskPremiumPercent: number;
  totalEstimatedValue: number;
  confidenceLevel: string;
  statisticalModelUsed: string;
  assumptionsGenerated: string[];
}

export async function analyzeDesktopFleet(
  db: SupabaseClient,
  assignmentId?: string
): Promise<DesktopFleetResult> {
  const empty: DesktopFleetResult = {
    section: "", valuationMode: "unknown", riskPremiumPercent: 0,
    totalEstimatedValue: 0, confidenceLevel: "غير محدد",
    statisticalModelUsed: "", assumptionsGenerated: [],
  };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_mode, valuation_type, property_type")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    const mode = assignment.valuation_mode as string || "field";
    if (mode === "field") return empty;

    const isWithPhotos = mode === "desktop_with_photos" || mode === "desktop";

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(20);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, category, confidence")
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);
    if (!assets?.length || assets.length < 5) return empty;

    const riskPremium = isWithPhotos ? 3 : 7;
    let totalValue = 0;
    let totalConfidence = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const age = getAssetAge(data);
      const usefulLife = Number(data.useful_life || 15);
      const depRate = Math.min(age / usefulLife, 0.9);

      // Statistical model: depreciation curve adjusted by condition
      const condMultiplier = getConditionMultiplier(asset.condition);
      let value = cost * (1 - depRate * 0.85) * condMultiplier;

      // Apply risk premium reduction for desktop
      value *= (1 - riskPremium / 100);
      totalValue += Math.round(value);
      totalConfidence += asset.confidence || 50;
    }

    const avgConfidence = Math.round(totalConfidence / assets.length);
    const confidenceLevel = avgConfidence > 70 ? "مرتفعة" : avgConfidence > 40 ? "متوسطة" : "منخفضة";

    const assumptions: string[] = [];
    if (isWithPhotos) {
      assumptions.push("يعتمد التقييم على الصور المقدمة من العميل — يُفترض أنها حديثة ودقيقة");
      assumptions.push("الفحص البصري محدود بجودة الصور وزاوية التصوير");
      assumptions.push("يُخلي المقيم مسؤوليته عن عيوب لا تظهر في الصور المقدمة");
    } else {
      assumptions.push("التقييم مبني كلياً على المستندات والسجلات المقدمة");
      assumptions.push("يُفترض مطابقة الأصل للوصف الوارد في السجلات الورقية");
      assumptions.push("يُخلي المقيم مسؤوليته الكاملة عن الحالة المادية الفعلية غير الموثقة");
      assumptions.push("تم تطبيق علاوة مخاطر 7% لتعويض غياب الفحص البصري");
    }
    assumptions.push(`علاوة مخاطر التقييم المكتبي: ${riskPremium}% (وفقاً لمعايير IVS 2025)`);

    const modelName = isWithPhotos
      ? "نموذج الإهلاك المعدّل بالتحليل البصري (Photo-Adjusted Depreciation)"
      : "نموذج الإهلاك الإحصائي المستندي (Document-Based Statistical Model)";

    let section = `\n\n## تقييم مكتبي للأسطول ${isWithPhotos ? "(بصور)" : "(بدون صور)"}\n`;
    section += `- النموذج الإحصائي: ${modelName}\n`;
    section += `- علاوة المخاطر: **${riskPremium}%** ${riskPremium > 5 ? "⚠️" : ""}\n`;
    section += `- القيمة التقديرية الإجمالية: **${totalValue.toLocaleString()} ر.س**\n`;
    section += `- درجة الثقة: **${confidenceLevel}** (${avgConfidence}%)\n`;
    section += `- عدد الأصول: ${assets.length}\n`;

    section += `\n### الافتراضات الخاصة (IVS 2025):\n`;
    for (const a of assumptions) {
      section += `• ${a}\n`;
    }

    if (!isWithPhotos) {
      section += `\n🔴 **تنبيه**: التقييم المكتبي بدون صور يحمل أعلى درجة مخاطر. يُنصح بتقديم صور حديثة لتقليل علاوة المخاطر من 7% إلى 3%.\n`;
    }

    return {
      section,
      valuationMode: isWithPhotos ? "desktop_with_photos" : "desktop_without_photos",
      riskPremiumPercent: riskPremium,
      totalEstimatedValue: totalValue,
      confidenceLevel,
      statisticalModelUsed: modelName,
      assumptionsGenerated: assumptions,
    };
  } catch (e) {
    console.error("Desktop fleet error:", e);
    return empty;
  }
}

function getAssetAge(data: Record<string, any>): number {
  const yr = Number(data.year_built || data.year || data.year_manufactured || 0);
  return yr > 1900 ? new Date().getFullYear() - yr : Number(data.age || 5);
}

function getConditionMultiplier(condition: string | null): number {
  const c = (condition || "").toLowerCase();
  if (c.includes("ممتاز") || c.includes("excellent") || c.includes("new")) return 1.0;
  if (c.includes("جيد جداً") || c.includes("very good")) return 0.92;
  if (c.includes("جيد") || c.includes("good")) return 0.85;
  if (c.includes("مقبول") || c.includes("fair")) return 0.72;
  if (c.includes("ضعيف") || c.includes("poor")) return 0.55;
  return 0.80;
}
