import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ============================================================
// ADJUSTMENT RULES (deterministic, not AI)
// ============================================================
const ADJUSTMENT_RULES: Record<string, { min: number; max: number }> = {
  location: { min: -0.20, max: 0.20 },
  size:     { min: -0.15, max: 0.15 },
  age:      { min: -0.30, max: 0.00 },
  condition:{ min: -0.20, max: 0.10 },
  time:     { min: -0.10, max: 0.15 },
};

function clampAdjustment(type: string, value: number): number {
  const rule = ADJUSTMENT_RULES[type];
  if (!rule) return value;
  return Math.max(rule.min, Math.min(rule.max, value));
}

function validateAdjustment(type: string, value: number): { valid: boolean; clamped: number; original: number } {
  const rule = ADJUSTMENT_RULES[type];
  if (!rule) return { valid: true, clamped: value, original: value };
  const clamped = clampAdjustment(type, value);
  return { valid: clamped === value, clamped, original: value };
}

// ============================================================
// DETERMINISTIC CALCULATION ENGINE (NO AI)
// ============================================================

interface AuditStep {
  step: number;
  label_ar: string;
  label_en: string;
  formula: string;
  inputs: Record<string, any>;
  result: number;
  unit: string;
}

// Market Approach
function calcMarketApproach(
  comparables: Array<{ id: string; price: number; area: number; adjustments: Record<string, number> }>,
  subjectArea: number,
  weights?: number[]
): { value: number; price_per_sqm: number; audit: AuditStep[]; errors: string[] } {
  const audit: AuditStep[] = [];
  const errors: string[] = [];
  let step = 1;

  if (!comparables.length) return { value: 0, price_per_sqm: 0, audit, errors: ["No comparables"] };

  const adjustedPrices: number[] = [];

  for (const comp of comparables) {
    const basePsm = comp.price / comp.area;
    audit.push({ step: step++, label_ar: `سعر المتر الأساسي - مقارن`, label_en: `Base price/sqm`, formula: "price / area", inputs: { price: comp.price, area: comp.area }, result: Math.round(basePsm * 100) / 100, unit: "SAR/sqm" });

    let totalAdj = 0;
    for (const [type, pct] of Object.entries(comp.adjustments)) {
      const v = validateAdjustment(type, pct);
      if (!v.valid) {
        errors.push(`Adjustment ${type}: ${(pct*100).toFixed(1)}% clamped to ${(v.clamped*100).toFixed(1)}%`);
      }
      totalAdj += v.clamped;
    }

    const adjPsm = basePsm * (1 + totalAdj);
    audit.push({ step: step++, label_ar: `السعر المعدّل`, label_en: `Adjusted price/sqm`, formula: "base * (1 + Σadj)", inputs: { base: Math.round(basePsm * 100) / 100, total_adj_pct: Math.round(totalAdj * 10000) / 100 }, result: Math.round(adjPsm * 100) / 100, unit: "SAR/sqm" });

    adjustedPrices.push(adjPsm);
  }

  let avgPsm: number;
  if (weights && weights.length === comparables.length) {
    const wSum = weights.reduce((a, b) => a + b, 0);
    avgPsm = adjustedPrices.reduce((s, p, i) => s + p * (weights[i] / wSum), 0);
  } else {
    avgPsm = adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length;
  }

  const value = avgPsm * subjectArea;
  audit.push({ step: step++, label_ar: "القيمة بأسلوب المقارنة", label_en: "Market approach value", formula: "avg_price_sqm * subject_area", inputs: { avg_psm: Math.round(avgPsm * 100) / 100, area: subjectArea }, result: Math.round(value), unit: "SAR" });

  return { value: Math.round(value), price_per_sqm: Math.round(avgPsm * 100) / 100, audit, errors };
}

// Cost Approach
function calcCostApproach(
  landArea: number, landRate: number,
  buildingArea: number, replacementCostSqm: number,
  ageYears: number, usefulLife: number,
  functionalObs?: number, externalObs?: number
): { value: number; land_value: number; building_value: number; audit: AuditStep[]; errors: string[] } {
  const audit: AuditStep[] = [];
  const errors: string[] = [];
  let step = 1;

  const landValue = landArea * landRate;
  audit.push({ step: step++, label_ar: "قيمة الأرض", label_en: "Land Value", formula: "land_area * land_rate", inputs: { land_area: landArea, land_rate: landRate }, result: Math.round(landValue), unit: "SAR" });

  const replCost = buildingArea * replacementCostSqm;
  audit.push({ step: step++, label_ar: "تكلفة الإحلال", label_en: "Replacement Cost", formula: "building_area * cost_sqm", inputs: { building_area: buildingArea, cost_sqm: replacementCostSqm }, result: Math.round(replCost), unit: "SAR" });

  const physDep = Math.min(ageYears / usefulLife, 1);
  const funcDep = functionalObs ?? 0;
  const extDep = externalObs ?? 0;
  const totalDep = Math.min(physDep + funcDep + extDep, 1);

  audit.push({ step: step++, label_ar: "الإهلاك الكلي", label_en: "Total Depreciation", formula: "min(age/life + functional + external, 1)", inputs: { age: ageYears, life: usefulLife, phys_pct: Math.round(physDep * 100), func_pct: Math.round(funcDep * 100), ext_pct: Math.round(extDep * 100), total_pct: Math.round(totalDep * 100) }, result: Math.round(replCost * totalDep), unit: "SAR" });

  const depBldg = replCost * (1 - totalDep);
  const total = landValue + depBldg;

  audit.push({ step: step++, label_ar: "القيمة بأسلوب التكلفة", label_en: "Cost Approach Value", formula: "land_value + building * (1 - depreciation)", inputs: { land: Math.round(landValue), building_dep: Math.round(depBldg) }, result: Math.round(total), unit: "SAR" });

  return { value: Math.round(total), land_value: Math.round(landValue), building_value: Math.round(depBldg), audit, errors };
}

// Income Approach
function calcIncomeApproach(
  grossIncome: number, vacancyRate: number,
  expenses: number, capRate: number
): { value: number; noi: number; audit: AuditStep[]; errors: string[] } {
  const audit: AuditStep[] = [];
  const errors: string[] = [];
  let step = 1;

  if (capRate <= 0 || capRate > 0.25) errors.push(`Cap rate ${(capRate*100).toFixed(1)}% outside 1%-25%`);
  if (vacancyRate < 0 || vacancyRate > 1) errors.push("Invalid vacancy rate");

  const egi = grossIncome * (1 - vacancyRate);
  audit.push({ step: step++, label_ar: "الدخل الإجمالي الفعلي", label_en: "EGI", formula: "gross * (1 - vacancy)", inputs: { gross: grossIncome, vacancy_pct: Math.round(vacancyRate * 100) }, result: Math.round(egi), unit: "SAR" });

  const noi = egi - expenses;
  audit.push({ step: step++, label_ar: "صافي الدخل التشغيلي", label_en: "NOI", formula: "EGI - expenses", inputs: { egi: Math.round(egi), expenses }, result: Math.round(noi), unit: "SAR" });

  const value = capRate > 0 ? noi / capRate : 0;
  audit.push({ step: step++, label_ar: "القيمة بأسلوب الدخل", label_en: "Income Approach Value", formula: "NOI / cap_rate", inputs: { noi: Math.round(noi), cap_rate_pct: (capRate * 100).toFixed(2) }, result: Math.round(value), unit: "SAR" });

  return { value: Math.round(value), noi: Math.round(noi), audit, errors };
}

// ============================================================
// MACHINERY VALUATION ENGINE (deterministic)
// ============================================================

interface MachineryAsset {
  id: string;
  asset_name_ar: string;
  replacement_cost: number;
  year_manufactured: number;
  total_useful_life: number;
  remaining_useful_life?: number;
  condition: string;
  condition_score?: number;
  is_operational: boolean;
  depreciation_method: string;
}

function calcMachineryAsset(asset: MachineryAsset): {
  value: number;
  rcn: number;
  physical_dep_pct: number;
  functional_obs_pct: number;
  economic_obs_pct: number;
  audit: AuditStep[];
  errors: string[];
} {
  const audit: AuditStep[] = [];
  const errors: string[] = [];
  let step = 1;

  const rcn = asset.replacement_cost || 0;
  if (rcn <= 0) errors.push(`Asset ${asset.asset_name_ar}: missing replacement cost`);

  audit.push({ step: step++, label_ar: `تكلفة الإحلال الجديد - ${asset.asset_name_ar}`, label_en: "Replacement Cost New", formula: "RCN", inputs: { asset: asset.asset_name_ar, rcn }, result: rcn, unit: "SAR" });

  // Physical depreciation
  const currentYear = new Date().getFullYear();
  const age = asset.year_manufactured ? currentYear - asset.year_manufactured : 0;
  const usefulLife = asset.total_useful_life || 15;
  const physDepPct = asset.depreciation_method === "straight_line"
    ? Math.min(age / usefulLife, 0.95)
    : Math.min(1 - Math.pow(1 - (2 / usefulLife), age), 0.95);

  audit.push({ step: step++, label_ar: "الإهلاك المادي", label_en: "Physical Depreciation", formula: asset.depreciation_method === "straight_line" ? "age / useful_life" : "1 - (1 - 2/life)^age", inputs: { age, useful_life: usefulLife, method: asset.depreciation_method }, result: Math.round(physDepPct * 10000) / 100, unit: "%" });

  // Condition-based adjustments
  const conditionMap: Record<string, { func: number; econ: number }> = {
    excellent: { func: 0, econ: 0 },
    good: { func: 0.02, econ: 0.01 },
    fair: { func: 0.05, econ: 0.03 },
    poor: { func: 0.10, econ: 0.05 },
    scrap: { func: 0.20, econ: 0.15 },
  };
  const condAdj = conditionMap[asset.condition] || conditionMap.good;
  const funcObsPct = condAdj.func;
  const econObsPct = condAdj.econ;

  // Not operational penalty
  const operationalPenalty = asset.is_operational ? 0 : 0.30;

  const totalDep = Math.min(physDepPct + funcObsPct + econObsPct + operationalPenalty, 0.98);
  const depreciatedValue = rcn * (1 - totalDep);

  audit.push({ step: step++, label_ar: "إجمالي الإهلاك والتقادم", label_en: "Total Depreciation & Obsolescence", formula: "physical + functional + economic + operational", inputs: { physical_pct: Math.round(physDepPct * 100), functional_pct: Math.round(funcObsPct * 100), economic_pct: Math.round(econObsPct * 100), operational_penalty_pct: Math.round(operationalPenalty * 100), total_pct: Math.round(totalDep * 100) }, result: Math.round(rcn * totalDep), unit: "SAR" });

  audit.push({ step: step++, label_ar: `القيمة المستهلكة - ${asset.asset_name_ar}`, label_en: "Depreciated Value", formula: "RCN * (1 - total_depreciation)", inputs: { rcn, dep_pct: Math.round(totalDep * 100) }, result: Math.round(depreciatedValue), unit: "SAR" });

  return {
    value: Math.round(depreciatedValue),
    rcn,
    physical_dep_pct: Math.round(physDepPct * 10000) / 100,
    functional_obs_pct: Math.round(funcObsPct * 10000) / 100,
    economic_obs_pct: Math.round(econObsPct * 10000) / 100,
    audit,
    errors,
  };
}

function calcMachineryPortfolio(assets: MachineryAsset[]): {
  total_value: number;
  total_rcn: number;
  asset_results: Array<{ asset_id: string; name: string; rcn: number; value: number }>;
  audit: AuditStep[];
  errors: string[];
} {
  const allAudit: AuditStep[] = [];
  const allErrors: string[] = [];
  const assetResults: Array<{ asset_id: string; name: string; rcn: number; value: number }> = [];
  let totalValue = 0;
  let totalRcn = 0;

  for (const asset of assets) {
    const result = calcMachineryAsset(asset);
    allAudit.push(...result.audit);
    allErrors.push(...result.errors);
    assetResults.push({ asset_id: asset.id, name: asset.asset_name_ar, rcn: result.rcn, value: result.value });
    totalValue += result.value;
    totalRcn += result.rcn;
  }

  allAudit.push({
    step: allAudit.length + 1,
    label_ar: "إجمالي قيمة المعدات والآلات",
    label_en: "Total Machinery & Equipment Value",
    formula: "Σ asset_values",
    inputs: { assets_count: assets.length, total_rcn: totalRcn },
    result: totalValue,
    unit: "SAR",
  });

  return { total_value: totalValue, total_rcn: totalRcn, asset_results: assetResults, audit: allAudit, errors: allErrors };
}

// Reconciliation (deterministic)
function calcReconciliation(
  marketValue: number | null, costValue: number | null, incomeValue: number | null,
  wMarket: number, wCost: number, wIncome: number
): { final_value: number; range_low: number; range_high: number; variance_pct: number; audit: AuditStep[]; errors: string[] } {
  const audit: AuditStep[] = [];
  const errors: string[] = [];
  let step = 1;

  const wSum = wMarket + wCost + wIncome;
  if (Math.abs(wSum - 1) > 0.01) errors.push(`Weights sum to ${(wSum*100).toFixed(0)}% not 100%`);

  const vals = [marketValue, costValue, incomeValue].filter((v): v is number => v != null && v > 0);
  let variance = 0;
  if (vals.length >= 2) {
    variance = ((Math.max(...vals) - Math.min(...vals)) / Math.min(...vals)) * 100;
    if (variance > 30) errors.push(`High method variance: ${variance.toFixed(1)}% (>30%)`);
  }

  let total = 0;
  if (marketValue && marketValue > 0) {
    const c = marketValue * wMarket;
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة المقارنة", label_en: "Market contribution", formula: "value * weight", inputs: { value: marketValue, weight_pct: Math.round(wMarket * 100) }, result: Math.round(c), unit: "SAR" });
  }
  if (costValue && costValue > 0) {
    const c = costValue * wCost;
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة التكلفة", label_en: "Cost contribution", formula: "value * weight", inputs: { value: costValue, weight_pct: Math.round(wCost * 100) }, result: Math.round(c), unit: "SAR" });
  }
  if (incomeValue && incomeValue > 0) {
    const c = incomeValue * wIncome;
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة الدخل", label_en: "Income contribution", formula: "value * weight", inputs: { value: incomeValue, weight_pct: Math.round(wIncome * 100) }, result: Math.round(c), unit: "SAR" });
  }

  const final = Math.round(total);
  audit.push({ step: step++, label_ar: "القيمة النهائية", label_en: "Final Value", formula: "Σ(value_i * weight_i)", inputs: { methods_used: vals.length }, result: final, unit: "SAR" });

  return { final_value: final, range_low: Math.round(final * 0.95), range_high: Math.round(final * 1.05), variance_pct: Math.round(variance * 100) / 100, audit, errors };
}

// ============================================================
// KNOWLEDGE BASE INTEGRATION
// ============================================================

let _knowledgeCache: string | null = null;

async function fetchValuationKnowledge(): Promise<string> {
  if (_knowledgeCache !== null) return _knowledgeCache;

  try {
    const db = supabaseAdmin();
    const { data: docs } = await db
      .from("raqeem_knowledge")
      .select("title_ar, content, category, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!docs || docs.length === 0) {
      _knowledgeCache = "";
      return "";
    }

    // Prioritize methodology, standards, and guidelines
    const searchTerms = ["تقييم", "معايير", "منهجية", "مقارنة", "تكلفة", "دخل", "ivs", "taqeem"];
    const scored = docs.map(doc => {
      const text = `${doc.title_ar || ""} ${doc.content || ""} ${doc.category || ""}`.toLowerCase();
      let score = doc.priority || 0;
      for (const term of searchTerms) {
        if (text.includes(term)) score += 10;
      }
      if (["standards", "methodology", "guidelines", "calculations"].includes(doc.category || "")) score += 15;
      return { ...doc, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const MAX_CHARS = 15000; // Smaller for valuation engine to keep prompts focused
    let totalChars = 0;
    const selected: string[] = [];

    for (const doc of scored) {
      if (doc.score <= 0) break;
      const chunk = `### ${doc.title_ar}\n${doc.content}`;
      if (totalChars + chunk.length > MAX_CHARS) {
        const remaining = MAX_CHARS - totalChars;
        if (remaining > 200) selected.push(chunk.substring(0, remaining) + "...");
        break;
      }
      selected.push(chunk);
      totalChars += chunk.length;
    }

    _knowledgeCache = selected.length > 0
      ? `\n\n══════ المراجع المهنية ══════\n${selected.join("\n\n---\n\n")}`
      : "";
    return _knowledgeCache;
  } catch (e) {
    console.error("Knowledge fetch error:", e);
    _knowledgeCache = "";
    return "";
  }
}

// ============================================================
// AI FUNCTIONS (limited to reasoning/reporting ONLY)
// ============================================================

async function callAI(systemPrompt: string, userPrompt: string, tools?: any[], toolChoice?: any) {
  // Enrich system prompt with knowledge base
  const knowledge = await fetchValuationKnowledge();
  const enrichedSystemPrompt = knowledge
    ? `${systemPrompt}\n\nاستند إلى المراجع المهنية التالية عند التحليل:${knowledge}`
    : systemPrompt;

  const body: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: enrichedSystemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`AI error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function extractToolResult(aiResponse: any): any {
  const tc = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call in AI response");
  return JSON.parse(tc.function.arguments);
}

// AI: Normalize data (classification only, no calculations)
async function aiNormalizeData(request: any, subject: any) {
  const tools = [{
    type: "function",
    function: {
      name: "normalize_property_data",
      description: "Classify and organize property data",
      parameters: {
        type: "object",
        properties: {
          property_type: { type: "string", enum: ["residential", "commercial", "land", "industrial", "mixed_use", "agricultural"] },
          property_subtype: { type: "string" },
          location: { type: "object", properties: { city_ar: { type: "string" }, city_en: { type: "string" }, district_ar: { type: "string" }, district_en: { type: "string" }, region_ar: { type: "string" }, region_en: { type: "string" } }, required: ["city_ar"] },
          areas: { type: "object", properties: { land_sqm: { type: "number" }, building_sqm: { type: "number" }, frontage_m: { type: "number" }, depth_m: { type: "number" } } },
          usage: { type: "object", properties: { current_use_ar: { type: "string" }, current_use_en: { type: "string" }, permitted_use_ar: { type: "string" }, permitted_use_en: { type: "string" }, zoning_ar: { type: "string" }, zoning_en: { type: "string" } } },
          building_details: { type: "object", properties: { year_built: { type: "number" }, condition: { type: "string" }, floors: { type: "number" }, units: { type: "number" } } },
          purpose_ar: { type: "string" }, purpose_en: { type: "string" },
          basis_of_value_ar: { type: "string" }, basis_of_value_en: { type: "string" },
          data_quality_score: { type: "number" },
          missing_data: { type: "array", items: { type: "object", properties: { field: { type: "string" }, importance: { type: "string", enum: ["critical", "important", "optional"] } } } },
        },
        required: ["property_type", "location", "areas", "data_quality_score"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    `أنت مصنّف بيانات عقارية. لا تقم بأي حسابات مالية. فقط نظّم وصنّف البيانات.`,
    `بيانات الطلب:\n${JSON.stringify(request, null, 2)}\n\nبيانات العقار:\n${JSON.stringify(subject, null, 2)}`,
    tools, { type: "function", function: { name: "normalize_property_data" } }
  );
  return extractToolResult(result);
}

// AI: Suggest adjustments (system validates/clamps)
async function aiSuggestAdjustments(normalizedData: any, comparables: any[]) {
  const tools = [{
    type: "function",
    function: {
      name: "suggest_adjustments",
      description: "Suggest adjustment percentages for comparables",
      parameters: {
        type: "object",
        properties: {
          comparables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                comparable_id: { type: "string" },
                location_adj: { type: "number" },
                size_adj: { type: "number" },
                age_adj: { type: "number" },
                condition_adj: { type: "number" },
                time_adj: { type: "number" },
                justification_ar: { type: "string" },
                justification_en: { type: "string" },
              },
              required: ["comparable_id", "location_adj", "size_adj", "age_adj", "condition_adj", "time_adj"],
            },
          },
          market_trend: { type: "string", enum: ["rising", "stable", "declining"] },
          avg_price_per_sqm: { type: "number" },
          market_overview_ar: { type: "string" },
          market_overview_en: { type: "string" },
        },
        required: ["comparables", "market_trend", "avg_price_per_sqm"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    `أنت محلل سوق عقاري. اقترح نسب تعديل للمقارنات. النطاقات المسموحة: الموقع ±20%، المساحة ±15%، العمر -30% إلى 0%، الحالة -20% إلى +10%، الوقت -10% إلى +15%.`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nالمقارنات:\n${JSON.stringify(comparables, null, 2)}`,
    tools, { type: "function", function: { name: "suggest_adjustments" } }
  );
  return extractToolResult(result);
}

// AI: Decide approaches
async function aiDecideApproaches(normalizedData: any, marketData: any) {
  const tools = [{
    type: "function",
    function: {
      name: "approach_decisions",
      description: "Decide which valuation approaches to use and suggest weights",
      parameters: {
        type: "object",
        properties: {
          use_market: { type: "boolean" },
          use_cost: { type: "boolean" },
          use_income: { type: "boolean" },
          weight_market: { type: "number" },
          weight_cost: { type: "number" },
          weight_income: { type: "number" },
          reason_market_ar: { type: "string" }, reason_market_en: { type: "string" },
          reason_cost_ar: { type: "string" }, reason_cost_en: { type: "string" },
          reason_income_ar: { type: "string" }, reason_income_en: { type: "string" },
          land_rate_per_sqm: { type: "number" },
          replacement_cost_per_sqm: { type: "number" },
          useful_life_years: { type: "number" },
          estimated_gross_income: { type: "number" },
          estimated_vacancy_rate: { type: "number" },
          estimated_expenses: { type: "number" },
          estimated_cap_rate: { type: "number" },
        },
        required: ["use_market", "weight_market", "weight_cost", "weight_income"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    `أنت خبير تقييم عقاري. حدد أي أساليب التقييم مناسبة واقترح أوزان الترجيح.
القواعد:
- أسلوب المقارنة إلزامي دائماً (use_market = true)
- مجموع الأوزان يجب أن يساوي 1
- الأوزان الافتراضية: مقارنة 60%، تكلفة 25%، دخل 15%`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nبيانات السوق:\n${JSON.stringify(marketData, null, 2)}`,
    tools, { type: "function", function: { name: "approach_decisions" } }
  );
  return extractToolResult(result);
}

// AI: HBU Analysis
async function aiHBU(normalizedData: any, marketOverview: string) {
  const tools = [{
    type: "function",
    function: {
      name: "hbu_analysis",
      description: "Qualitative HBU analysis",
      parameters: {
        type: "object",
        properties: {
          legally_permissible_ar: { type: "string" }, legally_permissible_en: { type: "string" },
          physically_possible_ar: { type: "string" }, physically_possible_en: { type: "string" },
          financially_feasible_ar: { type: "string" }, financially_feasible_en: { type: "string" },
          maximally_productive_ar: { type: "string" }, maximally_productive_en: { type: "string" },
          conclusion_ar: { type: "string" }, conclusion_en: { type: "string" },
          recommended_use_ar: { type: "string" }, recommended_use_en: { type: "string" },
        },
        required: ["conclusion_ar", "conclusion_en", "recommended_use_ar"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    `أنت خبير HBU. قدّم تحليلاً نوعياً فقط. لا تقم بأي حسابات مالية.`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nنظرة السوق: ${marketOverview}`,
    tools, { type: "function", function: { name: "hbu_analysis" } }
  );
  return extractToolResult(result);
}

// AI: Generate report text
async function aiGenerateReport(normalizedData: any, calculationResults: any, hbu: any, request: any, valuationType: string = "real_estate") {
  const extraFields = valuationType === "machinery" || valuationType === "mixed" ? {
    machinery_section_ar: { type: "string", description: "قسم تقييم المعدات والآلات" },
    machinery_section_en: { type: "string", description: "Machinery & Equipment section" },
    combined_conclusion_ar: { type: "string", description: "الخلاصة المجمعة (عقار + معدات)" },
    combined_conclusion_en: { type: "string", description: "Combined conclusion" },
  } : {};

  const tools = [{
    type: "function",
    function: {
      name: "generate_report",
      description: "Write report narrative using pre-calculated values",
      parameters: {
        type: "object",
        properties: {
          executive_summary_ar: { type: "string" }, executive_summary_en: { type: "string" },
          purpose_ar: { type: "string" }, purpose_en: { type: "string" },
          scope_of_work_ar: { type: "string" }, scope_of_work_en: { type: "string" },
          property_description_ar: { type: "string" }, property_description_en: { type: "string" },
          legal_description_ar: { type: "string" }, legal_description_en: { type: "string" },
          market_analysis_ar: { type: "string" }, market_analysis_en: { type: "string" },
          hbu_analysis_ar: { type: "string" }, hbu_analysis_en: { type: "string" },
          valuation_methodology_ar: { type: "string" }, valuation_methodology_en: { type: "string" },
          calculations_ar: { type: "string" }, calculations_en: { type: "string" },
          reconciliation_ar: { type: "string" }, reconciliation_en: { type: "string" },
          value_conclusion_ar: { type: "string" }, value_conclusion_en: { type: "string" },
          assumptions_ar: { type: "string" }, assumptions_en: { type: "string" },
          special_assumptions_ar: { type: "string" }, special_assumptions_en: { type: "string" },
          limiting_conditions_ar: { type: "string" }, limiting_conditions_en: { type: "string" },
          compliance_statement_ar: { type: "string" }, compliance_statement_en: { type: "string" },
          final_value_text_ar: { type: "string" },
          final_value_text_en: { type: "string" },
          ...extraFields,
        },
        required: ["executive_summary_ar", "purpose_ar", "property_description_ar", "market_analysis_ar", "valuation_methodology_ar", "value_conclusion_ar", "assumptions_ar", "limiting_conditions_ar", "compliance_statement_ar", "final_value_text_ar"],
        additionalProperties: false,
      },
    },
  }];

  const standardsNote = valuationType === "real_estate"
    ? "المعايير: IVS 2025 + معايير تقييم العقارات - الهيئة السعودية للمقيّمين المعتمدين (تقييم)"
    : valuationType === "machinery"
    ? "المعايير: IVS 2025 + معايير تقييم الآلات والمعدات - الهيئة السعودية للمقيّمين المعتمدين (تقييم)"
    : "المعايير: IVS 2025 + معايير تقييم العقارات ومعايير تقييم الآلات والمعدات - تقييم";

  const typeInstruction = valuationType === "mixed"
    ? `هذا تقييم مختلط (عقار + معدات). يجب أن يتضمن التقرير:
    القسم 1: تقييم العقار
    القسم 2: تقييم المعدات والآلات
    القسم 3: الخلاصة المجمعة النهائية
    اكتب machinery_section_ar/en وcombined_conclusion_ar/en.`
    : "";

  const result = await callAI(
    `أنت كاتب تقارير تقييم. اكتب النص الروائي للتقرير. لا تغيّر أي رقم.
${standardsNote}
${typeInstruction}

كتلة التوقيع الإلزامية:
احمد المالكي / Ahmed Al-Malki
مقيّم معتمد - عقارات / Certified Valuer – Real Estate
رقم الترخيص: [XXXX]
مقيّم معتمد - آلات ومعدات / Certified Valuer – Machinery & Equipment
رقم الترخيص: [XXXX]`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nنتائج الحسابات:\n${JSON.stringify(calculationResults, null, 2)}\n\nتحليل HBU:\n${JSON.stringify(hbu, null, 2)}\n\nنوع التقييم: ${valuationType}\n\nبيانات الطلب:\n${JSON.stringify({ purpose: request.purpose, basis: request.basis_of_value }, null, 2)}`,
    tools, { type: "function", function: { name: "generate_report" } }
  );
  return extractToolResult(result);
}

// ============================================================
// COMPLIANCE (deterministic)
// ============================================================
function runComplianceChecks(reportContent: any, reconciliation: any, normalizedData: any, calcErrors: string[], valuationType: string = "real_estate") {
  const checks: Array<{ code: string; name_ar: string; name_en: string; category: string; passed: boolean; mandatory: boolean; notes?: string }> = [];
  const add = (code: string, ar: string, en: string, cat: string, passed: boolean, mandatory = true, notes?: string) => {
    checks.push({ code, name_ar: ar, name_en: en, category: cat, passed, mandatory, notes });
  };

  // IVS Structure
  add("IVS_EXEC_SUMMARY", "الملخص التنفيذي", "Executive Summary", "ivs_structure", !!reportContent.executive_summary_ar);
  add("IVS_PURPOSE", "غرض التقييم", "Valuation Purpose", "ivs_structure", !!reportContent.purpose_ar);
  add("IVS_SCOPE", "نطاق العمل", "Scope of Work", "ivs_structure", !!reportContent.scope_of_work_ar);
  add("IVS_PROPERTY_DESC", "وصف العقار", "Property Description", "ivs_structure", !!reportContent.property_description_ar);
  add("IVS_MARKET", "تحليل السوق", "Market Analysis", "ivs_structure", !!reportContent.market_analysis_ar);
  add("IVS_HBU", "الاستخدام الأعلى والأفضل", "HBU Analysis", "ivs_structure", !!reportContent.hbu_analysis_ar);
  add("IVS_METHODOLOGY", "منهجية التقييم", "Valuation Methodology", "ivs_structure", !!reportContent.valuation_methodology_ar);
  add("IVS_CONCLUSION", "الخلاصة والقيمة", "Value Conclusion", "ivs_structure", !!reportContent.value_conclusion_ar);
  add("IVS_ASSUMPTIONS", "الافتراضات", "Assumptions", "ivs_structure", !!reportContent.assumptions_ar);
  add("IVS_LIMITING", "القيود", "Limiting Conditions", "ivs_structure", !!reportContent.limiting_conditions_ar);
  add("IVS_COMPLIANCE", "بيان الامتثال", "Compliance Statement", "ivs_structure", !!reportContent.compliance_statement_ar);

  // Value checks
  add("VAL_FINAL", "القيمة النهائية", "Final Value", "valuation", reconciliation.final_value > 0);
  add("VAL_TEXT", "القيمة كتابةً", "Value in Words", "valuation", !!reconciliation.final_value_text_ar);
  add("VAL_REASONING", "تبرير القيمة", "Reasoning", "valuation", !!reconciliation.reasoning_ar);

  // Calculation validation
  add("CALC_NO_ERRORS", "حسابات بدون أخطاء", "No Calculation Errors", "calculation", calcErrors.length === 0, true, calcErrors.join("; "));
  add("CALC_ADJ_RANGE", "تعديلات ضمن النطاق", "Adjustments in Range", "calculation", !calcErrors.some(e => e.includes("clamped")));
  add("CALC_VARIANCE", "تباين الطرق <30%", "Method Variance <30%", "calculation", !calcErrors.some(e => e.includes("variance")), false);

  // Data
  add("DATA_AREA", "المساحات", "Areas", "data", normalizedData.areas?.land_sqm > 0);
  add("DATA_LOCATION", "الموقع", "Location", "data", !!normalizedData.location?.city_ar);
  add("DATA_TYPE", "نوع العقار", "Property Type", "data", !!normalizedData.property_type);

  // Type-specific compliance
  if (valuationType === "machinery" || valuationType === "mixed") {
    add("MACH_SECTION", "قسم المعدات والآلات", "Machinery Section", "machinery_compliance", !!reportContent.machinery_section_ar, valuationType === "machinery");
    add("MACH_STANDARDS", "معايير تقييم الآلات", "Machinery Standards", "machinery_compliance", !!reportContent.compliance_statement_ar, true);
  }
  if (valuationType === "mixed") {
    add("MIXED_COMBINED", "الخلاصة المجمعة", "Combined Conclusion", "mixed_compliance", !!reportContent.combined_conclusion_ar, true);
  }

  const mandatoryFailed = checks.filter(c => c.mandatory && !c.passed);
  return { checks, total: checks.length, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, mandatory_failures: mandatoryFailed.length, ready_for_issuance: mandatoryFailed.length === 0 };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { action, assignment_id, request_id } = await req.json();
    const sb = supabaseAdmin();

    if (action === "run_full_valuation") {
      const { data: assignment, error: aErr } = await sb.from("valuation_assignments").select("*").eq("id", assignment_id).single();
      if (aErr || !assignment) throw new Error("Assignment not found");

      const valuationType = (assignment as any).valuation_type || "real_estate";

      const { data: subjects } = await sb.from("subjects").select("*").eq("assignment_id", assignment_id);
      const subject = subjects?.[0] || {};

      let request = assignment;
      if (request_id) {
        const { data: req } = await sb.from("valuation_requests").select("*").eq("id", request_id).single();
        if (req) request = { ...assignment, ...req };
      }

      // Fetch inspection analysis data
      const { data: inspectionAnalysis } = await sb.from("inspection_analysis")
        .select("*")
        .eq("assignment_id", assignment_id)
        .eq("status", "completed")
        .maybeSingle();

      // Fetch comparables from DB
      const { data: assignmentComps } = await sb.from("assignment_comparables").select("*, comparables(*)").eq("assignment_id", assignment_id);
      const { data: allComps } = await sb.from("comparables").select("*").eq("property_type", subject.property_type || "residential").limit(10);

      const rawComps = assignmentComps?.length ? assignmentComps.map((ac: any) => ac.comparables).filter(Boolean) : (allComps || []);

      const allAudit: AuditStep[] = [];
      const allCalcErrors: string[] = [];

      // ── Enrich subject with inspection data ──
      if (inspectionAnalysis) {
        if (!subject.building_condition) subject.building_condition = inspectionAnalysis.condition_rating;
        (subject as any).inspection_condition_score = inspectionAnalysis.condition_score;
        (subject as any).inspection_quality_score = inspectionAnalysis.quality_score;
        (subject as any).inspection_finishing_level = inspectionAnalysis.finishing_level;
        (subject as any).inspection_defects = inspectionAnalysis.visible_defects;
        (subject as any).inspection_risk_flags = inspectionAnalysis.risk_flags;
      }

      // ========================================
      // REAL ESTATE VALUATION
      // ========================================
      let realEstateValue = 0;
      let realEstateApproaches: any[] = [];
      let reconResult: any = null;
      let normalizedData: any = {};
      let hbuResult: any = {};
      let aiAdjustments: any = {};

      if (valuationType === "real_estate" || valuationType === "mixed") {
        console.log("Running real estate valuation pipeline...");

        // Step 1: AI classifies data
        normalizedData = await aiNormalizeData(request, subject);

        // Step 2: AI suggests adjustments
        aiAdjustments = await aiSuggestAdjustments(normalizedData, rawComps);

        // Step 3: AI HBU
        hbuResult = await aiHBU(normalizedData, aiAdjustments.market_overview_ar || "");

        // Step 4: AI decides approaches
        const decisions = await aiDecideApproaches(normalizedData, aiAdjustments);
        decisions.use_market = true;
        let wM = decisions.weight_market || 0.60;
        let wC = decisions.weight_cost || 0.25;
        let wI = decisions.weight_income || 0.15;
        const wTotal = wM + wC + wI;
        if (Math.abs(wTotal - 1) > 0.01) { wM /= wTotal; wC /= wTotal; wI /= wTotal; }

        // Step 5: Deterministic calculations
        const subjectArea = normalizedData.areas?.land_sqm || subject.land_area || 500;
        const marketComps = (aiAdjustments.comparables || []).map((c: any) => ({
          id: c.comparable_id || "unknown",
          price: rawComps.find((rc: any) => rc.id === c.comparable_id)?.price || aiAdjustments.avg_price_per_sqm * subjectArea,
          area: rawComps.find((rc: any) => rc.id === c.comparable_id)?.land_area || subjectArea,
          adjustments: {
            location: clampAdjustment("location", c.location_adj || 0),
            size: clampAdjustment("size", c.size_adj || 0),
            age: clampAdjustment("age", c.age_adj || 0),
            condition: clampAdjustment("condition", inspectionAnalysis?.condition_adjustment_pct != null
              ? Number(inspectionAnalysis.condition_adjustment_pct)
              : (c.condition_adj || 0)),
            time: clampAdjustment("time", c.time_adj || 0),
          },
        }));

        if (marketComps.length === 0 && aiAdjustments.avg_price_per_sqm) {
          marketComps.push({
            id: "market-avg", price: aiAdjustments.avg_price_per_sqm * subjectArea, area: subjectArea,
            adjustments: { location: 0, size: 0, age: 0, condition: 0, time: 0 },
          });
        }

        const marketResult = calcMarketApproach(marketComps, subjectArea);
        allAudit.push(...marketResult.audit);
        allCalcErrors.push(...marketResult.errors);

        realEstateApproaches.push({
          approach: "sales_comparison", is_used: true, is_primary: true,
          concluded_value: marketResult.value, weight: wM,
          reason_for_use_ar: decisions.reason_market_ar || "أسلوب المقارنة بالمبيعات إلزامي",
          reason_for_use_en: decisions.reason_market_en || "Sales comparison is mandatory",
          calculations: marketResult.audit,
        });

        // Cost Approach
        let costValue: number | null = null;
        if (decisions.use_cost && normalizedData.areas?.building_sqm > 0) {
          const costResult = calcCostApproach(
            normalizedData.areas.land_sqm || subjectArea,
            decisions.land_rate_per_sqm || aiAdjustments.avg_price_per_sqm || 2000,
            normalizedData.areas.building_sqm || 0,
            decisions.replacement_cost_per_sqm || 3000,
            normalizedData.building_details?.year_built ? (new Date().getFullYear() - normalizedData.building_details.year_built) : 10,
            decisions.useful_life_years || 45,
            inspectionAnalysis?.functional_obsolescence_pct != null ? Number(inspectionAnalysis.functional_obsolescence_pct) : undefined,
            inspectionAnalysis?.external_obsolescence_pct != null ? Number(inspectionAnalysis.external_obsolescence_pct) : undefined
          );
          costValue = costResult.value;
          allAudit.push(...costResult.audit);
          allCalcErrors.push(...costResult.errors);
          realEstateApproaches.push({ approach: "cost", is_used: true, is_primary: false, concluded_value: costResult.value, weight: wC, reason_for_use_ar: decisions.reason_cost_ar || "", reason_for_use_en: decisions.reason_cost_en || "", calculations: costResult.audit });
        } else {
          realEstateApproaches.push({ approach: "cost", is_used: false, is_primary: false, concluded_value: 0, weight: 0, reason_for_rejection_ar: decisions.reason_cost_ar || "", calculations: [] });
          wM += wC; wC = 0;
        }

        // Income Approach
        let incomeValue: number | null = null;
        if (decisions.use_income && (subject.annual_income || decisions.estimated_gross_income)) {
          const incResult = calcIncomeApproach(
            decisions.estimated_gross_income || subject.annual_income || 0,
            decisions.estimated_vacancy_rate || 0.05,
            decisions.estimated_expenses || 0,
            decisions.estimated_cap_rate || 0.08
          );
          incomeValue = incResult.value;
          allAudit.push(...incResult.audit);
          allCalcErrors.push(...incResult.errors);
          realEstateApproaches.push({ approach: "income", is_used: true, is_primary: false, concluded_value: incResult.value, weight: wI, reason_for_use_ar: decisions.reason_income_ar || "", calculations: incResult.audit });
        } else {
          realEstateApproaches.push({ approach: "income", is_used: false, is_primary: false, concluded_value: 0, weight: 0, reason_for_rejection_ar: decisions.reason_income_ar || "", calculations: [] });
          wM += wI; wI = 0;
        }

        const finalWSum = wM + wC + wI;
        if (finalWSum > 0) { wM /= finalWSum; wC /= finalWSum; wI /= finalWSum; }

        reconResult = calcReconciliation(marketResult.value, costValue, incomeValue, wM, wC, wI);
        allAudit.push(...reconResult.audit);
        allCalcErrors.push(...reconResult.errors);
        realEstateValue = reconResult.final_value;
      }

      // ========================================
      // MACHINERY VALUATION
      // ========================================
      let machineryValue = 0;
      let machineryResults: any = null;

      if (valuationType === "machinery" || valuationType === "mixed") {
        console.log("Running machinery valuation pipeline...");

        const { data: machinerySubjects } = await sb.from("subjects_machinery").select("*").eq("assignment_id", assignment_id).order("sort_order");

        if (machinerySubjects && machinerySubjects.length > 0) {
          const assets: MachineryAsset[] = machinerySubjects.map((m: any) => ({
            id: m.id,
            asset_name_ar: m.asset_name_ar,
            replacement_cost: m.replacement_cost || m.original_cost || 0,
            year_manufactured: m.year_manufactured || new Date().getFullYear() - 5,
            total_useful_life: m.total_useful_life || 15,
            remaining_useful_life: m.remaining_useful_life,
            condition: m.condition || "good",
            condition_score: m.condition_score,
            is_operational: m.is_operational !== false,
            depreciation_method: m.depreciation_method || "straight_line",
          }));

          machineryResults = calcMachineryPortfolio(assets);
          machineryValue = machineryResults.total_value;
          allAudit.push(...machineryResults.audit);
          allCalcErrors.push(...machineryResults.errors);

          // Save individual machinery valuations
          await sb.from("machinery_valuations").delete().eq("assignment_id", assignment_id);
          for (const ar of machineryResults.asset_results) {
            await sb.from("machinery_valuations").insert({
              assignment_id,
              subject_machinery_id: ar.asset_id,
              approach: "cost",
              replacement_cost_new: ar.rcn,
              final_value: ar.value,
              audit_trail: machineryResults.audit.filter((a: any) => a.label_ar.includes(ar.name)),
            });
          }
        }
      }

      // ========================================
      // COMBINED FINAL VALUE
      // ========================================
      let finalValue = 0;
      if (valuationType === "real_estate") {
        finalValue = realEstateValue;
      } else if (valuationType === "machinery") {
        finalValue = machineryValue;
        // For machinery-only, create a simple reconciliation
        if (!reconResult) {
          reconResult = { final_value: machineryValue, range_low: Math.round(machineryValue * 0.95), range_high: Math.round(machineryValue * 1.05), variance_pct: 0, audit: [], errors: [] };
        }
      } else {
        // Mixed: combine
        finalValue = realEstateValue + machineryValue;
        if (reconResult) {
          reconResult.final_value = finalValue;
          reconResult.range_low = Math.round(finalValue * 0.95);
          reconResult.range_high = Math.round(finalValue * 1.05);
        } else {
          reconResult = { final_value: finalValue, range_low: Math.round(finalValue * 0.95), range_high: Math.round(finalValue * 1.05), variance_pct: 0, audit: [], errors: [] };
        }
        allAudit.push({
          step: allAudit.length + 1,
          label_ar: "القيمة المجمعة (عقار + معدات)",
          label_en: "Combined Value (Real Estate + Machinery)",
          formula: "real_estate_value + machinery_value",
          inputs: { real_estate: realEstateValue, machinery: machineryValue },
          result: finalValue,
          unit: "SAR",
        });
      }

      // ── AI Report Narrative ──
      console.log("Generating report narrative...");
      const calculationSummary = {
        valuation_type: valuationType,
        final_value: finalValue,
        real_estate_value: realEstateValue,
        machinery_value: machineryValue,
        range_low: reconResult.range_low,
        range_high: reconResult.range_high,
        variance_pct: reconResult.variance_pct,
        market_value: realEstateApproaches.find((a: any) => a.approach === "sales_comparison")?.concluded_value || 0,
        cost_value: realEstateApproaches.find((a: any) => a.approach === "cost")?.concluded_value || 0,
        income_value: realEstateApproaches.find((a: any) => a.approach === "income")?.concluded_value || 0,
        approaches: realEstateApproaches,
        hbu: hbuResult,
        market_overview: aiAdjustments.market_overview_ar,
        machinery_results: machineryResults,
        inspection_analysis: inspectionAnalysis ? {
          condition_rating: inspectionAnalysis.condition_rating,
          condition_score: inspectionAnalysis.condition_score,
          quality_score: inspectionAnalysis.quality_score,
        } : null,
      };
      const reportContent = await aiGenerateReport(normalizedData, calculationSummary, hbuResult, request, valuationType);

      // ── Compliance ──
      const compliance = runComplianceChecks(
        reportContent,
        { ...reconResult, final_value_text_ar: reportContent.final_value_text_ar, reasoning_ar: reportContent.reconciliation_ar || reportContent.value_conclusion_ar },
        normalizedData,
        allCalcErrors,
        valuationType
      );

      // ── SAVE TO DB ──
      await sb.from("valuation_methods").delete().eq("assignment_id", assignment_id);
      await sb.from("compliance_checks").delete().eq("assignment_id", assignment_id);

      for (const approach of realEstateApproaches) {
        const { data: method } = await sb.from("valuation_methods").insert({
          assignment_id,
          approach: approach.approach,
          is_used: approach.is_used,
          is_primary: approach.is_primary || false,
          weight_in_reconciliation: approach.weight || 0,
          concluded_value: approach.concluded_value || 0,
          reason_for_use_ar: approach.reason_for_use_ar || "",
          reason_for_use_en: approach.reason_for_use_en || "",
          reason_for_rejection_ar: approach.reason_for_rejection_ar || "",
          reason_for_rejection_en: approach.reason_for_rejection_en || "",
          currency: "SAR",
        }).select().single();

        if (method && approach.calculations?.length) {
          for (const calc of approach.calculations) {
            await sb.from("valuation_calculations").insert({
              method_id: method.id, step_number: calc.step, label_ar: calc.label_ar, label_en: calc.label_en || "",
              formula: calc.formula || "", input_data: calc.inputs || {}, result_value: calc.result, result_unit: calc.unit || "SAR",
              explanation_ar: "", explanation_en: "",
            });
          }
        }
      }

      await sb.from("reconciliation_results").upsert({
        assignment_id,
        final_value: finalValue,
        final_value_text_ar: reportContent.final_value_text_ar || "",
        final_value_text_en: reportContent.final_value_text_en || "",
        currency: "SAR",
        confidence_level: reconResult.variance_pct < 10 ? "high" : reconResult.variance_pct < 20 ? "moderate" : "low",
        value_range_low: reconResult.range_low,
        value_range_high: reconResult.range_high,
        reasoning_ar: reportContent.reconciliation_ar || reportContent.value_conclusion_ar || "",
        reasoning_en: reportContent.reconciliation_en || reportContent.value_conclusion_en || "",
        highest_best_use_ar: hbuResult.conclusion_ar || "",
        highest_best_use_en: hbuResult.conclusion_en || "",
      }, { onConflict: "assignment_id" });

      for (const check of compliance.checks) {
        await sb.from("compliance_checks").insert({
          assignment_id, check_code: check.code, check_name_ar: check.name_ar, check_name_en: check.name_en,
          category: check.category, is_passed: check.passed, is_mandatory: check.mandatory,
          auto_checked: true, checked_at: new Date().toISOString(), notes: check.notes || null,
        });
      }

      const { data: report } = await sb.from("reports").insert({
        assignment_id,
        title_ar: `تقرير تقييم - ${normalizedData.location?.city_ar || ""}`,
        title_en: `Valuation Report - ${normalizedData.location?.city_en || ""}`,
        language: "bilingual",
        report_type: "full_narrative",
        content_ar: { ...reportContent, valuation_type: valuationType, machinery_value: machineryValue, real_estate_value: realEstateValue },
        content_en: reportContent,
        cover_page: {
          title_ar: valuationType === "machinery" ? "تقرير تقييم آلات ومعدات" : valuationType === "mixed" ? "تقرير تقييم عقار وآلات ومعدات" : "تقرير تقييم عقار",
          title_en: valuationType === "machinery" ? "Machinery & Equipment Valuation Report" : valuationType === "mixed" ? "Property & Machinery Valuation Report" : "Property Valuation Report",
          reference_number: assignment.reference_number,
          valuation_date: assignment.valuation_date || new Date().toISOString().split("T")[0],
          report_date: new Date().toISOString().split("T")[0],
          final_value: finalValue,
          real_estate_value: realEstateValue,
          machinery_value: machineryValue,
          valuation_type: valuationType,
          currency: "SAR",
        },
        status: compliance.ready_for_issuance ? "draft" : "needs_review",
        generated_by: "calculation_engine_v2",
        version: 1,
      }).select().single();

      // Audit log
      await sb.from("audit_logs").insert({
        table_name: "valuation_assignments", action: "update", record_id: assignment_id, assignment_id,
        description: `Calculation engine v2: ${valuationType} valuation completed`,
        new_data: {
          engine_version: "v2_deterministic", valuation_type: valuationType, final_value: finalValue,
          real_estate_value: realEstateValue, machinery_value: machineryValue,
          compliance_score: `${compliance.passed}/${compliance.total}`,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        report_id: report?.id,
        final_value: finalValue,
        real_estate_value: realEstateValue,
        machinery_value: machineryValue,
        valuation_type: valuationType,
        final_value_text_ar: reportContent.final_value_text_ar || "",
        confidence_level: reconResult.variance_pct < 10 ? "high" : reconResult.variance_pct < 20 ? "moderate" : "low",
        compliance: { ready: compliance.ready_for_issuance, passed: compliance.passed, total: compliance.total, mandatory_failures: compliance.mandatory_failures },
        pipeline_steps: {
          normalized_data: normalizedData,
          market_data: aiAdjustments,
          hbu: hbuResult,
          valuation: { approaches: realEstateApproaches },
          reconciliation: reconResult,
          machinery: machineryResults,
          inspection_analysis: inspectionAnalysis ? { condition_rating: inspectionAnalysis.condition_rating, condition_score: inspectionAnalysis.condition_score } : null,
        },
        audit_trail: allAudit,
        calculation_errors: allCalcErrors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "compliance_check") {
      const { data: assignment } = await sb.from("valuation_assignments").select("valuation_type").eq("id", assignment_id).single();
      const vType = (assignment as any)?.valuation_type || "real_estate";
      const { data: report } = await sb.from("reports").select("*").eq("assignment_id", assignment_id).order("version", { ascending: false }).limit(1).single();
      const { data: recon } = await sb.from("reconciliation_results").select("*").eq("assignment_id", assignment_id).single();
      const { data: subjects } = await sb.from("subjects").select("*").eq("assignment_id", assignment_id);
      if (!report || !recon) throw new Error("Report or reconciliation data not found");
      const compliance = runComplianceChecks(report.content_ar || {}, recon, subjects?.[0] || {}, [], vType);
      return new Response(JSON.stringify(compliance), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("valuation-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
