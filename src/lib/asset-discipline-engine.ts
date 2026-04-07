/**
 * Asset Discipline Engine — محرك تحديد التخصص الذكي
 * 
 * Analyzes actual asset inventory to automatically determine:
 * - Overall discipline (real_estate, machinery_equipment, mixed, etc.)
 * - Detailed breakdown by asset type
 * - Asset descriptions for SOW/report context
 * - Appropriate valuation methodologies per IVS 2025
 */

export type Discipline = "real_estate" | "machinery_equipment" | "mixed";

export interface AssetBreakdown {
  type: string;
  label: string;
  count: number;
  examples: string[];
}

export interface DisciplineResult {
  discipline: Discipline;
  disciplineLabel: string;
  breakdowns: AssetBreakdown[];
  totalAssets: number;
  /** Readable asset description for SOW/report prompts */
  assetDescription: string;
  /** Recommended methodologies based on asset types */
  methodologies: string[];
  /** IVS references relevant to these asset types */
  ivsReferences: string[];
  /** Whether this is a portfolio (multi-asset) valuation */
  isPortfolio: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  machinery_equipment: "آلات ومعدات",
  vehicles: "مركبات",
  furniture_fixtures: "أثاث ومفروشات",
  technology_equipment: "أجهزة تقنية",
  medical_equipment: "أجهزة طبية",
  leasehold_improvements: "تحسينات مستأجرة",
  right_of_use: "حق استخدام / منفعة",
  electrical_mechanical: "أنظمة كهربائية وميكانيكية",
};

/** Asset types that fall under machinery_equipment discipline */
const MACHINERY_FAMILY = [
  "machinery_equipment", "vehicles", "furniture_fixtures",
  "technology_equipment", "medical_equipment",
  "electrical_mechanical", "leasehold_improvements",
];

/** Methodology recommendations per discipline */
const METHODOLOGY_MAP: Record<string, { methods: string[]; ivs: string[] }> = {
  real_estate: {
    methods: [
      "أسلوب المقارنة السوقية (Sales Comparison Approach)",
      "أسلوب التكلفة (Cost Approach)",
      "أسلوب الدخل (Income Approach)",
    ],
    ivs: ["IVS 105.10", "IVS 400"],
  },
  machinery_equipment: {
    methods: [
      "أسلوب التكلفة المستبدلة مع الاستهلاك (DRC)",
      "أسلوب المقارنة السوقية للمعدات",
      "القيمة الدفترية المعدلة",
    ],
    ivs: ["IVS 105.10", "IVS 300"],
  },
  vehicles: {
    methods: [
      "أسلوب المقارنة السوقية للمركبات",
      "أسلوب التكلفة المستبدلة مع الاستهلاك",
    ],
    ivs: ["IVS 105.10", "IVS 300"],
  },
  furniture_fixtures: {
    methods: [
      "أسلوب التكلفة المستبدلة مع الاستهلاك (DRC)",
      "القيمة الدفترية المعدلة",
    ],
    ivs: ["IVS 105.10", "IVS 300"],
  },
  technology_equipment: {
    methods: [
      "أسلوب التكلفة المستبدلة مع الاستهلاك",
      "أسلوب المقارنة السوقية",
    ],
    ivs: ["IVS 105.10", "IVS 300"],
  },
  medical_equipment: {
    methods: [
      "أسلوب التكلفة المستبدلة مع الاستهلاك (DRC)",
      "أسلوب المقارنة السوقية للأجهزة الطبية المتخصصة",
    ],
    ivs: ["IVS 105.10", "IVS 300"],
  },
};

/**
 * Analyze the actual asset inventory and determine the discipline intelligently.
 */
export function analyzeDiscipline(
  inventory: any[],
  fallbackDiscipline?: string,
  fallbackValuationType?: string,
): DisciplineResult {
  if (!inventory || inventory.length === 0) {
    // Fallback to stored discipline/valuation_type
    const raw = fallbackDiscipline || fallbackValuationType || "real_estate";
    const discipline = normalizeDiscipline(raw);
    return {
      discipline,
      disciplineLabel: getDisciplineLabel(discipline),
      breakdowns: [],
      totalAssets: 0,
      assetDescription: "لم يتم تحديد أصول بعد",
      methodologies: METHODOLOGY_MAP[discipline]?.methods || METHODOLOGY_MAP.real_estate.methods,
      ivsReferences: METHODOLOGY_MAP[discipline]?.ivs || METHODOLOGY_MAP.real_estate.ivs,
      isPortfolio: false,
    };
  }

  // Count by type
  const counts: Record<string, { count: number; examples: string[] }> = {};
  for (const asset of inventory) {
    const type = asset.type || asset.asset_type || "machinery_equipment";
    if (!counts[type]) counts[type] = { count: 0, examples: [] };
    counts[type].count++;
    if (counts[type].examples.length < 3 && asset.name) {
      counts[type].examples.push(asset.name);
    }
  }

  const breakdowns: AssetBreakdown[] = Object.entries(counts)
    .map(([type, data]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);

  const totalAssets = inventory.length;
  const realEstateCount = counts.real_estate?.count || 0;
  const machineryFamilyCount = MACHINERY_FAMILY.reduce((sum, t) => sum + (counts[t]?.count || 0), 0);

  // Determine discipline using 70% rule
  let discipline: Discipline;
  if (realEstateCount > 0 && machineryFamilyCount > 0) {
    discipline = "mixed";
  } else if (machineryFamilyCount > 0) {
    discipline = "machinery_equipment";
  } else {
    discipline = "real_estate";
  }

  // Build readable description
  const descParts = breakdowns.map(b => {
    const exStr = b.examples.length > 0 ? ` (${b.examples.join("، ")})` : "";
    return `${b.count} ${b.label}${exStr}`;
  });
  const assetDescription = `${totalAssets} أصل: ${descParts.join("، ")}`;

  // Collect relevant methodologies
  const methodSet = new Set<string>();
  const ivsSet = new Set<string>();
  for (const b of breakdowns) {
    const m = METHODOLOGY_MAP[b.type] || METHODOLOGY_MAP[discipline];
    if (m) {
      m.methods.forEach(method => methodSet.add(method));
      m.ivs.forEach(ref => ivsSet.add(ref));
    }
  }

  return {
    discipline,
    disciplineLabel: getDisciplineLabel(discipline),
    breakdowns,
    totalAssets,
    assetDescription,
    methodologies: Array.from(methodSet),
    ivsReferences: Array.from(ivsSet),
    isPortfolio: totalAssets > 1,
  };
}

function normalizeDiscipline(raw: string): Discipline {
  if (raw === "machinery" || raw === "machinery_equipment") return "machinery_equipment";
  if (raw === "mixed" || raw === "both") return "mixed";
  return "real_estate";
}

function getDisciplineLabel(d: Discipline): string {
  if (d === "machinery_equipment") return "آلات ومعدات";
  if (d === "mixed") return "مختلط (عقاري + آلات ومعدات)";
  return "عقار";
}

/**
 * Build a rich context block for AI prompts (SOW & report generation).
 */
export function buildAssetContextBlock(result: DisciplineResult): string {
  let block = `━━ تحليل الأصول ━━\n`;
  block += `- التخصص: ${result.disciplineLabel}\n`;
  block += `- إجمالي الأصول: ${result.totalAssets}\n`;

  for (const b of result.breakdowns) {
    block += `- ${b.label}: ${b.count}`;
    if (b.examples.length > 0) block += ` — مثال: ${b.examples.join("، ")}`;
    block += "\n";
  }

  block += `\n━━ المنهجيات المقترحة ━━\n`;
  result.methodologies.forEach((m, i) => {
    block += `${i + 1}. ${m}\n`;
  });

  block += `\n━━ المراجع المعيارية ━━\n`;
  block += result.ivsReferences.join("، ");

  return block;
}
