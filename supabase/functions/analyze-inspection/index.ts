import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function callAI(systemPrompt: string, userPrompt: string, tools: any[], toolChoice: any) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: toolChoice,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI error:", resp.status, t);
    if (resp.status === 429) throw new Error("Rate limited, please try again later");
    if (resp.status === 402) throw new Error("Credits exhausted");
    throw new Error(`AI error ${resp.status}`);
  }
  const json = await resp.json();
  const tc = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call in AI response");
  return JSON.parse(tc.function.arguments);
}

const ANALYSIS_TOOL = [{
  type: "function",
  function: {
    name: "inspection_analysis",
    description: "Analyze inspection data and photos to extract structured property condition data",
    parameters: {
      type: "object",
      properties: {
        condition_rating: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Overall property condition" },
        condition_score: { type: "number", description: "1-10 score" },
        finishing_level: { type: "string", enum: ["luxury", "high", "standard", "basic", "unfinished"] },
        quality_score: { type: "number", description: "1-10 score" },
        maintenance_level: { type: "string", enum: ["excellent", "good", "average", "poor", "neglected"] },
        environment_quality: { type: "string", enum: ["excellent", "good", "average", "poor"] },
        visible_defects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              severity: { type: "string", enum: ["minor", "moderate", "major", "critical"] },
              location_ar: { type: "string" },
              description_ar: { type: "string" },
              description_en: { type: "string" },
              estimated_repair_impact_pct: { type: "number" },
            },
            required: ["type", "severity", "description_ar"],
          },
        },
        risk_flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flag: { type: "string" },
              description_ar: { type: "string" },
              description_en: { type: "string" },
              impact: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["flag", "description_ar", "impact"],
          },
        },
        physical_depreciation_pct: { type: "number", description: "Physical depreciation 0-1" },
        functional_obsolescence_pct: { type: "number", description: "Functional obsolescence 0-1" },
        external_obsolescence_pct: { type: "number", description: "External obsolescence 0-1" },
        condition_adjustment_pct: { type: "number", description: "Condition adjustment for comparables -0.20 to +0.10" },
        adjustment_factors: {
          type: "object",
          properties: {
            condition_adj: { type: "number" },
            finishing_adj: { type: "number" },
            maintenance_adj: { type: "number" },
            environment_adj: { type: "number" },
          },
        },
        reasoning_ar: { type: "string", description: "Detailed reasoning in Arabic" },
        reasoning_en: { type: "string", description: "Detailed reasoning in English" },
        photo_insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              observation_ar: { type: "string" },
              observation_en: { type: "string" },
              condition: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
            },
            required: ["category", "observation_ar", "condition"],
          },
        },
      },
      required: ["condition_rating", "condition_score", "finishing_level", "quality_score",
        "maintenance_level", "physical_depreciation_pct", "condition_adjustment_pct",
        "reasoning_ar", "visible_defects", "risk_flags"],
      additionalProperties: false,
    },
  },
}];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { inspection_id } = await req.json();
    if (!inspection_id) throw new Error("inspection_id required");

    const admin = sb();

    // Fetch inspection + related data
    const { data: inspection, error: iErr } = await admin.from("inspections").select("*").eq("id", inspection_id).single();
    if (iErr || !inspection) throw new Error("Inspection not found");

    const [photosRes, checklistRes, subjectRes] = await Promise.all([
      admin.from("inspection_photos").select("*").eq("inspection_id", inspection_id),
      admin.from("inspection_checklist_items").select("*").eq("inspection_id", inspection_id).order("sort_order"),
      admin.from("subjects").select("*").eq("assignment_id", inspection.assignment_id).limit(1),
    ]);

    const photos = photosRes.data || [];
    const checklist = checklistRes.data || [];
    const subject = subjectRes.data?.[0] || {};

    // Build photo descriptions for AI (we pass metadata, not actual images)
    const photoDescriptions = photos.map(p => ({
      category: p.category,
      caption: p.caption_ar || p.caption_en || "",
      has_gps: !!(p.latitude && p.longitude),
      file_name: p.file_name,
    }));

    // Build checklist summary
    const checklistSummary = {
      total: checklist.length,
      checked: checklist.filter((c: any) => c.is_checked).length,
      required_passed: checklist.filter((c: any) => c.is_required && c.is_checked).length,
      required_total: checklist.filter((c: any) => c.is_required).length,
      categories: {} as Record<string, { total: number; checked: number }>,
      items: checklist.map((c: any) => ({
        category: c.category,
        label: c.label_ar,
        checked: c.is_checked,
        required: c.is_required,
        notes: c.notes,
        value: c.value,
      })),
    };
    for (const c of checklist) {
      const cat = (c as any).category;
      if (!checklistSummary.categories[cat]) checklistSummary.categories[cat] = { total: 0, checked: 0 };
      checklistSummary.categories[cat].total++;
      if ((c as any).is_checked) checklistSummary.categories[cat].checked++;
    }

    // Call AI
    const systemPrompt = `أنت خبير فحص عقاري وتقييم حالة المباني. حلل بيانات المعاينة الميدانية واستخرج بيانات هيكلية عن حالة العقار.

القواعد:
- condition_score: مقياس 1-10 (10 = ممتاز)
- quality_score: مقياس 1-10 (10 = فاخر)
- physical_depreciation_pct: نسبة 0 إلى 1 (0 = جديد، 1 = مهلك)
- functional_obsolescence_pct: نسبة 0 إلى 0.3
- external_obsolescence_pct: نسبة 0 إلى 0.2
- condition_adjustment_pct: تعديل المقارنات -0.20 إلى +0.10
- كن دقيقاً ومحافظاً في التقديرات
- اعتمد على قائمة الفحص والملاحظات المكتوبة`;

    const userPrompt = `بيانات المعاينة:

الملاحظات: ${inspection.notes_ar || "لا توجد"}
النتائج: ${inspection.findings_ar || "لا توجد"}

بيانات العقار:
- النوع: ${subject.property_type || "غير محدد"}
- المساحة: ${subject.land_area || "غير محدد"} م²
- مساحة البناء: ${subject.building_area || "غير محدد"} م²
- سنة البناء: ${subject.year_built || "غير محدد"}
- الحالة المسجلة: ${subject.building_condition || "غير محدد"}
- عدد الطوابق: ${subject.number_of_floors || "غير محدد"}

الصور الملتقطة (${photos.length} صورة):
${JSON.stringify(photoDescriptions, null, 2)}

قائمة الفحص:
${JSON.stringify(checklistSummary, null, 2)}`;

    console.log("Calling AI for inspection analysis...");
    const aiResult = await callAI(systemPrompt, userPrompt, ANALYSIS_TOOL,
      { type: "function", function: { name: "inspection_analysis" } });

    // Clamp values
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    aiResult.condition_score = clamp(aiResult.condition_score || 5, 1, 10);
    aiResult.quality_score = clamp(aiResult.quality_score || 5, 1, 10);
    aiResult.physical_depreciation_pct = clamp(aiResult.physical_depreciation_pct || 0, 0, 1);
    aiResult.functional_obsolescence_pct = clamp(aiResult.functional_obsolescence_pct || 0, 0, 0.3);
    aiResult.external_obsolescence_pct = clamp(aiResult.external_obsolescence_pct || 0, 0, 0.2);
    aiResult.condition_adjustment_pct = clamp(aiResult.condition_adjustment_pct || 0, -0.20, 0.10);

    // Save to DB
    const { data: analysis, error: saveErr } = await admin.from("inspection_analysis").upsert({
      inspection_id,
      assignment_id: inspection.assignment_id,
      condition_rating: aiResult.condition_rating,
      condition_score: aiResult.condition_score,
      finishing_level: aiResult.finishing_level,
      quality_score: aiResult.quality_score,
      maintenance_level: aiResult.maintenance_level || "average",
      environment_quality: aiResult.environment_quality || "good",
      visible_defects: aiResult.visible_defects || [],
      risk_flags: aiResult.risk_flags || [],
      adjustment_factors: aiResult.adjustment_factors || {},
      photo_analysis: aiResult.photo_insights || [],
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

    if (saveErr) {
      console.error("Save error:", saveErr);
      throw new Error("Failed to save analysis");
    }

    // Update assignment status to valuation_in_progress
    await admin.from("valuation_assignments").update({
      status: "valuation_in_progress",
    }).eq("id", inspection.assignment_id);

    // Audit log
    await admin.from("audit_logs").insert({
      table_name: "inspection_analysis",
      action: "create",
      record_id: analysis?.id,
      assignment_id: inspection.assignment_id,
      description: `AI inspection analysis completed. Condition: ${aiResult.condition_rating}, Score: ${aiResult.condition_score}/10`,
      new_data: {
        condition_rating: aiResult.condition_rating,
        condition_score: aiResult.condition_score,
        defects_count: (aiResult.visible_defects || []).length,
        risk_flags_count: (aiResult.risk_flags || []).length,
        depreciation: aiResult.physical_depreciation_pct,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      analysis_id: analysis?.id,
      condition_rating: aiResult.condition_rating,
      condition_score: aiResult.condition_score,
      quality_score: aiResult.quality_score,
      defects_count: (aiResult.visible_defects || []).length,
      risk_flags_count: (aiResult.risk_flags || []).length,
      depreciation: {
        physical: aiResult.physical_depreciation_pct,
        functional: aiResult.functional_obsolescence_pct,
        external: aiResult.external_obsolescence_pct,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("analyze-inspection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
