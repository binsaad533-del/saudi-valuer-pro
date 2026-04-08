import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function sb() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY); }

async function callAI(systemPrompt: string, userPrompt: string, tools: any[], toolChoice: any) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools, tool_choice: toolChoice,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    if (resp.status === 429) throw new Error("Rate limited");
    if (resp.status === 402) throw new Error("Credits exhausted");
    throw new Error(`AI error ${resp.status}`);
  }
  const json = await resp.json();
  const tc = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call in AI response");
  return JSON.parse(tc.function.arguments);
}

// Shared analysis output fields
const BASE_FIELDS = {
  condition_rating: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
  condition_score: { type: "number" },
  quality_score: { type: "number" },
  maintenance_level: { type: "string", enum: ["excellent", "good", "average", "poor", "neglected"] },
  visible_defects: {
    type: "array",
    items: {
      type: "object",
      properties: {
        type: { type: "string" }, severity: { type: "string", enum: ["minor", "moderate", "major", "critical"] },
        location_ar: { type: "string" }, description_ar: { type: "string" }, description_en: { type: "string" },
        estimated_repair_impact_pct: { type: "number" },
      },
      required: ["type", "severity", "description_ar"],
    },
  },
  risk_flags: {
    type: "array",
    items: {
      type: "object",
      properties: { flag: { type: "string" }, description_ar: { type: "string" }, description_en: { type: "string" }, impact: { type: "string", enum: ["low", "medium", "high"] } },
      required: ["flag", "description_ar", "impact"],
    },
  },
  physical_depreciation_pct: { type: "number" },
  functional_obsolescence_pct: { type: "number" },
  external_obsolescence_pct: { type: "number" },
  condition_adjustment_pct: { type: "number" },
  reasoning_ar: { type: "string" },
  reasoning_en: { type: "string" },
};

const RE_EXTRA = {
  finishing_level: { type: "string", enum: ["luxury", "high", "standard", "basic", "unfinished"] },
  environment_quality: { type: "string", enum: ["excellent", "good", "average", "poor"] },
  adjustment_factors: {
    type: "object",
    properties: { condition_adj: { type: "number" }, finishing_adj: { type: "number" }, maintenance_adj: { type: "number" }, environment_adj: { type: "number" } },
  },
};

const ME_EXTRA = {
  mechanical_condition: { type: "string", enum: ["excellent", "good", "fair", "poor", "non_operational"] },
  electrical_condition: { type: "string", enum: ["excellent", "good", "fair", "poor", "not_applicable"] },
  structural_condition: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
  operational_status: { type: "string", enum: ["operational", "operational_issues", "stopped", "needs_repair", "scrap"] },
  estimated_remaining_life_years: { type: "number" },
  technology_obsolescence_pct: { type: "number" },
};

function buildTool(discipline: string) {
  const extra = discipline === "machinery_equipment" ? ME_EXTRA : discipline === "mixed" ? { ...RE_EXTRA, ...ME_EXTRA } : RE_EXTRA;
  return [{
    type: "function",
    function: {
      name: "inspection_analysis",
      description: "Analyze inspection data",
      parameters: {
        type: "object",
        properties: { ...BASE_FIELDS, ...extra },
        required: ["condition_rating", "condition_score", "quality_score", "maintenance_level", "physical_depreciation_pct", "condition_adjustment_pct", "reasoning_ar", "visible_defects", "risk_flags"],
        additionalProperties: false,
      },
    },
  }];
}

function buildPrompt(discipline: string): string {
  if (discipline === "machinery_equipment") {
    return `أنت مهندس ميكانيكي وخبير تقييم آلات ومعدات. حلل بيانات المعاينة الميدانية واستخرج بيانات هيكلية عن حالة الآلة/المعدة.

القواعد:
- condition_score: 1-10 (10 = ممتاز)
- quality_score: 1-10 (10 = أعلى جودة)
- physical_depreciation_pct: 0-1 (0 = جديد)
- functional_obsolescence_pct: 0-0.3
- external_obsolescence_pct: 0-0.2
- technology_obsolescence_pct: 0-0.35
- condition_adjustment_pct: -0.30 to +0.10
- قيّم الحالة الميكانيكية والكهربائية والهيكلية
- حدد الحالة التشغيلية والعمر الإنتاجي المتبقي`;
  }
  if (discipline === "mixed") {
    return `أنت خبير تقييم متعدد التخصصات (عقارات + آلات ومعدات). حلل بيانات المعاينة واستخرج بيانات شاملة تغطي الجزء العقاري والآلات.

القواعد:
- condition_score: 1-10
- physical_depreciation_pct: 0-1
- قدّم تقييماً شاملاً يغطي العقار والمعدات معاً
- حدد finishing_level للعقار و mechanical/electrical/structural للمعدات`;
  }
  return `أنت خبير فحص عقاري وتقييم حالة المباني. حلل بيانات المعاينة الميدانية واستخرج بيانات هيكلية عن حالة العقار.

القواعد:
- condition_score: 1-10 (10 = ممتاز)
- quality_score: 1-10 (10 = فاخر)
- physical_depreciation_pct: 0-1
- functional_obsolescence_pct: 0-0.3
- external_obsolescence_pct: 0-0.2
- condition_adjustment_pct: -0.20 to +0.10
- كن دقيقاً ومحافظاً في التقديرات`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const { inspection_id } = await req.json();
    if (!inspection_id) throw new Error("inspection_id required");

    const admin = sb();
    const { data: inspection, error: iErr } = await admin.from("inspections").select("*").eq("id", inspection_id).single();
    if (iErr || !inspection) throw new Error("Inspection not found");

    const discipline: string = (inspection as any).type || "real_estate";

    const [photosRes, checklistRes, subjectRes] = await Promise.all([
      admin.from("inspection_photos").select("*").eq("inspection_id", inspection_id),
      admin.from("inspection_checklist_items").select("*").eq("inspection_id", inspection_id).order("sort_order"),
      admin.from("subjects").select("*").eq("assignment_id", inspection.assignment_id).limit(1),
    ]);

    const photos = photosRes.data || [];
    const checklist = checklistRes.data || [];
    const subject = subjectRes.data?.[0] || {};

    const checklistSummary = {
      total: checklist.length,
      checked: checklist.filter((c: any) => c.is_checked).length,
      items: checklist.map((c: any) => ({ category: c.category, label: c.label_ar, checked: c.is_checked, notes: c.notes })),
    };

    // Get auto_saved_data for machinery fields
    const autoSaved = (inspection as any).auto_saved_data || {};
    const meData = autoSaved.meFormData || {};

    const userPrompt = discipline === "machinery_equipment" || discipline === "mixed"
      ? `بيانات المعاينة:

ملاحظات: ${inspection.notes_ar || "لا توجد"}
نتائج: ${inspection.findings_ar || "لا توجد"}

بيانات الآلة/المعدة:
- الاسم: ${meData.machine_name || "غير محدد"}
- الشركة المصنعة: ${meData.manufacturer || "غير محدد"}
- الموديل: ${meData.model_number || "غير محدد"}
- سنة الصنع: ${meData.year_manufactured || "غير محدد"}
- حالة المحرك: ${meData.engine_condition || "غير محدد"}
- ناقل الحركة: ${meData.transmission_condition || "غير محدد"}
- النظام الهيدروليكي: ${meData.hydraulic_condition || "غير محدد"}
- ساعات التشغيل: ${meData.operating_hours || "غير محدد"}
- الحالة التشغيلية: ${meData.operational_status || "غير محدد"}
- حالة الشاسيه: ${meData.chassis_condition || "غير محدد"}
- الصدأ: ${meData.rust_level || "غير محدد"}

${discipline === "mixed" ? `
بيانات العقار:
- النوع: ${subject.property_type || "غير محدد"}
- المساحة: ${subject.land_area || "غير محدد"} م²
- سنة البناء: ${subject.year_built || "غير محدد"}
` : ""}

الصور (${photos.length}):
${photos.map((p: any) => `${p.category}: ${p.caption_ar || p.file_name}`).join("\n")}

قائمة الفحص:
${JSON.stringify(checklistSummary, null, 2)}`
      : `بيانات المعاينة:

ملاحظات: ${inspection.notes_ar || "لا توجد"}
نتائج: ${inspection.findings_ar || "لا توجد"}

بيانات العقار:
- النوع: ${subject.property_type || "غير محدد"}
- المساحة: ${subject.land_area || "غير محدد"} م²
- مساحة البناء: ${subject.building_area || "غير محدد"} م²
- سنة البناء: ${subject.year_built || "غير محدد"}
- عدد الطوابق: ${subject.number_of_floors || "غير محدد"}

الصور (${photos.length}):
${photos.map((p: any) => `${p.category}: ${p.caption_ar || p.file_name}`).join("\n")}

قائمة الفحص:
${JSON.stringify(checklistSummary, null, 2)}`;

    const aiResult = await callAI(buildPrompt(discipline), userPrompt, buildTool(discipline), { type: "function", function: { name: "inspection_analysis" } });

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    aiResult.condition_score = clamp(aiResult.condition_score || 5, 1, 10);
    aiResult.quality_score = clamp(aiResult.quality_score || 5, 1, 10);
    aiResult.physical_depreciation_pct = clamp(aiResult.physical_depreciation_pct || 0, 0, 1);
    aiResult.functional_obsolescence_pct = clamp(aiResult.functional_obsolescence_pct || 0, 0, 0.3);
    aiResult.external_obsolescence_pct = clamp(aiResult.external_obsolescence_pct || 0, 0, 0.2);
    aiResult.condition_adjustment_pct = clamp(aiResult.condition_adjustment_pct || 0, -0.30, 0.10);

    const { data: analysis, error: saveErr } = await admin.from("inspection_analysis").upsert({
      inspection_id,
      assignment_id: inspection.assignment_id,
      condition_rating: aiResult.condition_rating,
      condition_score: aiResult.condition_score,
      finishing_level: aiResult.finishing_level || null,
      quality_score: aiResult.quality_score,
      maintenance_level: aiResult.maintenance_level || "average",
      environment_quality: aiResult.environment_quality || null,
      visible_defects: aiResult.visible_defects || [],
      risk_flags: aiResult.risk_flags || [],
      adjustment_factors: aiResult.adjustment_factors || {},
      photo_analysis: [],
      checklist_summary: checklistSummary,
      inspector_notes_summary: inspection.notes_ar || null,
      ai_reasoning_ar: aiResult.reasoning_ar,
      ai_reasoning_en: aiResult.reasoning_en || null,
      ai_model_used: "google/gemini-2.5-flash",
      ai_confidence: 0.8,
      physical_depreciation_pct: aiResult.physical_depreciation_pct,
      functional_obsolescence_pct: aiResult.functional_obsolescence_pct,
      external_obsolescence_pct: aiResult.external_obsolescence_pct,
      condition_adjustment_pct: aiResult.condition_adjustment_pct,
      status: "completed",
      processed_at: new Date().toISOString(),
    }, { onConflict: "inspection_id" }).select().single();

    if (saveErr) throw new Error("Failed to save analysis");

    // Use RPC for status change — no direct updates allowed
    await admin.rpc("update_request_status", {
      _assignment_id: inspection.assignment_id,
      _new_status: "data_validated",
      _user_id: "system",
      _action_type: "auto",
      _reason: "تحليل المعاينة مكتمل بالذكاء الاصطناعي",
      _bypass_justification: null,
    });

    await admin.from("audit_logs").insert({
      table_name: "inspection_analysis", action: "create", record_id: analysis?.id,
      assignment_id: inspection.assignment_id,
      description: `AI ${discipline} inspection analysis. Condition: ${aiResult.condition_rating}, Score: ${aiResult.condition_score}/10`,
      new_data: { condition_rating: aiResult.condition_rating, condition_score: aiResult.condition_score, discipline },
    });

    return new Response(JSON.stringify({
      success: true, analysis_id: analysis?.id,
      discipline,
      condition_rating: aiResult.condition_rating,
      condition_score: aiResult.condition_score,
      quality_score: aiResult.quality_score,
      defects_count: (aiResult.visible_defects || []).length,
      risk_flags_count: (aiResult.risk_flags || []).length,
      ...(discipline !== "real_estate" ? {
        mechanical_condition: aiResult.mechanical_condition,
        operational_status: aiResult.operational_status,
      } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("analyze-inspection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
