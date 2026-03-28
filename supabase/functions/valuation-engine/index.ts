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

async function callAI(systemPrompt: string, userPrompt: string, tools?: any[], toolChoice?: any) {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (tools) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI error ${resp.status}: ${t}`);
  }
  return resp.json();
}

function extractToolResult(aiResponse: any): any {
  const tc = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call in AI response");
  return JSON.parse(tc.function.arguments);
}

// ============================================================
// STEP 1: Data Normalization
// ============================================================
async function normalizeData(request: any, subject: any) {
  const systemPrompt = `أنت محرك تقييم عقاري متخصص متوافق مع معايير التقييم الدولية IVS 2025 وهيئة المقيّمين المعتمدين (تقييم).
مهمتك: تطبيع وتنظيم بيانات العقار من مدخلات العميل.`;

  const userPrompt = `بيانات الطلب:
${JSON.stringify(request, null, 2)}

بيانات العقار:
${JSON.stringify(subject, null, 2)}

حلل البيانات وأعد تنظيمها بشكل منهجي.`;

  const tools = [{
    type: "function",
    function: {
      name: "normalize_property_data",
      description: "Normalize and structure property data for valuation",
      parameters: {
        type: "object",
        properties: {
          property_type: { type: "string", enum: ["residential", "commercial", "land", "industrial", "mixed_use", "agricultural"] },
          property_subtype: { type: "string" },
          location: {
            type: "object",
            properties: {
              city_ar: { type: "string" }, city_en: { type: "string" },
              district_ar: { type: "string" }, district_en: { type: "string" },
              region_ar: { type: "string" }, region_en: { type: "string" },
            },
            required: ["city_ar"],
          },
          areas: {
            type: "object",
            properties: {
              land_sqm: { type: "number" }, building_sqm: { type: "number" },
              frontage_m: { type: "number" }, depth_m: { type: "number" },
            },
          },
          usage: {
            type: "object",
            properties: {
              current_use_ar: { type: "string" }, current_use_en: { type: "string" },
              permitted_use_ar: { type: "string" }, permitted_use_en: { type: "string" },
              zoning_ar: { type: "string" }, zoning_en: { type: "string" },
            },
          },
          building_details: {
            type: "object",
            properties: {
              year_built: { type: "number" }, condition: { type: "string" },
              floors: { type: "number" }, units: { type: "number" },
            },
          },
          purpose_ar: { type: "string" }, purpose_en: { type: "string" },
          basis_of_value_ar: { type: "string" }, basis_of_value_en: { type: "string" },
          data_quality_score: { type: "number", description: "0-100 data completeness" },
          missing_data: { type: "array", items: { type: "object", properties: { field: { type: "string" }, importance: { type: "string", enum: ["critical", "important", "optional"] } }, required: ["field", "importance"] } },
        },
        required: ["property_type", "location", "areas", "data_quality_score"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "normalize_property_data" } });
  return extractToolResult(result);
}

// ============================================================
// STEP 2: Market Data Integration
// ============================================================
async function integrateMarketData(normalizedData: any, assignmentId: string) {
  const sb = supabaseAdmin();

  // Fetch internal comparables
  const { data: comparables } = await sb
    .from("comparables")
    .select("*")
    .eq("property_type", normalizedData.property_type === "residential" ? "residential" : normalizedData.property_type)
    .limit(20);

  // Fetch linked assignment comparables
  const { data: assignmentComps } = await sb
    .from("assignment_comparables")
    .select("*, comparables(*)")
    .eq("assignment_id", assignmentId);

  const systemPrompt = `أنت محلل سوق عقاري سعودي متخصص. حلل بيانات السوق والمقارنات المتاحة.`;

  const compsForAI = (assignmentComps?.length ? assignmentComps : comparables?.slice(0, 10)) || [];

  const userPrompt = `بيانات العقار المقيّم:
${JSON.stringify(normalizedData, null, 2)}

المقارنات المتاحة:
${JSON.stringify(compsForAI, null, 2)}

حلل السوق وحدد أفضل المقارنات وسعر المتر المربع السائد.`;

  const tools = [{
    type: "function",
    function: {
      name: "market_analysis",
      description: "Market analysis and comparable selection",
      parameters: {
        type: "object",
        properties: {
          market_overview_ar: { type: "string" },
          market_overview_en: { type: "string" },
          market_trend: { type: "string", enum: ["rising", "stable", "declining"] },
          avg_price_per_sqm: { type: "number" },
          price_range_low: { type: "number" },
          price_range_high: { type: "number" },
          selected_comparables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                comparable_id: { type: "string" },
                relevance_score: { type: "number" },
                price_per_sqm: { type: "number" },
                adjustments_needed: { type: "array", items: { type: "string" } },
              },
            },
          },
          data_sources_ar: { type: "string" },
          data_sources_en: { type: "string" },
        },
        required: ["market_overview_ar", "market_overview_en", "avg_price_per_sqm"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "market_analysis" } });
  return extractToolResult(result);
}

// ============================================================
// STEP 3: Highest & Best Use
// ============================================================
async function analyzeHBU(normalizedData: any, marketData: any) {
  const systemPrompt = `أنت خبير تحليل الاستخدام الأعلى والأفضل (HBU) وفقاً لمعايير IVS 2025.
يجب تحليل أربعة معايير: الجواز القانوني، الإمكانية الفيزيائية، الجدوى المالية، الإنتاجية القصوى.`;

  const userPrompt = `بيانات العقار:
${JSON.stringify(normalizedData, null, 2)}

بيانات السوق:
${JSON.stringify(marketData, null, 2)}

أجرِ تحليل HBU كاملاً.`;

  const tools = [{
    type: "function",
    function: {
      name: "hbu_analysis",
      description: "Highest and Best Use analysis",
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

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "hbu_analysis" } });
  return extractToolResult(result);
}

// ============================================================
// STEP 4: Valuation Approaches
// ============================================================
async function runValuationApproaches(normalizedData: any, marketData: any, hbuResult: any) {
  const systemPrompt = `أنت محرك تقييم عقاري محترف. طبّق أساليب التقييم المناسبة وفقاً لمعايير IVS 2025 وتقييم.

القواعد:
- أسلوب المقارنة بالمبيعات (إلزامي دائماً)
- أسلوب التكلفة (للعقارات المبنية)
- أسلوب الدخل (للعقارات المدرة للدخل)
- أسلوب التطوير/المتبقي (للأراضي التطويرية)
- يجب تبرير كل أسلوب مستخدم وغير مستخدم
- الحسابات يجب أن تكون واقعية ومبنية على البيانات`;

  const userPrompt = `بيانات العقار:
${JSON.stringify(normalizedData, null, 2)}

تحليل السوق:
${JSON.stringify(marketData, null, 2)}

تحليل HBU:
${JSON.stringify(hbuResult, null, 2)}

طبّق جميع أساليب التقييم المناسبة مع حسابات تفصيلية.`;

  const tools = [{
    type: "function",
    function: {
      name: "valuation_approaches",
      description: "Apply valuation approaches with calculations",
      parameters: {
        type: "object",
        properties: {
          approaches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                approach: { type: "string", enum: ["sales_comparison", "cost", "income", "residual", "dcf"] },
                is_used: { type: "boolean" },
                is_primary: { type: "boolean" },
                reason_for_use_ar: { type: "string" },
                reason_for_use_en: { type: "string" },
                reason_for_rejection_ar: { type: "string" },
                reason_for_rejection_en: { type: "string" },
                concluded_value: { type: "number" },
                weight: { type: "number", description: "Weight 0-1 for reconciliation" },
                calculations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step_number: { type: "number" },
                      label_ar: { type: "string" },
                      label_en: { type: "string" },
                      formula: { type: "string" },
                      input_data: { type: "object" },
                      result_value: { type: "number" },
                      result_unit: { type: "string" },
                      explanation_ar: { type: "string" },
                      explanation_en: { type: "string" },
                    },
                    required: ["step_number", "label_ar", "result_value"],
                  },
                },
                adjustments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label_ar: { type: "string" }, label_en: { type: "string" },
                      adjustment_type: { type: "string", enum: ["location", "size", "age", "condition", "time", "zoning", "features", "other"] },
                      adjustment_percentage: { type: "number" },
                      adjustment_amount: { type: "number" },
                      justification_ar: { type: "string" },
                      justification_en: { type: "string" },
                    },
                    required: ["label_ar", "adjustment_type"],
                  },
                },
              },
              required: ["approach", "is_used", "concluded_value"],
            },
          },
          approaches_considered_ar: { type: "string" },
          approaches_considered_en: { type: "string" },
        },
        required: ["approaches"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "valuation_approaches" } });
  return extractToolResult(result);
}

// ============================================================
// STEP 5: Reconciliation
// ============================================================
async function reconcile(normalizedData: any, valuationResult: any) {
  const usedApproaches = valuationResult.approaches.filter((a: any) => a.is_used && a.concluded_value);

  const systemPrompt = `أنت خبير تسوية تقييم عقاري. قم بترجيح الأساليب المستخدمة والوصول إلى القيمة النهائية.
يجب أن تكون القيمة النهائية مبنية على ترجيح منطقي وموضوعي مع تبرير واضح.`;

  const userPrompt = `نتائج أساليب التقييم:
${JSON.stringify(usedApproaches, null, 2)}

بيانات العقار:
${JSON.stringify(normalizedData, null, 2)}

أجرِ التسوية وحدد القيمة النهائية.`;

  const tools = [{
    type: "function",
    function: {
      name: "reconciliation",
      description: "Reconcile valuation approaches and determine final value",
      parameters: {
        type: "object",
        properties: {
          final_value: { type: "number" },
          final_value_text_ar: { type: "string", description: "Value in Arabic words" },
          final_value_text_en: { type: "string", description: "Value in English words" },
          currency: { type: "string" },
          confidence_level: { type: "string", enum: ["high", "moderate", "low"] },
          value_range_low: { type: "number" },
          value_range_high: { type: "number" },
          reasoning_ar: { type: "string" },
          reasoning_en: { type: "string" },
          weights_applied: {
            type: "array",
            items: {
              type: "object",
              properties: {
                approach: { type: "string" },
                weight: { type: "number" },
                justification_ar: { type: "string" },
              },
              required: ["approach", "weight"],
            },
          },
        },
        required: ["final_value", "final_value_text_ar", "reasoning_ar", "confidence_level"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "reconciliation" } });
  return extractToolResult(result);
}

// ============================================================
// STEP 6: Generate Report Content
// ============================================================
async function generateReportContent(
  normalizedData: any, marketData: any, hbuResult: any,
  valuationResult: any, reconciliationResult: any, request: any
) {
  const systemPrompt = `أنت كاتب تقارير تقييم عقاري محترف. اكتب محتوى تقرير تقييم كامل ثنائي اللغة متوافق مع IVS 2025 وتقييم.

يجب أن يكون المحتوى:
- مهنياً وموضوعياً
- مفصلاً وشاملاً
- خالياً من أي آراء شخصية خارج نطاق التقييم
- متوافقاً مع المعايير الدولية والمحلية`;

  const userPrompt = `أنشئ محتوى تقرير تقييم كامل بناءً على:

بيانات العقار: ${JSON.stringify(normalizedData, null, 2)}
تحليل السوق: ${JSON.stringify(marketData, null, 2)}
تحليل HBU: ${JSON.stringify(hbuResult, null, 2)}
نتائج التقييم: ${JSON.stringify(valuationResult, null, 2)}
التسوية والقيمة النهائية: ${JSON.stringify(reconciliationResult, null, 2)}
بيانات الطلب: ${JSON.stringify({ purpose: request.purpose, basis: request.basis_of_value }, null, 2)}`;

  const tools = [{
    type: "function",
    function: {
      name: "generate_report",
      description: "Generate full bilingual valuation report content",
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
        },
        required: [
          "executive_summary_ar", "purpose_ar", "property_description_ar",
          "market_analysis_ar", "valuation_methodology_ar", "value_conclusion_ar",
          "assumptions_ar", "limiting_conditions_ar", "compliance_statement_ar",
        ],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(systemPrompt, userPrompt, tools, { type: "function", function: { name: "generate_report" } });
  return extractToolResult(result);
}

// ============================================================
// COMPLIANCE CHECK
// ============================================================
function runComplianceChecks(reportContent: any, reconciliation: any, normalizedData: any) {
  const checks: Array<{ code: string; name_ar: string; name_en: string; category: string; passed: boolean; mandatory: boolean; notes?: string }> = [];

  const addCheck = (code: string, nameAr: string, nameEn: string, cat: string, passed: boolean, mandatory = true, notes?: string) => {
    checks.push({ code, name_ar: nameAr, name_en: nameEn, category: cat, passed, mandatory, notes });
  };

  // IVS Structure
  addCheck("IVS_EXEC_SUMMARY", "الملخص التنفيذي", "Executive Summary", "ivs_structure", !!reportContent.executive_summary_ar);
  addCheck("IVS_PURPOSE", "غرض التقييم", "Valuation Purpose", "ivs_structure", !!reportContent.purpose_ar);
  addCheck("IVS_SCOPE", "نطاق العمل", "Scope of Work", "ivs_structure", !!reportContent.scope_of_work_ar);
  addCheck("IVS_PROPERTY_DESC", "وصف العقار", "Property Description", "ivs_structure", !!reportContent.property_description_ar);
  addCheck("IVS_MARKET", "تحليل السوق", "Market Analysis", "ivs_structure", !!reportContent.market_analysis_ar);
  addCheck("IVS_HBU", "تحليل الاستخدام الأعلى والأفضل", "HBU Analysis", "ivs_structure", !!reportContent.hbu_analysis_ar);
  addCheck("IVS_METHODOLOGY", "منهجية التقييم", "Valuation Methodology", "ivs_structure", !!reportContent.valuation_methodology_ar);
  addCheck("IVS_CONCLUSION", "الخلاصة والقيمة", "Value Conclusion", "ivs_structure", !!reportContent.value_conclusion_ar);
  addCheck("IVS_ASSUMPTIONS", "الافتراضات", "Assumptions", "ivs_structure", !!reportContent.assumptions_ar);
  addCheck("IVS_LIMITING", "القيود", "Limiting Conditions", "ivs_structure", !!reportContent.limiting_conditions_ar);
  addCheck("IVS_COMPLIANCE", "بيان الامتثال", "Compliance Statement", "ivs_structure", !!reportContent.compliance_statement_ar);

  // Value checks
  addCheck("VAL_FINAL", "القيمة النهائية محددة", "Final Value Set", "valuation", reconciliation.final_value > 0);
  addCheck("VAL_TEXT", "القيمة كتابةً", "Value in Words", "valuation", !!reconciliation.final_value_text_ar);
  addCheck("VAL_REASONING", "تبرير القيمة", "Value Reasoning", "valuation", !!reconciliation.reasoning_ar);
  addCheck("VAL_RANGE", "نطاق القيمة", "Value Range", "valuation", reconciliation.value_range_low > 0 && reconciliation.value_range_high > 0, false);

  // Data completeness
  addCheck("DATA_AREA", "المساحات محددة", "Areas Specified", "data", normalizedData.areas?.land_sqm > 0);
  addCheck("DATA_LOCATION", "الموقع محدد", "Location Specified", "data", !!normalizedData.location?.city_ar);
  addCheck("DATA_TYPE", "نوع العقار", "Property Type", "data", !!normalizedData.property_type);

  const mandatoryFailed = checks.filter(c => c.mandatory && !c.passed);
  return {
    checks,
    total: checks.length,
    passed: checks.filter(c => c.passed).length,
    failed: checks.filter(c => !c.passed).length,
    mandatory_failures: mandatoryFailed.length,
    ready_for_issuance: mandatoryFailed.length === 0,
  };
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
      // Fetch assignment data
      const { data: assignment, error: aErr } = await sb
        .from("valuation_assignments")
        .select("*")
        .eq("id", assignment_id)
        .single();
      if (aErr || !assignment) throw new Error("Assignment not found");

      // Fetch subject
      const { data: subjects } = await sb.from("subjects").select("*").eq("assignment_id", assignment_id);
      const subject = subjects?.[0] || {};

      // Fetch request if linked
      let request = assignment;
      if (request_id) {
        const { data: req } = await sb.from("valuation_requests").select("*").eq("id", request_id).single();
        if (req) request = { ...assignment, ...req };
      }

      // Pipeline
      console.log("Step 1: Normalizing data...");
      const normalizedData = await normalizeData(request, subject);

      console.log("Step 2: Market data integration...");
      const marketData = await integrateMarketData(normalizedData, assignment_id);

      console.log("Step 3: HBU Analysis...");
      const hbuResult = await analyzeHBU(normalizedData, marketData);

      console.log("Step 4: Valuation approaches...");
      const valuationResult = await runValuationApproaches(normalizedData, marketData, hbuResult);

      console.log("Step 5: Reconciliation...");
      const reconciliationResult = await reconcile(normalizedData, valuationResult);

      console.log("Step 6: Report content generation...");
      const reportContent = await generateReportContent(
        normalizedData, marketData, hbuResult, valuationResult, reconciliationResult, request
      );

      console.log("Step 7: Compliance checks...");
      const compliance = runComplianceChecks(reportContent, reconciliationResult, normalizedData);

      // Save results to DB
      // Save valuation methods
      for (const approach of valuationResult.approaches) {
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

        if (method && approach.calculations) {
          for (const calc of approach.calculations) {
            await sb.from("valuation_calculations").insert({
              method_id: method.id,
              step_number: calc.step_number,
              label_ar: calc.label_ar,
              label_en: calc.label_en || "",
              formula: calc.formula || "",
              input_data: calc.input_data || {},
              result_value: calc.result_value,
              result_unit: calc.result_unit || "SAR",
              explanation_ar: calc.explanation_ar || "",
              explanation_en: calc.explanation_en || "",
            });
          }
        }
      }

      // Save reconciliation
      await sb.from("reconciliation_results").upsert({
        assignment_id,
        final_value: reconciliationResult.final_value,
        final_value_text_ar: reconciliationResult.final_value_text_ar,
        final_value_text_en: reconciliationResult.final_value_text_en || "",
        currency: reconciliationResult.currency || "SAR",
        confidence_level: reconciliationResult.confidence_level,
        value_range_low: reconciliationResult.value_range_low || 0,
        value_range_high: reconciliationResult.value_range_high || 0,
        reasoning_ar: reconciliationResult.reasoning_ar,
        reasoning_en: reconciliationResult.reasoning_en || "",
        highest_best_use_ar: hbuResult.conclusion_ar,
        highest_best_use_en: hbuResult.conclusion_en || "",
      }, { onConflict: "assignment_id" });

      // Save compliance checks
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

      // Save report
      const { data: report } = await sb.from("reports").insert({
        assignment_id,
        title_ar: `تقرير تقييم - ${normalizedData.location?.city_ar || ""}`,
        title_en: `Valuation Report - ${normalizedData.location?.city_en || ""}`,
        language: "bilingual",
        report_type: "full_narrative",
        content_ar: reportContent,
        content_en: reportContent,
        cover_page: {
          title_ar: `تقرير تقييم عقار - ${normalizedData.property_type}`,
          title_en: `Property Valuation Report - ${normalizedData.property_type}`,
          reference_number: assignment.reference_number,
          valuation_date: assignment.valuation_date || new Date().toISOString().split("T")[0],
          report_date: new Date().toISOString().split("T")[0],
          final_value: reconciliationResult.final_value,
          currency: "SAR",
        },
        status: compliance.ready_for_issuance ? "draft" : "needs_review",
        generated_by: "ai_engine",
        version: 1,
      }).select().single();

      // Save assumptions
      const assumptions = [
        { text_ar: reportContent.assumptions_ar, text_en: reportContent.assumptions_en, special: false },
        { text_ar: reportContent.special_assumptions_ar, text_en: reportContent.special_assumptions_en, special: true },
      ];
      for (const a of assumptions) {
        if (a.text_ar) {
          await sb.from("assumptions").insert({
            assignment_id,
            assumption_ar: a.text_ar,
            assumption_en: a.text_en || "",
            is_special: a.special,
          });
        }
      }

      // Log
      await sb.from("audit_logs").insert({
        table_name: "valuation_assignments",
        action: "update",
        record_id: assignment_id,
        assignment_id,
        description: "AI valuation engine completed full valuation pipeline",
        new_data: {
          final_value: reconciliationResult.final_value,
          approaches_used: valuationResult.approaches.filter((a: any) => a.is_used).length,
          compliance_score: `${compliance.passed}/${compliance.total}`,
          ready_for_issuance: compliance.ready_for_issuance,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        report_id: report?.id,
        final_value: reconciliationResult.final_value,
        final_value_text_ar: reconciliationResult.final_value_text_ar,
        confidence_level: reconciliationResult.confidence_level,
        compliance: {
          ready: compliance.ready_for_issuance,
          passed: compliance.passed,
          total: compliance.total,
          mandatory_failures: compliance.mandatory_failures,
        },
        pipeline_steps: {
          normalized_data: normalizedData,
          market_data: marketData,
          hbu: hbuResult,
          valuation: valuationResult,
          reconciliation: reconciliationResult,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "compliance_check") {
      // Run standalone compliance check for an assignment
      const { data: report } = await sb.from("reports").select("*").eq("assignment_id", assignment_id).order("version", { ascending: false }).limit(1).single();
      const { data: recon } = await sb.from("reconciliation_results").select("*").eq("assignment_id", assignment_id).single();
      const { data: subjects } = await sb.from("subjects").select("*").eq("assignment_id", assignment_id);

      if (!report || !recon) throw new Error("Report or reconciliation data not found");

      const compliance = runComplianceChecks(report.content_ar || {}, recon, subjects?.[0] || {});

      return new Response(JSON.stringify(compliance), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("valuation-engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
