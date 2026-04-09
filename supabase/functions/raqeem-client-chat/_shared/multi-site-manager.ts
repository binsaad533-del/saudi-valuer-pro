/**
 * المستوى 44 — إدارة المواقع المتعددة (Multi-Site Manager)
 * تحليل توزيع الأصول جغرافياً مع معاملات تعديل إقليمية
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SiteInfo {
  siteName: string;
  assetCount: number;
  totalValue: number;
  regionalMultiplier: number;
  inspectorNeeded: boolean;
}

export interface MultiSiteResult {
  section: string;
  sites: SiteInfo[];
  totalSites: number;
  requiresMultiInspector: boolean;
  geographicSpreadKm: number;
}

const REGIONAL_MULTIPLIERS: Record<string, number> = {
  "الرياض": 1.0, "جدة": 0.95, "الدمام": 0.92, "الخبر": 0.93,
  "مكة": 0.90, "المدينة": 0.88, "تبوك": 0.82, "أبها": 0.80,
  "جازان": 0.78, "حائل": 0.80, "القصيم": 0.83, "نجران": 0.78,
  "الجوف": 0.77, "ينبع": 0.85, "الجبيل": 0.90, "الطائف": 0.84,
};

export async function analyzeMultiSite(
  db: SupabaseClient,
  assignmentId?: string
): Promise<MultiSiteResult> {
  const empty: MultiSiteResult = {
    section: "", sites: [], totalSites: 0,
    requiresMultiInspector: false, geographicSpreadKm: 0,
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
      .select("name, asset_data, category")
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);
    if (!assets?.length) return empty;

    // Group by location
    const siteMap = new Map<string, { count: number; totalCost: number }>();
    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const site = data.location || data.site || data.city || data.branch || "الموقع الرئيسي";
      if (!siteMap.has(site)) siteMap.set(site, { count: 0, totalCost: 0 });
      const entry = siteMap.get(site)!;
      entry.count++;
      entry.totalCost += Number(data.original_cost || data.replacement_cost || data.cost || 0);
    }

    if (siteMap.size < 2 && assets.length < 50) return empty;

    const sites: SiteInfo[] = [];
    for (const [name, info] of siteMap) {
      const multiplier = findRegionalMultiplier(name);
      const adjustedValue = Math.round(info.totalCost * multiplier);
      sites.push({
        siteName: name,
        assetCount: info.count,
        totalValue: adjustedValue,
        regionalMultiplier: multiplier,
        inspectorNeeded: info.count >= 10,
      });
    }
    sites.sort((a, b) => b.assetCount - a.assetCount);

    const multiInspector = sites.filter(s => s.inspectorNeeded).length > 1;

    let section = `\n\n## إدارة المواقع المتعددة (${sites.length} موقع)\n`;
    section += `| الموقع | عدد الأصول | القيمة التقديرية | معامل إقليمي | معاين مطلوب |\n|---|---|---|---|---|\n`;
    for (const s of sites.slice(0, 10)) {
      section += `| ${s.siteName} | ${s.assetCount} | ${s.totalValue.toLocaleString()} ر.س | ${s.regionalMultiplier} | ${s.inspectorNeeded ? "✅ نعم" : "—"} |\n`;
    }

    if (multiInspector) {
      section += `\n⚠️ يُنصح بتعيين **${sites.filter(s => s.inspectorNeeded).length} معاينين** لتغطية المواقع المتعددة بكفاءة.\n`;
    }

    const totalValue = sites.reduce((s, site) => s + site.totalValue, 0);
    section += `\n- إجمالي القيمة (معدّلة إقليمياً): **${totalValue.toLocaleString()} ر.س**\n`;
    section += `\n💡 المعامل الإقليمي يعكس فروقات السوق المحلية — الرياض كمرجع (1.0).\n`;

    return {
      section, sites, totalSites: sites.length,
      requiresMultiInspector: multiInspector, geographicSpreadKm: 0,
    };
  } catch (e) {
    console.error("Multi-site error:", e);
    return empty;
  }
}

function findRegionalMultiplier(siteName: string): number {
  for (const [city, mult] of Object.entries(REGIONAL_MULTIPLIERS)) {
    if (siteName.includes(city)) return mult;
  }
  return 0.85;
}
