/**
 * المستوى 34 — محرك تخصيص سعر الاستحواذ (PPA)
 * Purchase Price Allocation وفقاً لـ IFRS 3 و IVS 2025
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PPAAllocation {
  category: string;
  categoryAr: string;
  fairValue: number;
  percentOfTotal: number;
  method: string;
  ifrsBasis: string;
}

export interface PPAResult {
  section: string;
  allocations: PPAAllocation[];
  totalPurchasePrice: number;
  identifiedAssets: number;
  goodwill: number;
  goodwillPercent: number;
}

export async function analyzePPA(
  db: SupabaseClient,
  assignmentId?: string
): Promise<PPAResult> {
  const empty: PPAResult = { section: "", allocations: [], totalPurchasePrice: 0, identifiedAssets: 0, goodwill: 0, goodwillPercent: 0 };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, category, asset_type")
      .in("job_id", jobs.map(j => j.id))
      .limit(200);
    if (!assets?.length) return empty;

    // Categorize assets for PPA
    const categories: Record<string, { value: number; count: number; method: string; ifrs: string }> = {
      "أراضي": { value: 0, count: 0, method: "أسلوب المقارنة", ifrs: "IAS 16" },
      "مباني": { value: 0, count: 0, method: "أسلوب التكلفة / المقارنة", ifrs: "IAS 16" },
      "آلات ومعدات": { value: 0, count: 0, method: "أسلوب التكلفة (DRC)", ifrs: "IAS 16" },
      "أصول غير ملموسة": { value: 0, count: 0, method: "أسلوب الدخل (MEEM/RFR)", ifrs: "IAS 38" },
      "مخزون": { value: 0, count: 0, method: "صافي القيمة القابلة للتحقق", ifrs: "IAS 2" },
      "ذمم مدينة": { value: 0, count: 0, method: "القيمة الاسمية ناقص المخصصات", ifrs: "IFRS 9" },
      "استثمارات عقارية": { value: 0, count: 0, method: "القيمة العادلة", ifrs: "IAS 40" },
      "أخرى": { value: 0, count: 0, method: "التكلفة أو القيمة العادلة", ifrs: "IFRS 3" },
    };

    let totalIdentified = 0;

    for (const asset of assets) {
      const d = asset.asset_data as Record<string, any> || {};
      const value = Number(d.fair_value || d.value || d.market_value || d.cost || 0);
      if (value <= 0) continue;

      const type = (asset.asset_type || asset.category || "").toLowerCase();
      let cat = "أخرى";
      if (type.includes("أرض") || type.includes("land")) cat = "أراضي";
      else if (type.includes("مبن") || type.includes("عقار") || type.includes("building")) cat = "مباني";
      else if (type.includes("آل") || type.includes("معد") || type.includes("machine")) cat = "آلات ومعدات";
      else if (type.includes("برمج") || type.includes("علام") || type.includes("intangible")) cat = "أصول غير ملموسة";
      else if (type.includes("مخزون") || type.includes("inventory")) cat = "مخزون";
      else if (type.includes("استثمار") || type.includes("investment")) cat = "استثمارات عقارية";

      categories[cat].value += value;
      categories[cat].count++;
      totalIdentified += value;
    }

    if (totalIdentified <= 0) return empty;

    // Estimate purchase price (identified + goodwill premium ~15-25%)
    const goodwillRate = 0.18;
    const totalPurchasePrice = Math.round(totalIdentified * (1 + goodwillRate));
    const goodwill = totalPurchasePrice - totalIdentified;
    const goodwillPercent = Math.round((goodwill / totalPurchasePrice) * 100);

    const allocations: PPAAllocation[] = [];
    for (const [catAr, info] of Object.entries(categories)) {
      if (info.value <= 0) continue;
      allocations.push({
        category: catAr, categoryAr: catAr,
        fairValue: Math.round(info.value),
        percentOfTotal: Math.round((info.value / totalPurchasePrice) * 100),
        method: info.method, ifrsBasis: info.ifrs,
      });
    }

    // Add goodwill
    allocations.push({
      category: "goodwill", categoryAr: "شهرة (Goodwill)",
      fairValue: goodwill,
      percentOfTotal: goodwillPercent,
      method: "الفرق بين سعر الاستحواذ وصافي الأصول المحددة", ifrsBasis: "IFRS 3.32",
    });

    let section = "\n\n## تخصيص سعر الاستحواذ (PPA) — IFRS 3\n";
    section += `\n| الفئة | القيمة العادلة (ر.س) | النسبة | المنهجية | المرجع |\n|---|---|---|---|---|\n`;
    for (const a of allocations.sort((x, y) => y.fairValue - x.fairValue)) {
      section += `| ${a.categoryAr} | ${a.fairValue.toLocaleString()} | ${a.percentOfTotal}% | ${a.method} | ${a.ifrsBasis} |\n`;
    }
    section += `| **الإجمالي** | **${totalPurchasePrice.toLocaleString()}** | **100%** | | |\n`;

    section += `\n### ملاحظات مهنية:\n`;
    section += `• الشهرة تمثل ${goodwillPercent}% من سعر الاستحواذ ${goodwillPercent > 30 ? "— نسبة مرتفعة تستدعي مراجعة" : ""}\n`;
    section += `• يجب إجراء اختبار انخفاض القيمة للشهرة سنوياً (IAS 36)\n`;
    section += `• الأصول غير الملموسة المحددة يجب فصلها عن الشهرة وفقاً لـ IFRS 3.18\n`;

    return { section, allocations, totalPurchasePrice, identifiedAssets: Math.round(totalIdentified), goodwill, goodwillPercent };
  } catch (e) {
    console.error("PPA analysis error:", e);
    return empty;
  }
}
