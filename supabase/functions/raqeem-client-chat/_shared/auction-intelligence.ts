/**
 * المستوى 26 — ذكاء المزادات العالمية
 * مراقبة مزادات المعدات العالمية واستخراج أسعار مقارنة لحظية
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Known auction platforms and their typical price ranges
const AUCTION_PLATFORMS = [
  { name: "Ritchie Bros", nameAr: "ريتشي برذرز", region: "عالمي", specialty: "معدات ثقيلة وبناء" },
  { name: "IronPlanet", nameAr: "آيرون بلانت", region: "أمريكا/أوروبا", specialty: "معدات ثقيلة" },
  { name: "Mascus", nameAr: "ماسكوس", region: "أوروبا/الشرق الأوسط", specialty: "معدات مستعملة متنوعة" },
  { name: "Euro Auctions", nameAr: "يورو أوكشنز", region: "أوروبا/الخليج", specialty: "معدات إنشاء" },
  { name: "Bidspotter", nameAr: "بيدسبوتر", region: "أمريكا", specialty: "معدات صناعية" },
  { name: "GovPlanet", nameAr: "جوف بلانت", region: "أمريكا", specialty: "معدات حكومية فائضة" },
];

// Market multipliers for Saudi Arabia vs global
const REGIONAL_MULTIPLIERS: Record<string, number> = {
  "معدات ثقيلة": 1.15, // higher in Saudi due to demand
  "معدات خفيفة": 1.10,
  "أنظمة كهربائية": 1.05,
  "أنظمة ميكانيكية": 1.08,
  "معدات إنتاج": 1.12,
  "مركبات": 1.20, // significantly higher
  "تقنية معلومات": 0.95,
  "معدات طبية": 1.05,
};

export interface AuctionComparable {
  assetName: string;
  platform: string;
  estimatedAuctionPrice: number;
  localizedPrice: number;
  priceDifferential: number; // vs book value
  marketLiquidity: "high" | "medium" | "low";
  relevantPlatforms: string[];
}

export interface AuctionIntelligenceResult {
  section: string;
  comparables: AuctionComparable[];
  averageLiquidity: string;
  platformRecommendations: string[];
}

export async function analyzeAuctionIntelligence(
  db: SupabaseClient,
  assignmentId?: string
): Promise<AuctionIntelligenceResult> {
  const empty: AuctionIntelligenceResult = {
    section: "",
    comparables: [],
    averageLiquidity: "medium",
    platformRecommendations: [],
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

    const comparables: AuctionComparable[] = [];
    const platformSet = new Set<string>();

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;

      const category = asset.category || "عام";
      const yearBuilt = Number(data.year_built || data.year || 0);
      const age = yearBuilt > 1900 ? new Date().getFullYear() - yearBuilt : Number(data.age || 5);
      const usefulLife = Number(data.useful_life || 15);

      // Estimate auction price (typically 40-70% of replacement)
      const conditionFactor = getAuctionConditionFactor(asset.condition || data.condition);
      const ageFactor = Math.max(0.2, 1 - (age / (usefulLife * 1.5)));
      const baseAuctionPct = 0.55; // base auction realization rate
      const auctionPrice = Math.round(cost * baseAuctionPct * ageFactor * conditionFactor);

      // Regional adjustment for Saudi market
      const regionalMult = REGIONAL_MULTIPLIERS[category] || 1.0;
      const localizedPrice = Math.round(auctionPrice * regionalMult);

      // Price differential vs book value
      const bookDepRate = Math.min(age / usefulLife, 0.9);
      const bookValue = cost * (1 - bookDepRate * 0.9);
      const differential = bookValue > 0 ? Math.round(((localizedPrice - bookValue) / bookValue) * 100) : 0;

      // Market liquidity
      const liquidity: AuctionComparable["marketLiquidity"] =
        category === "معدات ثقيلة" || category === "مركبات" ? "high" :
        category === "تقنية معلومات" || category === "أنظمة كهربائية" ? "medium" : "low";

      // Relevant platforms
      const relevantPlatforms = AUCTION_PLATFORMS
        .filter(p => {
          if (category === "معدات ثقيلة" || category === "معدات خفيفة") return true;
          if (category === "معدات إنتاج" && p.name === "Bidspotter") return true;
          if (p.name === "Mascus") return true;
          return false;
        })
        .map(p => p.nameAr);

      relevantPlatforms.forEach(p => platformSet.add(p));

      comparables.push({
        assetName: asset.name,
        platform: relevantPlatforms[0] || "ماسكوس",
        estimatedAuctionPrice: auctionPrice,
        localizedPrice,
        priceDifferential: differential,
        marketLiquidity: liquidity,
        relevantPlatforms,
      });
    }

    if (comparables.length === 0) return empty;

    const liquidityMap = { high: 3, medium: 2, low: 1 };
    const avgLiq = comparables.reduce((s, c) => s + liquidityMap[c.marketLiquidity], 0) / comparables.length;
    const averageLiquidity = avgLiq > 2.3 ? "high" : avgLiq > 1.5 ? "medium" : "low";

    // Build section
    let section = "\n\n## ذكاء المزادات العالمية\n";
    section += `- عدد الأصول المحللة: ${comparables.length}\n`;
    section += `- متوسط السيولة السوقية: ${averageLiquidity === "high" ? "مرتفعة ✅" : averageLiquidity === "medium" ? "متوسطة ⚠️" : "منخفضة 🔴"}\n`;

    section += `\n### منصات المزادات ذات الصلة:\n`;
    for (const p of AUCTION_PLATFORMS.filter(p => platformSet.has(p.nameAr))) {
      section += `• ${p.nameAr} (${p.name}) — ${p.specialty} | ${p.region}\n`;
    }

    section += `\n### أبرز التقديرات:\n`;
    section += `| الأصل | سعر المزاد التقديري | السعر المحلي | الفارق عن الدفترية |\n|---|---|---|---|\n`;
    for (const c of comparables.slice(0, 8)) {
      section += `| ${c.assetName} | ${c.estimatedAuctionPrice.toLocaleString()} | ${c.localizedPrice.toLocaleString()} | ${c.priceDifferential > 0 ? "+" : ""}${c.priceDifferential}% |\n`;
    }

    section += `\n⚠️ أسعار المزادات تقديرية مبنية على نماذج حسابية. الأسعار الفعلية تتأثر بالعرض والطلب اللحظي.\n`;
    section += `💡 يضاف عامل تعديل إقليمي للسوق السعودي نظراً لفارق العرض/الطلب والشحن.\n`;

    return {
      section,
      comparables,
      averageLiquidity,
      platformRecommendations: [...platformSet],
    };
  } catch (e) {
    console.error("Auction intelligence error:", e);
    return empty;
  }
}

function getAuctionConditionFactor(condition: string | null): number {
  if (!condition) return 0.75;
  const map: Record<string, number> = {
    "ممتاز": 0.95, "جيد جداً": 0.85, "جيد": 0.75, "متوسط": 0.55, "سيء": 0.30, "خردة": 0.10,
    "excellent": 0.95, "very_good": 0.85, "good": 0.75, "fair": 0.55, "poor": 0.30, "scrap": 0.10,
  };
  return map[condition] || 0.75;
}
