/**
 * Level 58: Portfolio Health Index
 * Periodic automated analysis of client portfolios with revaluation recommendations
 */

interface AssetHealthStatus {
  referenceNumber: string;
  propertyType: string;
  lastValuationDate: string;
  lastValue: number;
  daysSinceValuation: number;
  healthStatus: "current" | "aging" | "stale" | "expired";
  revaluationRecommended: boolean;
  estimatedCurrentValue?: number;
}

interface PortfolioHealthResult {
  section: string;
  assets: AssetHealthStatus[];
  totalPortfolioValue: number;
  healthScore: number;
  currentAssets: number;
  staleAssets: number;
  revaluationNeeded: number;
  recommendations: string[];
}

export async function analyzePortfolioHealth(
  db: any,
  assignmentId: string | undefined
): Promise<PortfolioHealthResult> {
  const empty: PortfolioHealthResult = {
    section: "", assets: [], totalPortfolioValue: 0, healthScore: 0,
    currentAssets: 0, staleAssets: 0, revaluationNeeded: 0, recommendations: [],
  };
  if (!assignmentId) return empty;

  try {
    const { data: current } = await db
      .from("valuation_assignments")
      .select("client_id")
      .eq("id", assignmentId)
      .single();

    if (!current?.client_id) return empty;

    const { data: allValuations } = await db
      .from("valuation_assignments")
      .select("reference_number, property_type, final_value_sar, created_at, status")
      .eq("client_id", current.client_id)
      .in("status", ["issued", "archived"])
      .not("final_value_sar", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!allValuations?.length) return empty;

    const now = Date.now();
    const assets: AssetHealthStatus[] = allValuations.map((v: any) => {
      const daysSince = Math.ceil((now - new Date(v.created_at).getTime()) / 86400000);
      const healthStatus: "current" | "aging" | "stale" | "expired" =
        daysSince <= 180 ? "current" : daysSince <= 365 ? "aging" : daysSince <= 730 ? "stale" : "expired";

      return {
        referenceNumber: v.reference_number,
        propertyType: v.property_type,
        lastValuationDate: new Date(v.created_at).toLocaleDateString("ar-SA"),
        lastValue: v.final_value_sar,
        daysSinceValuation: daysSince,
        healthStatus,
        revaluationRecommended: daysSince > 365,
      };
    });

    const totalPortfolioValue = assets.reduce((s, a) => s + a.lastValue, 0);
    const currentAssets = assets.filter((a) => a.healthStatus === "current").length;
    const staleAssets = assets.filter((a) => ["stale", "expired"].includes(a.healthStatus)).length;
    const revaluationNeeded = assets.filter((a) => a.revaluationRecommended).length;
    const healthScore = Math.round((currentAssets / assets.length) * 100);

    const healthLabels = { current: "حديث", aging: "يقترب من التقادم", stale: "متقادم", expired: "منتهي" };

    const recommendations: string[] = [];
    if (revaluationNeeded > 0) {
      recommendations.push(`${revaluationNeeded} أصل يحتاج إعادة تقييم (تجاوز 12 شهراً)`);
    }
    if (staleAssets > assets.length * 0.3) {
      recommendations.push("أكثر من 30% من المحفظة متقادمة — يُوصى بحملة إعادة تقييم شاملة");
    }
    const expiredHighValue = assets.filter((a) => a.healthStatus === "expired" && a.lastValue > 1000000);
    if (expiredHighValue.length > 0) {
      recommendations.push(`${expiredHighValue.length} أصل عالي القيمة (> 1M ر.س) بتقييم منتهي — أولوية قصوى`);
    }

    let section = "\n\n## مؤشر صحة المحفظة (المستوى 58)\n";
    section += `- إجمالي الأصول: ${assets.length} | القيمة الإجمالية: ${totalPortfolioValue.toLocaleString()} ر.س\n`;
    section += `- درجة الصحة: ${healthScore}% | حديثة: ${currentAssets} | متقادمة: ${staleAssets}\n`;
    section += `- تحتاج إعادة تقييم: ${revaluationNeeded}\n`;
    for (const r of recommendations) section += `📌 ${r}\n`;

    return { section, assets, totalPortfolioValue, healthScore, currentAssets, staleAssets, revaluationNeeded, recommendations };
  } catch (e) {
    console.error("Portfolio health error:", e);
    return empty;
  }
}
