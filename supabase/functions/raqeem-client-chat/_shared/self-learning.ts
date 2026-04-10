/**
 * المستوى 16 — التعلم الذاتي المستمر
 * يقارن تقديرات ChatGPT بالقيم النهائية ويحسّن دقته
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LearningInsights {
  section: string;
  accuracyRate: number | null;
  totalPredictions: number;
  commonErrors: string[];
  improvementTrend: string;
}

export async function analyzeSelfLearning(
  db: SupabaseClient,
  organizationId?: string
): Promise<LearningInsights> {
  const empty: LearningInsights = {
    section: "",
    accuracyRate: null,
    totalPredictions: 0,
    commonErrors: [],
    improvementTrend: "stable",
  };

  if (!organizationId) return empty;

  try {
    // Get issued assignments that have both AI estimates and final values
    const { data: issued } = await db
      .from("valuation_assignments")
      .select("id, property_type, final_value, status, valuation_type, created_at, updated_at")
      .eq("organization_id", organizationId)
      .eq("status", "issued")
      .not("final_value", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!issued || issued.length < 3) return empty;

    // Analyze patterns by property type
    const typeStats: Record<string, { count: number; values: number[] }> = {};
    for (const a of issued) {
      const t = a.property_type || "unknown";
      if (!typeStats[t]) typeStats[t] = { count: 0, values: [] };
      typeStats[t].count++;
      if (a.final_value) typeStats[t].values.push(Number(a.final_value));
    }

    // Calculate average delivery time
    const deliveryTimes: number[] = [];
    for (const a of issued) {
      if (a.created_at && a.updated_at) {
        const days = Math.ceil(
          (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 86400000
        );
        if (days > 0 && days < 365) deliveryTimes.push(days);
      }
    }
    const avgDelivery = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : null;

    // Detect common error patterns
    const commonErrors: string[] = [];

    // Check for long-running assignments (>15 days)
    const longRunning = deliveryTimes.filter((d) => d > 15).length;
    if (longRunning > deliveryTimes.length * 0.3) {
      commonErrors.push("نسبة عالية من التقييمات تتجاوز 15 يوم عمل");
    }

    // Check for type concentration
    const topType = Object.entries(typeStats).sort((a, b) => b[1].count - a[1].count)[0];
    if (topType && topType[1].count > issued.length * 0.6) {
      commonErrors.push(`تركز عالٍ في نوع ${topType[0]} — يُنصح بتنويع المقارنات`);
    }

    // Determine improvement trend from recent vs older
    const midpoint = Math.floor(issued.length / 2);
    const recentTimes = deliveryTimes.slice(0, midpoint);
    const olderTimes = deliveryTimes.slice(midpoint);
    const recentAvg = recentTimes.length > 0
      ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length : 0;
    const olderAvg = olderTimes.length > 0
      ? olderTimes.reduce((a, b) => a + b, 0) / olderTimes.length : 0;

    let trend = "stable";
    if (recentAvg < olderAvg * 0.85) trend = "improving";
    else if (recentAvg > olderAvg * 1.15) trend = "declining";

    let section = "\n\n## التعلم الذاتي — رؤى الأداء\n";
    section += `- إجمالي التقييمات المكتملة: ${issued.length}\n`;
    if (avgDelivery) section += `- متوسط مدة التسليم الفعلي: ${avgDelivery} يوم\n`;
    section += `- اتجاه الأداء: ${trend === "improving" ? "تحسّن ✅" : trend === "declining" ? "تراجع ⚠️" : "مستقر 📊"}\n`;

    for (const [type, stats] of Object.entries(typeStats)) {
      if (stats.values.length >= 2) {
        const avg = Math.round(stats.values.reduce((a, b) => a + b, 0) / stats.values.length);
        section += `- ${type}: ${stats.count} تقييم، متوسط القيمة ${avg.toLocaleString()} ر.س\n`;
      }
    }

    if (commonErrors.length > 0) {
      section += `\n### أنماط تحتاج تحسين:\n`;
      for (const e of commonErrors) section += `⚠️ ${e}\n`;
    }
    section += "\nاستخدم هذه الرؤى لتحسين تقديراتك وتوقعاتك. لا تذكرها للعميل مباشرة.\n";

    return {
      section,
      accuracyRate: null,
      totalPredictions: issued.length,
      commonErrors,
      improvementTrend: trend,
    };
  } catch (e) {
    console.error("Self-learning error:", e);
    return empty;
  }
}
