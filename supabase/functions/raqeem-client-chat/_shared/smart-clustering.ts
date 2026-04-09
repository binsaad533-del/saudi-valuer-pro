/**
 * المستوى 43 — التجميع الذكي (Smart Clustering Engine)
 * تجميع الأصول المتشابهة وتقييم العينة الممثلة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AssetCluster {
  clusterName: string;
  count: number;
  sampleAsset: string;
  avgAge: number;
  avgCondition: string;
  estimatedUnitValue: number;
  clusterTotalValue: number;
  variance: number;
}

export interface SmartClusteringResult {
  section: string;
  clusters: AssetCluster[];
  totalClusters: number;
  timeSavingPercent: number;
  representativeSampleSize: number;
  totalAssetsGrouped: number;
}

export async function analyzeSmartClustering(
  db: SupabaseClient,
  assignmentId?: string
): Promise<SmartClusteringResult> {
  const empty: SmartClusteringResult = {
    section: "", clusters: [], totalClusters: 0,
    timeSavingPercent: 0, representativeSampleSize: 0, totalAssetsGrouped: 0,
  };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(20);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, category, condition, asset_data, quantity")
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);
    if (!assets?.length || assets.length < 10) return empty;

    // Build clusters by (category + make/model + condition)
    const clusterMap = new Map<string, typeof assets>();
    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const key = buildClusterKey(asset.category, data, asset.condition);
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(asset);
    }

    const clusters: AssetCluster[] = [];
    let totalGrouped = 0;

    for (const [key, group] of clusterMap) {
      if (group.length < 2) continue;

      const qty = group.reduce((s, a) => s + (a.quantity || 1), 0);
      totalGrouped += qty;

      let totalAge = 0, totalCost = 0;
      for (const a of group) {
        const d = a.asset_data as Record<string, any> || {};
        const yr = Number(d.year_built || d.year || 0);
        totalAge += yr > 1900 ? new Date().getFullYear() - yr : Number(d.age || 5);
        totalCost += Number(d.original_cost || d.replacement_cost || d.cost || 0);
      }

      const avgAge = Math.round(totalAge / group.length);
      const avgCost = totalCost / group.length;
      const depRate = Math.min(avgAge / 15, 0.9);
      const unitValue = Math.round(avgCost * (1 - depRate * 0.85));

      // Calculate variance within cluster
      const values = group.map(a => {
        const d = a.asset_data as Record<string, any> || {};
        const c = Number(d.original_cost || d.replacement_cost || d.cost || avgCost);
        const yr = Number(d.year_built || d.year || 0);
        const age = yr > 1900 ? new Date().getFullYear() - yr : Number(d.age || 5);
        return Math.round(c * (1 - Math.min(age / 15, 0.9) * 0.85));
      });
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.length > 1
        ? Math.round(Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) / (mean || 1) * 100)
        : 0;

      clusters.push({
        clusterName: key,
        count: qty,
        sampleAsset: group[0].name,
        avgAge,
        avgCondition: group[0].condition || "غير محدد",
        estimatedUnitValue: unitValue,
        clusterTotalValue: unitValue * qty,
        variance,
      });
    }

    if (clusters.length === 0) return empty;
    clusters.sort((a, b) => b.count - a.count);

    const sampleSize = clusters.reduce((s, c) => s + Math.max(1, Math.ceil(c.count * 0.15)), 0);
    const timeSaving = Math.round((1 - sampleSize / totalGrouped) * 100);

    let section = `\n\n## التجميع الذكي للأصول المتشابهة\n`;
    section += `- مجموعات متشابهة: **${clusters.length}**\n`;
    section += `- أصول مجمّعة: **${totalGrouped}** من إجمالي ${assets.length}\n`;
    section += `- حجم العينة الممثلة: **${sampleSize}** أصل\n`;
    section += `- توفير الوقت المتوقع: **${timeSaving}%** ✅\n`;

    section += `\n| المجموعة | العدد | العمر | القيمة التقديرية | التباين |\n|---|---|---|---|---|\n`;
    for (const c of clusters.slice(0, 10)) {
      const varLabel = c.variance < 10 ? "✅ منخفض" : c.variance < 25 ? "⚠️ متوسط" : "🔴 مرتفع";
      section += `| ${c.clusterName} | ${c.count} | ${c.avgAge} سنة | ${c.clusterTotalValue.toLocaleString()} ر.س | ${varLabel} |\n`;
    }

    const highVariance = clusters.filter(c => c.variance > 25);
    if (highVariance.length > 0) {
      section += `\n⚠️ **${highVariance.length} مجموعة بتباين مرتفع** — يُنصح بفحص فردي لهذه المجموعات بدلاً من تقييم العينة.\n`;
    }

    section += `\n💡 يمكن تقييم **عينة ممثلة** من كل مجموعة وتعميم النتيجة مع هوامش تعديل دقيقة حسب IVS 2025.\n`;

    return {
      section, clusters: clusters.slice(0, 20), totalClusters: clusters.length,
      timeSavingPercent: timeSaving, representativeSampleSize: sampleSize,
      totalAssetsGrouped: totalGrouped,
    };
  } catch (e) {
    console.error("Smart clustering error:", e);
    return empty;
  }
}

function buildClusterKey(category: string | null, data: Record<string, any>, condition: string | null): string {
  const make = (data.manufacturer || data.make || data.brand || "").toString().toLowerCase().trim();
  const model = (data.model || data.type || "").toString().toLowerCase().trim();
  const cat = (category || "عام").trim();
  const cond = (condition || "").trim();
  return `${cat}${make ? " | " + make : ""}${model ? " " + model : ""}${cond ? " | " + cond : ""}`;
}
