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
// AI FUNCTIONS (limited to reasoning/reporting ONLY)
// ============================================================

async function callAI(systemPrompt: string, userPrompt: string, tools?: any[], toolChoice?: any) {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
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
                location_adj: { type: "number", description: "Location adjustment -0.20 to +0.20" },
                size_adj: { type: "number", description: "Size adjustment -0.15 to +0.15" },
                age_adj: { type: "number", description: "Age adjustment -0.30 to 0" },
                condition_adj: { type: "number", description: "Condition adjustment -0.20 to +0.10" },
                time_adj: { type: "number", description: "Time adjustment -0.10 to +0.15" },
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
    `أنت محلل سوق عقاري. اقترح نسب تعديل للمقارنات. النطاقات المسموحة: الموقع ±20%، المساحة ±15%، العمر -30% إلى 0%، الحالة -20% إلى +10%، الوقت -10% إلى +15%. لا تقم بأي حسابات مالية - فقط اقترح النسب.`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nالمقارنات:\n${JSON.stringify(comparables, null, 2)}`,
    tools, { type: "function", function: { name: "suggest_adjustments" } }
  );
  return extractToolResult(result);
}

// AI: Decide which approaches to use and suggest weights
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
          weight_market: { type: "number", description: "0-1, all weights must sum to 1" },
          weight_cost: { type: "number" },
          weight_income: { type: "number" },
          reason_market_ar: { type: "string" }, reason_market_en: { type: "string" },
          reason_cost_ar: { type: "string" }, reason_cost_en: { type: "string" },
          reason_income_ar: { type: "string" }, reason_income_en: { type: "string" },
          // Cost approach inputs (AI estimates if not available)
          land_rate_per_sqm: { type: "number", description: "Estimated land rate SAR/sqm" },
          replacement_cost_per_sqm: { type: "number", description: "Estimated building replacement cost SAR/sqm" },
          useful_life_years: { type: "number", description: "Estimated useful life 30-60 years" },
          // Income approach inputs
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
    `أنت خبير تقييم عقاري. حدد أي أساليب التقييم مناسبة واقترح أوزان الترجيح. لا تقم بأي حسابات - فقط حدد المنهجية والمدخلات.
القواعد:
- أسلوب المقارنة إلزامي دائماً (use_market = true)
- مجموع الأوزان يجب أن يساوي 1
- الأوزان الافتراضية: مقارنة 60%، تكلفة 25%، دخل 15%`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nبيانات السوق:\n${JSON.stringify(marketData, null, 2)}`,
    tools, { type: "function", function: { name: "approach_decisions" } }
  );
  return extractToolResult(result);
}

// AI: HBU Analysis (qualitative only)
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

// AI: Generate report text (narrative only, uses pre-calculated numbers)
async function aiGenerateReport(normalizedData: any, calculationResults: any, hbu: any, request: any) {
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
          final_value_text_ar: { type: "string", description: "القيمة النهائية كتابةً بالعربي" },
          final_value_text_en: { type: "string", description: "Final value in words" },
        },
        required: ["executive_summary_ar", "purpose_ar", "property_description_ar", "market_analysis_ar", "valuation_methodology_ar", "value_conclusion_ar", "assumptions_ar", "limiting_conditions_ar", "compliance_statement_ar", "final_value_text_ar"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    `أنت كاتب تقارير تقييم. اكتب النص الروائي للتقرير باستخدام الأرقام المحسوبة مسبقاً. لا تغيّر أي رقم. استخدم القيم المقدمة كما هي.`,
    `العقار:\n${JSON.stringify(normalizedData, null, 2)}\n\nنتائج الحسابات:\n${JSON.stringify(calculationResults, null, 2)}\n\nتحليل HBU:\n${JSON.stringify(hbu, null, 2)}\n\nبيانات الطلب:\n${JSON.stringify({ purpose: request.purpose, basis: request.basis_of_value }, null, 2)}`,
    tools, { type: "function", function: { name: "generate_report" } }
  );
  return extractToolResult(result);
}

// ============================================================
// COMPLIANCE (deterministic)
// ============================================================
function runComplianceChecks(reportContent: any, reconciliation: any, normalizedData: any, calcErrors: string[]) {
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

      // ── STEP 0.5: Enrich subject with inspection data ──
      if (inspectionAnalysis) {
        console.log("Enriching subject with inspection analysis data...");
        if (!subject.building_condition) subject.building_condition = inspectionAnalysis.condition_rating;
        (subject as any).inspection_condition_score = inspectionAnalysis.condition_score;
        (subject as any).inspection_quality_score = inspectionAnalysis.quality_score;
        (subject as any).inspection_finishing_level = inspectionAnalysis.finishing_level;
        (subject as any).inspection_defects = inspectionAnalysis.visible_defects;
        (subject as any).inspection_risk_flags = inspectionAnalysis.risk_flags;
      }

      // ── STEP 1: AI classifies data (no calculations) ──
      console.log("Step 1: AI data classification...");
      const normalizedData = await aiNormalizeData(request, subject);

      // ── STEP 2: AI suggests adjustments (system validates) ──
      console.log("Step 2: AI adjustment suggestions...");
      const aiAdjustments = await aiSuggestAdjustments(normalizedData, rawComps);

      // ── STEP 3: AI HBU (qualitative) ──
      console.log("Step 3: AI HBU analysis...");
      const hbuResult = await aiHBU(normalizedData, aiAdjustments.market_overview_ar || "");

      // ── STEP 4: AI decides approaches + inputs ──
      console.log("Step 4: AI approach decisions...");
      const decisions = await aiDecideApproaches(normalizedData, aiAdjustments);

      // Enforce: market always used
      decisions.use_market = true;
      // Enforce: weights sum to 1
      let wM = decisions.weight_market || 0.60;
      let wC = decisions.weight_cost || 0.25;
      let wI = decisions.weight_income || 0.15;
      const wTotal = wM + wC + wI;
      if (Math.abs(wTotal - 1) > 0.01) { wM /= wTotal; wC /= wTotal; wI /= wTotal; }

      // ── STEP 5: DETERMINISTIC CALCULATIONS ──
      console.log("Step 5: Deterministic calculations...");

      // Market Approach (mandatory)
      const subjectArea = normalizedData.areas?.land_sqm || subject.land_area || 500;
      const marketComps = (aiAdjustments.comparables || []).map((c: any) => ({
        id: c.comparable_id || "unknown",
        price: rawComps.find((rc: any) => rc.id === c.comparable_id)?.price || aiAdjustments.avg_price_per_sqm * subjectArea,
        area: rawComps.find((rc: any) => rc.id === c.comparable_id)?.land_area || subjectArea,
        adjustments: {
          location: clampAdjustment("location", c.location_adj || 0),
          size: clampAdjustment("size", c.size_adj || 0),
          age: clampAdjustment("age", c.age_adj || 0),
          // Use inspection-derived condition adjustment if available, otherwise AI suggestion
          condition: clampAdjustment("condition", inspectionAnalysis?.condition_adjustment_pct != null
            ? Number(inspectionAnalysis.condition_adjustment_pct)
            : (c.condition_adj || 0)),
          time: clampAdjustment("time", c.time_adj || 0),
        },
      }));

      // Fallback if no comparables: use avg price
      if (marketComps.length === 0 && aiAdjustments.avg_price_per_sqm) {
        marketComps.push({
          id: "market-avg",
          price: aiAdjustments.avg_price_per_sqm * subjectArea,
          area: subjectArea,
          adjustments: { location: 0, size: 0, age: 0, condition: 0, time: 0 },
        });
      }

      const marketResult = calcMarketApproach(marketComps, subjectArea);
      allAudit.push(...marketResult.audit);
      allCalcErrors.push(...marketResult.errors);

      const approaches: any[] = [{
        approach: "sales_comparison",
        is_used: true,
        is_primary: true,
        concluded_value: marketResult.value,
        weight: wM,
        reason_for_use_ar: decisions.reason_market_ar || "أسلوب المقارنة بالمبيعات إلزامي",
        reason_for_use_en: decisions.reason_market_en || "Sales comparison is mandatory",
        calculations: marketResult.audit,
      }];

      // Cost Approach — use inspection analysis for depreciation if available
      let costValue: number | null = null;
      const inspPhysDep = inspectionAnalysis?.physical_depreciation_pct ?? null;
      const inspFuncObs = inspectionAnalysis?.functional_obsolescence_pct ?? null;
      const inspExtObs = inspectionAnalysis?.external_obsolescence_pct ?? null;

      if (decisions.use_cost && normalizedData.areas?.building_sqm > 0) {
        const costResult = calcCostApproach(
          normalizedData.areas.land_sqm || subjectArea,
          decisions.land_rate_per_sqm || aiAdjustments.avg_price_per_sqm || 2000,
          normalizedData.areas.building_sqm || 0,
          decisions.replacement_cost_per_sqm || 3000,
          normalizedData.building_details?.year_built ? (new Date().getFullYear() - normalizedData.building_details.year_built) : 10,
          decisions.useful_life_years || 45,
          inspFuncObs != null ? Number(inspFuncObs) : undefined,
          inspExtObs != null ? Number(inspExtObs) : undefined
        );
        costValue = costResult.value;
        allAudit.push(...costResult.audit);
        allCalcErrors.push(...costResult.errors);
        approaches.push({
          approach: "cost",
          is_used: true,
          is_primary: false,
          concluded_value: costResult.value,
          weight: wC,
          reason_for_use_ar: decisions.reason_cost_ar || "مناسب للعقارات المبنية",
          reason_for_use_en: decisions.reason_cost_en || "Applicable for improved properties",
          calculations: costResult.audit,
        });
      } else {
        approaches.push({
          approach: "cost",
          is_used: false,
          is_primary: false,
          concluded_value: 0,
          weight: 0,
          reason_for_rejection_ar: decisions.reason_cost_ar || "غير مناسب لنوع العقار",
          reason_for_rejection_en: decisions.reason_cost_en || "Not applicable",
          calculations: [],
        });
        // Redistribute weight
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
        approaches.push({
          approach: "income",
          is_used: true,
          is_primary: false,
          concluded_value: incResult.value,
          weight: wI,
          reason_for_use_ar: decisions.reason_income_ar || "العقار مدر للدخل",
          reason_for_use_en: decisions.reason_income_en || "Income producing property",
          calculations: incResult.audit,
        });
      } else {
        approaches.push({
          approach: "income",
          is_used: false,
          is_primary: false,
          concluded_value: 0,
          weight: 0,
          reason_for_rejection_ar: decisions.reason_income_ar || "العقار غير مدر للدخل",
          reason_for_rejection_en: decisions.reason_income_en || "Not income producing",
          calculations: [],
        });
        wM += wI; wI = 0;
      }

      // Renormalize weights
      const finalWSum = wM + wC + wI;
      if (finalWSum > 0) { wM /= finalWSum; wC /= finalWSum; wI /= finalWSum; }

      // ── STEP 6: DETERMINISTIC RECONCILIATION ──
      console.log("Step 6: Deterministic reconciliation...");
      const reconResult = calcReconciliation(marketResult.value, costValue, incomeValue, wM, wC, wI);
      allAudit.push(...reconResult.audit);
      allCalcErrors.push(...reconResult.errors);

      // ── STEP 7: AI writes report narrative (no calculations) ──
      console.log("Step 7: AI report narrative...");
      const calculationSummary = {
        final_value: reconResult.final_value,
        range_low: reconResult.range_low,
        range_high: reconResult.range_high,
        variance_pct: reconResult.variance_pct,
        market_value: marketResult.value,
        market_price_sqm: marketResult.price_per_sqm,
        cost_value: costValue,
        income_value: incomeValue,
        weights: { market: wM, cost: wC, income: wI },
        approaches,
        hbu: hbuResult,
        market_overview: aiAdjustments.market_overview_ar,
        inspection_analysis: inspectionAnalysis ? {
          condition_rating: inspectionAnalysis.condition_rating,
          condition_score: inspectionAnalysis.condition_score,
          finishing_level: inspectionAnalysis.finishing_level,
          quality_score: inspectionAnalysis.quality_score,
          defects_count: (inspectionAnalysis.visible_defects as any[] || []).length,
          risk_flags_count: (inspectionAnalysis.risk_flags as any[] || []).length,
          physical_depreciation_pct: inspectionAnalysis.physical_depreciation_pct,
          condition_adjustment_pct: inspectionAnalysis.condition_adjustment_pct,
        } : null,
      };
      const reportContent = await aiGenerateReport(normalizedData, calculationSummary, hbuResult, request);

      // ── STEP 8: Compliance ──
      console.log("Step 8: Compliance checks...");
      const compliance = runComplianceChecks(reportContent, { ...reconResult, final_value_text_ar: reportContent.final_value_text_ar, reasoning_ar: reportContent.reconciliation_ar || reportContent.value_conclusion_ar }, normalizedData, allCalcErrors);

      // ── SAVE TO DB ──
      // Delete old methods for re-run
      await sb.from("valuation_methods").delete().eq("assignment_id", assignment_id);
      await sb.from("compliance_checks").delete().eq("assignment_id", assignment_id);

      for (const approach of approaches) {
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
              method_id: method.id,
              step_number: calc.step,
              label_ar: calc.label_ar,
              label_en: calc.label_en || "",
              formula: calc.formula || "",
              input_data: calc.inputs || {},
              result_value: calc.result,
              result_unit: calc.unit || "SAR",
              explanation_ar: "",
              explanation_en: "",
            });
          }
        }
      }

      await sb.from("reconciliation_results").upsert({
        assignment_id,
        final_value: reconResult.final_value,
        final_value_text_ar: reportContent.final_value_text_ar || "",
        final_value_text_en: reportContent.final_value_text_en || "",
        currency: "SAR",
        confidence_level: reconResult.variance_pct < 10 ? "high" : reconResult.variance_pct < 20 ? "moderate" : "low",
        value_range_low: reconResult.range_low,
        value_range_high: reconResult.range_high,
        reasoning_ar: reportContent.reconciliation_ar || reportContent.value_conclusion_ar || "",
        reasoning_en: reportContent.reconciliation_en || reportContent.value_conclusion_en || "",
        highest_best_use_ar: hbuResult.conclusion_ar,
        highest_best_use_en: hbuResult.conclusion_en || "",
      }, { onConflict: "assignment_id" });

      for (const check of compliance.checks) {
        await sb.from("compliance_checks").insert({
          assignment_id,
          check_code: check.code,
          check_name_ar: check.name_ar,
          check_name_en: check.name_en,
          category: check.category,
          is_passed: check.passed,
          is_mandatory: check.mandatory,
          auto_checked: true,
          checked_at: new Date().toISOString(),
          notes: check.notes || null,
        });
      }

      const { data: report } = await sb.from("reports").insert({
        assignment_id,
        title_ar: `تقرير تقييم - ${normalizedData.location?.city_ar || ""}`,
        title_en: `Valuation Report - ${normalizedData.location?.city_en || ""}`,
        language: "bilingual",
        report_type: "full_narrative",
        content_ar: reportContent,
        content_en: reportContent,
        cover_page: {
          title_ar: `تقرير تقييم عقار`,
          title_en: `Property Valuation Report`,
          reference_number: assignment.reference_number,
          valuation_date: assignment.valuation_date || new Date().toISOString().split("T")[0],
          report_date: new Date().toISOString().split("T")[0],
          final_value: reconResult.final_value,
          currency: "SAR",
        },
        status: compliance.ready_for_issuance ? "draft" : "needs_review",
        generated_by: "calculation_engine_v2",
        version: 1,
      }).select().single();

      // Audit log with full trail
      await sb.from("audit_logs").insert({
        table_name: "valuation_assignments",
        action: "update",
        record_id: assignment_id,
        assignment_id,
        description: "Calculation engine v2: deterministic calculations + AI reasoning",
        new_data: {
          engine_version: "v2_deterministic",
          final_value: reconResult.final_value,
          approaches_used: approaches.filter((a: any) => a.is_used).length,
          compliance_score: `${compliance.passed}/${compliance.total}`,
          calc_errors: allCalcErrors,
          audit_steps: allAudit.length,
          ai_role: "classification, adjustments suggestion, HBU, report writing",
          deterministic: "market calc, cost calc, income calc, reconciliation, compliance",
        },
      });

      return new Response(JSON.stringify({
        success: true,
        report_id: report?.id,
        final_value: reconResult.final_value,
        final_value_text_ar: reportContent.final_value_text_ar || "",
        confidence_level: reconResult.variance_pct < 10 ? "high" : reconResult.variance_pct < 20 ? "moderate" : "low",
        compliance: {
          ready: compliance.ready_for_issuance,
          passed: compliance.passed,
          total: compliance.total,
          mandatory_failures: compliance.mandatory_failures,
        },
        pipeline_steps: {
          normalized_data: normalizedData,
          market_data: aiAdjustments,
          hbu: hbuResult,
          valuation: { approaches },
          reconciliation: reconResult,
        },
        audit_trail: allAudit,
        calculation_errors: allCalcErrors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "compliance_check") {
      const { data: report } = await sb.from("reports").select("*").eq("assignment_id", assignment_id).order("version", { ascending: false }).limit(1).single();
      const { data: recon } = await sb.from("reconciliation_results").select("*").eq("assignment_id", assignment_id).single();
      const { data: subjects } = await sb.from("subjects").select("*").eq("assignment_id", assignment_id);
      if (!report || !recon) throw new Error("Report or reconciliation data not found");
      const compliance = runComplianceChecks(report.content_ar || {}, recon, subjects?.[0] || {}, []);
      return new Response(JSON.stringify(compliance), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("valuation-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
