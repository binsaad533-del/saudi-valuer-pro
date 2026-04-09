/**
 * المستوى 23 — تقييم خطوط الإنتاج الكاملة
 * تقييم المنظومة، تحليل الترابط، محاكاة الطاقة الإنتاجية
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ProductionLineAsset {
  id: string;
  name: string;
  category: string;
  cost: number;
  age: number;
  condition: string;
  isBottleneck: boolean;
  dependsOn: string[];
}

export interface ProductionLineAnalysis {
  section: string;
  lineCount: number;
  lines: {
    name: string;
    assetCount: number;
    totalCost: number;
    systemValue: number;
    capacityPercent: number;
    bottleneck: string | null;
    interdependencies: number;
  }[];
  systemPremium: number; // % premium for integrated system
  recommendations: string[];
}

/**
 * Detect production lines by grouping related assets
 */
function detectProductionLines(
  assets: { name: string; category?: string; asset_data: Record<string, any> }[]
): Map<string, typeof assets> {
  const lines = new Map<string, typeof assets>();

  // Heuristic: Group by location, line number, or production function
  const linePatterns = [
    /خط\s*(إنتاج|تعبئة|تغليف|تجميع|طلاء)\s*(\d*)/,
    /line\s*#?\s*(\d+)/i,
    /production\s*line\s*(\d+)/i,
  ];

  for (const asset of assets) {
    const data = asset.asset_data || {};
    const text = `${asset.name} ${data.location || ""} ${data.description || ""}`;
    let lineName = "خط رئيسي";

    for (const pattern of linePatterns) {
      const match = text.match(pattern);
      if (match) {
        lineName = match[0].trim();
        break;
      }
    }

    // Also group by functional area
    if (lineName === "خط رئيسي") {
      const cat = asset.category?.toLowerCase() || "";
      if (cat.includes("إنتاج") || cat.includes("production")) lineName = "خط الإنتاج";
      else if (cat.includes("تعبئة") || cat.includes("packaging")) lineName = "خط التعبئة";
      else if (cat.includes("كهرب") || cat.includes("electrical")) lineName = "النظام الكهربائي";
      else if (cat.includes("ميكانيك") || cat.includes("mechanical")) lineName = "النظام الميكانيكي";
    }

    if (!lines.has(lineName)) lines.set(lineName, []);
    lines.get(lineName)!.push(asset);
  }

  return lines;
}

/**
 * Detect bottleneck in a production line
 */
function detectBottleneck(
  assets: { name: string; asset_data: Record<string, any>; condition?: string }[]
): string | null {
  let worstAsset: string | null = null;
  let worstScore = 100;

  const conditionScores: Record<string, number> = {
    "ممتاز": 95, "جيد جداً": 85, "جيد": 75,
    "متوسط": 55, "سيء": 30, "خردة": 10,
    "excellent": 95, "very_good": 85, "good": 75,
    "fair": 55, "poor": 30, "scrap": 10,
  };

  for (const asset of assets) {
    const data = asset.asset_data || {};
    const condition = asset.condition || data.condition || "جيد";
    const score = conditionScores[condition] || 75;

    // Age penalty
    const year = Number(data.year_built || data.year || 0);
    const age = year > 1900 ? new Date().getFullYear() - year : 5;
    const agePenalty = Math.min(age * 2, 30);

    const totalScore = score - agePenalty;
    if (totalScore < worstScore) {
      worstScore = totalScore;
      worstAsset = asset.name;
    }
  }

  return worstScore < 50 ? worstAsset : null;
}

/**
 * Calculate system premium (integrated value > sum of parts)
 */
function calculateSystemPremium(assetCount: number, avgConditionScore: number): number {
  // Larger, well-maintained systems have higher premiums
  if (assetCount < 3) return 0;
  if (assetCount <= 5) return avgConditionScore > 70 ? 10 : 5;
  if (assetCount <= 15) return avgConditionScore > 70 ? 15 : 8;
  return avgConditionScore > 70 ? 20 : 10;
}

export async function analyzeProductionLines(
  db: SupabaseClient,
  assignmentId?: string
): Promise<ProductionLineAnalysis | null> {
  if (!assignmentId) return null;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || !["machinery_equipment", "mixed"].includes(assignment.valuation_type || "")) {
      return null;
    }

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    if (!jobs || jobs.length === 0) return null;

    const jobIds = jobs.map(j => j.id);
    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, category, asset_type")
      .in("job_id", jobIds)
      .limit(300);

    if (!assets || assets.length < 3) return null;

    // Map assets
    const mappedAssets = assets.map(a => ({
      name: a.name,
      category: a.category || a.asset_type || "",
      asset_data: (a.asset_data as Record<string, any>) || {},
      condition: a.condition || undefined,
    }));

    const lines = detectProductionLines(mappedAssets);
    if (lines.size === 0) return null;

    const lineResults: ProductionLineAnalysis["lines"] = [];
    const recommendations: string[] = [];
    let totalSystemPremium = 0;

    const conditionScores: Record<string, number> = {
      "ممتاز": 95, "جيد جداً": 85, "جيد": 75,
      "متوسط": 55, "سيء": 30, "خردة": 10,
    };

    for (const [lineName, lineAssets] of lines) {
      let totalCost = 0;
      let totalConditionScore = 0;
      let scoredCount = 0;

      for (const a of lineAssets) {
        const cost = Number(a.asset_data.original_cost || a.asset_data.replacement_cost || a.asset_data.cost || 0);
        totalCost += cost;

        const cond = a.condition || a.asset_data.condition || "جيد";
        totalConditionScore += conditionScores[cond] || 75;
        scoredCount++;
      }

      const avgCondition = scoredCount > 0 ? Math.round(totalConditionScore / scoredCount) : 75;
      const bottleneck = detectBottleneck(lineAssets);
      const premium = calculateSystemPremium(lineAssets.length, avgCondition);
      const systemValue = Math.round(totalCost * (1 + premium / 100));

      // Capacity estimate based on condition
      const capacityPercent = Math.min(avgCondition + 5, 100);

      totalSystemPremium += premium;

      lineResults.push({
        name: lineName,
        assetCount: lineAssets.length,
        totalCost: Math.round(totalCost),
        systemValue,
        capacityPercent,
        bottleneck,
        interdependencies: Math.max(0, lineAssets.length - 1),
      });

      // Recommendations
      if (bottleneck) {
        recommendations.push(`⚠️ ${lineName}: عنق الزجاجة في "${bottleneck}" — يؤثر على إنتاجية الخط بالكامل`);
      }
      if (avgCondition < 50) {
        recommendations.push(`🔧 ${lineName}: متوسط حالة المعدات ضعيف (${avgCondition}%) — يُنصح بخطة صيانة شاملة`);
      }
      if (premium > 15) {
        recommendations.push(`📈 ${lineName}: علاوة منظومة ${premium}% — القيمة ككل أعلى من مجموع الأجزاء`);
      }
    }

    const avgPremium = lineResults.length > 0
      ? Math.round(totalSystemPremium / lineResults.length)
      : 0;

    // Build section
    let section = "\n\n## تحليل خطوط الإنتاج\n";
    section += `- عدد الخطوط/المنظومات المكتشفة: ${lineResults.length}\n`;
    section += `- علاوة المنظومة المتوسطة: ${avgPremium}%\n`;

    for (const line of lineResults.sort((a, b) => b.totalCost - a.totalCost)) {
      section += `\n### ${line.name} (${line.assetCount} أصل)\n`;
      section += `- تكلفة المكونات: ${line.totalCost.toLocaleString()} ر.س\n`;
      section += `- قيمة المنظومة: ${line.systemValue.toLocaleString()} ر.س\n`;
      section += `- الطاقة الإنتاجية التقديرية: ${line.capacityPercent}%\n`;
      if (line.bottleneck) section += `- ⚠️ عنق الزجاجة: ${line.bottleneck}\n`;
      section += `- الترابطات: ${line.interdependencies} تبعية\n`;
    }

    if (recommendations.length > 0) {
      section += "\n### التوصيات:\n";
      for (const r of recommendations) section += `${r}\n`;
    }

    section += "\nاستخدم تحليل المنظومة لشرح قيمة خطوط الإنتاج للعميل. نوّه أن 'علاوة المنظومة' تعكس القيمة الإضافية للتكامل.\n";

    return {
      section,
      lineCount: lineResults.length,
      lines: lineResults,
      systemPremium: avgPremium,
      recommendations,
    };
  } catch (e) {
    console.error("Production line analysis error:", e);
    return null;
  }
}
