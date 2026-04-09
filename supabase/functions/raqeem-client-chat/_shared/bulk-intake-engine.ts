/**
 * المستوى 42 — محرك الاستيعاب الجماعي (Bulk Intake Engine)
 * استيعاب آلاف الأصول دفعة واحدة مع كشف التكرارات والتجميع التلقائي
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BulkIntakeResult {
  section: string;
  totalAssets: number;
  duplicatesDetected: number;
  categoriesBreakdown: Record<string, number>;
  locationsBreakdown: Record<string, number>;
  qualityScore: number;
  missingDataPercent: number;
}

export async function analyzeBulkIntake(
  db: SupabaseClient,
  assignmentId?: string
): Promise<BulkIntakeResult> {
  const empty: BulkIntakeResult = {
    section: "", totalAssets: 0, duplicatesDetected: 0,
    categoriesBreakdown: {}, locationsBreakdown: {},
    qualityScore: 0, missingDataPercent: 0,
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
      .select("id, name, asset_type, category, condition, asset_data, duplicate_status, duplicate_group, missing_fields, confidence", { count: "exact" })
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);

    if (!assets?.length || !count || count < 20) return empty;

    // Category breakdown
    const categories: Record<string, number> = {};
    const locations: Record<string, number> = {};
    let missingCount = 0;
    let totalConfidence = 0;
    const duplicates = new Set<string>();

    for (const asset of assets) {
      const cat = asset.category || asset.asset_type || "غير مصنف";
      categories[cat] = (categories[cat] || 0) + 1;

      const data = asset.asset_data as Record<string, any> || {};
      const loc = data.location || data.site || data.city || "غير محدد";
      locations[loc] = (locations[loc] || 0) + 1;

      if (asset.missing_fields?.length) missingCount++;
      totalConfidence += asset.confidence || 0;

      if (asset.duplicate_status === "duplicate" && asset.duplicate_group) {
        duplicates.add(asset.duplicate_group);
      }
    }

    // Detect potential duplicates by name similarity
    const nameMap = new Map<string, string[]>();
    for (const asset of assets) {
      const normalized = normalizeAssetName(asset.name);
      if (!nameMap.has(normalized)) nameMap.set(normalized, []);
      nameMap.get(normalized)!.push(asset.id);
    }
    const potentialDuplicates = [...nameMap.values()].filter(ids => ids.length > 1).length;
    const totalDuplicates = duplicates.size + potentialDuplicates;

    const qualityScore = Math.round(totalConfidence / assets.length);
    const missingDataPercent = Math.round((missingCount / assets.length) * 100);

    let section = `\n\n## تحليل الاستيعاب الجماعي (${count} أصل)\n`;
    section += `- إجمالي الأصول المستوردة: **${count}**\n`;
    section += `- جودة البيانات: ${qualityScore}% ${qualityScore > 70 ? "✅" : qualityScore > 40 ? "⚠️" : "🔴"}\n`;
    section += `- بيانات ناقصة: ${missingDataPercent}%\n`;

    if (totalDuplicates > 0) {
      section += `- ⚠️ تكرارات محتملة: **${totalDuplicates}** مجموعة — يُنصح بالمراجعة قبل التقييم\n`;
    }

    section += `\n### التوزيع حسب الفئة:\n`;
    const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    for (const [cat, cnt] of sortedCats.slice(0, 8)) {
      const pct = Math.round((cnt / count) * 100);
      section += `| ${cat} | ${cnt} | ${pct}% |\n`;
    }

    if (Object.keys(locations).length > 1) {
      section += `\n### التوزيع حسب الموقع:\n`;
      const sortedLocs = Object.entries(locations).sort((a, b) => b[1] - a[1]);
      for (const [loc, cnt] of sortedLocs.slice(0, 6)) {
        section += `| ${loc} | ${cnt} أصل |\n`;
      }
    }

    if (count > 100) {
      section += `\n💡 يُنصح باستخدام **التجميع الذكي** لتسريع التقييم — الأصول المتشابهة يمكن تقييمها كعينة ممثلة.\n`;
    }

    return {
      section, totalAssets: count, duplicatesDetected: totalDuplicates,
      categoriesBreakdown: categories, locationsBreakdown: locations,
      qualityScore, missingDataPercent,
    };
  } catch (e) {
    console.error("Bulk intake error:", e);
    return empty;
  }
}

function normalizeAssetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .replace(/\b(new|used|old)\b/gi, "")
    .replace(/\b\d{4}\b/g, "")
    .trim();
}
