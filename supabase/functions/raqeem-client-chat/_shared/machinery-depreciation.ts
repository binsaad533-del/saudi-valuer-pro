/**
 * المستوى 20 — محرك الإهلاك الذكي للآلات والمعدات
 * حساب الإهلاك التلقائي، العمر المتبقي، التقادم التقني
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DepreciationResult {
  method: string;
  annualRate: number;
  accumulatedDepreciation: number;
  currentValue: number;
  remainingLife: number;
}

export interface MachineryDepreciationAnalysis {
  section: string;
  assets: {
    name: string;
    originalCost: number;
    age: number;
    usefulLife: number;
    depreciation: DepreciationResult;
    obsolescenceFlag: string | null;
    conditionAdjustment: number;
  }[];
  totalOriginalCost: number;
  totalCurrentValue: number;
  overallDepreciationPercent: number;
}

// Standard useful life by equipment category (years)
const USEFUL_LIFE_TABLE: Record<string, number> = {
  "حفار": 15, "رافعة": 20, "مولد": 15, "ضاغط": 12,
  "مضخة": 10, "محول": 25, "مخرطة": 20, "لحام": 8,
  "رافعة شوكية": 10, "شاحنة": 12, "جرار": 15,
  "حاسب": 5, "خادم": 5, "طابعة": 5,
  "تكييف": 12, "مصعد": 20, "سير ناقل": 15,
  "فرن": 15, "ثلاجة صناعية": 12, "خلاط صناعي": 10,
  "آلة تعبئة": 12, "آلة قص": 15, "آلة طباعة": 10,
  "default": 15,
};

// Technology obsolescence indicators by category
const OBSOLESCENCE_THRESHOLDS: Record<string, { years: number; message: string }> = {
  "حاسب": { years: 4, message: "تقنية متقادمة — الأجهزة أقدم من 4 سنوات" },
  "خادم": { years: 5, message: "خوادم متقادمة تقنياً — يُنصح بتقييم الإحلال" },
  "طابعة": { years: 6, message: "طابعة قديمة — قد لا تتوفر قطع غيار" },
  "آلة طباعة": { years: 8, message: "آلة طباعة صناعية متقادمة تقنياً" },
};

export function calculateDepreciation(
  originalCost: number,
  age: number,
  usefulLife: number,
  method: "straight_line" | "declining_balance" | "units_of_production" = "straight_line",
  condition?: string,
  operatingHours?: number,
  maxOperatingHours?: number
): DepreciationResult {
  const salvageRate = 0.10; // 10% salvage value
  const salvageValue = originalCost * salvageRate;
  const depreciableAmount = originalCost - salvageValue;
  
  let annualRate: number;
  let accumulatedDepreciation: number;

  switch (method) {
    case "declining_balance": {
      // Double declining balance
      annualRate = (2 / usefulLife) * 100;
      let bookValue = originalCost;
      for (let i = 0; i < Math.min(age, usefulLife); i++) {
        const yearDep = bookValue * (annualRate / 100);
        bookValue = Math.max(bookValue - yearDep, salvageValue);
      }
      accumulatedDepreciation = originalCost - bookValue;
      break;
    }
    case "units_of_production": {
      if (operatingHours && maxOperatingHours && maxOperatingHours > 0) {
        const usageRate = Math.min(operatingHours / maxOperatingHours, 1);
        accumulatedDepreciation = depreciableAmount * usageRate;
        annualRate = (usageRate / Math.max(age, 1)) * 100;
      } else {
        // Fall back to straight line
        annualRate = (1 / usefulLife) * 100;
        accumulatedDepreciation = Math.min(depreciableAmount * (age / usefulLife), depreciableAmount);
      }
      break;
    }
    default: {
      // Straight line
      annualRate = (1 / usefulLife) * 100;
      accumulatedDepreciation = Math.min(depreciableAmount * (age / usefulLife), depreciableAmount);
    }
  }

  // Condition adjustment
  let conditionMultiplier = 1.0;
  if (condition) {
    const condMap: Record<string, number> = {
      "ممتاز": 0.85, "جيد جداً": 0.92, "جيد": 1.0,
      "متوسط": 1.10, "سيء": 1.25, "خردة": 1.50,
      "excellent": 0.85, "very_good": 0.92, "good": 1.0,
      "fair": 1.10, "poor": 1.25, "scrap": 1.50,
    };
    conditionMultiplier = condMap[condition] || 1.0;
  }

  accumulatedDepreciation = Math.min(accumulatedDepreciation * conditionMultiplier, depreciableAmount);
  const currentValue = Math.max(originalCost - accumulatedDepreciation, salvageValue);
  const remainingLife = Math.max(usefulLife - age, 0);

  return {
    method: method === "straight_line" ? "القسط الثابت" :
            method === "declining_balance" ? "القسط المتناقص" : "وحدات الإنتاج",
    annualRate: Math.round(annualRate * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation),
    currentValue: Math.round(currentValue),
    remainingLife,
  };
}

export function detectUsefulLife(assetName: string): number {
  const nameLower = assetName.toLowerCase();
  for (const [keyword, life] of Object.entries(USEFUL_LIFE_TABLE)) {
    if (keyword === "default") continue;
    if (nameLower.includes(keyword)) return life;
  }
  return USEFUL_LIFE_TABLE["default"];
}

export function detectObsolescence(assetName: string, age: number): string | null {
  const nameLower = assetName.toLowerCase();
  for (const [keyword, threshold] of Object.entries(OBSOLESCENCE_THRESHOLDS)) {
    if (nameLower.includes(keyword) && age > threshold.years) {
      return threshold.message;
    }
  }
  // General obsolescence for very old equipment
  if (age > 20) return "معدة قديمة جداً (>20 سنة) — يُنصح بتقييم جدوى الإحلال";
  return null;
}

export function selectDepreciationMethod(
  assetName: string,
  hasOperatingHours: boolean
): "straight_line" | "declining_balance" | "units_of_production" {
  const nameLower = assetName.toLowerCase();
  
  // IT equipment → declining balance (rapid depreciation)
  if (["حاسب", "خادم", "طابعة", "شاشة"].some(k => nameLower.includes(k))) {
    return "declining_balance";
  }
  
  // Heavy machinery with hours → units of production
  if (hasOperatingHours && ["حفار", "رافعة", "جرار", "شاحنة", "مولد"].some(k => nameLower.includes(k))) {
    return "units_of_production";
  }
  
  return "straight_line";
}

export async function analyzeMachineryDepreciation(
  db: SupabaseClient,
  assignmentId?: string
): Promise<MachineryDepreciationAnalysis | null> {
  if (!assignmentId) return null;

  try {
    // Get extracted assets for this assignment's processing job
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("id, valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || !["machinery_equipment", "mixed"].includes(assignment.valuation_type || "")) {
      return null;
    }

    // Get assets from processing jobs linked to this assignment
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    if (!jobs || jobs.length === 0) return null;

    const jobIds = jobs.map(j => j.id);
    const { data: assets } = await db
      .from("extracted_assets")
      .select("name, asset_data, condition, asset_type")
      .in("job_id", jobIds)
      .eq("review_status", "approved")
      .limit(200);

    if (!assets || assets.length === 0) return null;

    const analyzedAssets: MachineryDepreciationAnalysis["assets"] = [];
    let totalOriginal = 0;
    let totalCurrent = 0;

    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const originalCost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (originalCost <= 0) continue;

      const yearBuilt = Number(data.year_built || data.year || data.manufacture_year || 0);
      const currentYear = new Date().getFullYear();
      const age = yearBuilt > 1900 ? currentYear - yearBuilt : Number(data.age || 5);

      const usefulLife = detectUsefulLife(asset.name);
      const hasHours = !!data.operating_hours;
      const method = selectDepreciationMethod(asset.name, hasHours);

      const depreciation = calculateDepreciation(
        originalCost, age, usefulLife, method,
        asset.condition || data.condition,
        Number(data.operating_hours || 0),
        Number(data.max_operating_hours || usefulLife * 2000)
      );

      const obsolescence = detectObsolescence(asset.name, age);

      analyzedAssets.push({
        name: asset.name,
        originalCost,
        age,
        usefulLife,
        depreciation,
        obsolescenceFlag: obsolescence,
        conditionAdjustment: asset.condition === "ممتاز" ? -15 : asset.condition === "سيء" ? 25 : 0,
      });

      totalOriginal += originalCost;
      totalCurrent += depreciation.currentValue;
    }

    if (analyzedAssets.length === 0) return null;

    const overallPercent = totalOriginal > 0
      ? Math.round(((totalOriginal - totalCurrent) / totalOriginal) * 100)
      : 0;

    // Build section for system prompt
    let section = "\n\n## تحليل إهلاك الآلات والمعدات\n";
    section += `- إجمالي الأصول المحللة: ${analyzedAssets.length}\n`;
    section += `- إجمالي التكلفة الأصلية: ${totalOriginal.toLocaleString()} ر.س\n`;
    section += `- إجمالي القيمة الحالية المقدرة: ${totalCurrent.toLocaleString()} ر.س\n`;
    section += `- نسبة الإهلاك الإجمالي: ${overallPercent}%\n`;

    // Top depreciated assets
    const topDepreciated = [...analyzedAssets]
      .sort((a, b) => (b.originalCost - b.depreciation.currentValue) - (a.originalCost - a.depreciation.currentValue))
      .slice(0, 5);

    section += "\n### أعلى الأصول إهلاكاً:\n";
    for (const a of topDepreciated) {
      section += `• ${a.name}: ${a.depreciation.currentValue.toLocaleString()} ر.س (إهلاك ${Math.round((1 - a.depreciation.currentValue / a.originalCost) * 100)}%) — ${a.depreciation.method}\n`;
    }

    // Obsolescence warnings
    const obsolete = analyzedAssets.filter(a => a.obsolescenceFlag);
    if (obsolete.length > 0) {
      section += "\n### ⚠️ تحذيرات التقادم التقني:\n";
      for (const a of obsolete) {
        section += `• ${a.name}: ${a.obsolescenceFlag}\n`;
      }
    }

    section += "\nاستخدم هذه البيانات لإثراء ردودك عن قيمة المعدات. نوّه أنها تقديرات أولية تخضع للمراجعة المهنية.\n";

    return {
      section,
      assets: analyzedAssets,
      totalOriginalCost: totalOriginal,
      totalCurrentValue: totalCurrent,
      overallDepreciationPercent: overallPercent,
    };
  } catch (e) {
    console.error("Machinery depreciation error:", e);
    return null;
  }
}
