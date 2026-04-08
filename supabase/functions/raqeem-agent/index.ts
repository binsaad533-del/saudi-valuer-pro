import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Raqeem Agent — Autonomous context-aware intelligence for each workflow stage.
 * 
 * Modes:
 *  - "analyze": Given an assignment_id and stage, produce contextual insights
 *  - "chat": Context-aware chat within a specific stage
 *  - "update_context": Save observations/actions to persistent memory
 */

const STAGE_PROMPTS: Record<string, string> = {
  intake: `أنت تراقب مرحلة "الاستقبال" لطلب التقييم.
مهمتك: تحليل البيانات المرفوعة، اكتشاف النواقص، واقتراح التصنيف المناسب للأصول.
راقب: اكتمال المستندات، تصنيف الأصول، تعارض المصالح المحتمل.`,

  scope: `أنت تراقب مرحلة "نطاق العمل والتسعير".
مهمتك: مراجعة نطاق العمل المُولّد، التأكد من توافقه مع IVS 2025 ومتطلبات تقييم.
راقب: مناسبة المنهجية، اكتمال الافتراضات، دقة التسعير.`,

  data_collection: `أنت تراقب مرحلة "جمع البيانات والمعاينة".
مهمتك: متابعة اكتمال البيانات وحالة المعاينة الميدانية.
راقب: اكتمال الصور، بيانات GPS، قوائم الجرد، مستندات الملكية.`,

  valuation: `أنت تراقب مرحلة "التقييم والتحليل".
مهمتك: مراجعة حسابات التقييم والمقارنات والتسويات.
راقب: منطقية القيمة، كفاية المقارنات، دقة التسويات، تطبيق الحكم المهني (IVS 105).`,

  report: `أنت تراقب مرحلة "إعداد التقرير".
مهمتك: مراجعة مسودة التقرير والتأكد من اكتمال الأقسام الـ 11 الإلزامية.
راقب: اتساق البيانات، اكتمال الأقسام، دقة اللغة المهنية، الامتثال.`,

  compliance: `أنت تراقب مرحلة "فحص الامتثال وضمان الجودة".
مهمتك: التحقق من استيفاء جميع المتطلبات التنظيمية والمهنية.
راقب: معايير IVS 2025، متطلبات تقييم، اكتمال التوقيعات والأختام.`,

  delivery: `أنت تراقب مرحلة "الإصدار والتسليم".
مهمتك: التأكد من جاهزية التقرير النهائي للإصدار.
راقب: حالة الدفع، التوقيع الإلكتروني، ربط قيمة (Taqeem API)، الأرشفة.`,
};

function detectStage(status: string): string {
  const stageMap: Record<string, string> = {
    draft: "intake", submitted: "intake",
    scope_generated: "scope", scope_approved: "scope",
    first_payment_confirmed: "data_collection",
    data_collection_open: "data_collection", data_collection_complete: "data_collection",
    inspection_pending: "data_collection", inspection_completed: "data_collection",
    data_validated: "valuation",
    analysis_complete: "valuation", professional_review: "valuation",
    draft_report_ready: "report", client_review: "report",
    draft_approved: "compliance", final_payment_confirmed: "compliance",
    issued: "delivery", archived: "delivery",
  };
  return stageMap[status] || "intake";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, assignment_id, stage, message, page_context } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    // Fetch assignment data for context
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("*, valuation_requests(*, clients(name_ar, client_type)), subjects(*)")
      .eq("id", assignment_id)
      .single();

    if (!assignment) {
      return new Response(JSON.stringify({ error: "لم يتم العثور على المهمة" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentStage = stage || detectStage(assignment.status);

    // Fetch existing agent context for memory continuity
    const { data: existingContext } = await db
      .from("raqeem_agent_context")
      .select("*")
      .eq("assignment_id", assignment_id)
      .order("updated_at", { ascending: false });

    // Build memory from all stages
    const memoryEntries = (existingContext || []).map((ctx: any) => 
      `[${ctx.stage}] الملاحظات: ${(ctx.observations || []).join("، ")} | الإجراءات المعلقة: ${(ctx.pending_actions || []).join("، ")} | المخاطر: ${(ctx.risk_flags || []).join("، ")}`
    ).filter((e: string) => e.includes(": ") && !e.includes(": ، "));

    // Fetch knowledge base for grounding
    const { data: knowledge } = await db
      .from("raqeem_knowledge")
      .select("title_ar, content, category")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(10);

    const knowledgeContext = (knowledge || []).map((k: any) => 
      `[${k.category}] ${k.title_ar}: ${(k.content || "").substring(0, 500)}`
    ).join("\n");

    // Fetch corrections
    const { data: corrections } = await db
      .from("raqeem_corrections")
      .select("original_question, corrected_answer")
      .eq("is_active", true)
      .limit(20);

    const correctionsContext = (corrections || []).map((c: any) =>
      `تصحيح: "${c.original_question}" → "${c.corrected_answer}"`
    ).join("\n");

    // Build additional context based on stage
    let stageData = "";
    
    if (currentStage === "data_collection" || currentStage === "valuation") {
      const { data: inspections } = await db.from("inspections")
        .select("status, inspection_date, findings_ar, completed")
        .eq("assignment_id", assignment_id).limit(1);
      if (inspections?.length) {
        stageData += `\nالمعاينة: الحالة=${inspections[0].status}, مكتملة=${inspections[0].completed}, النتائج=${inspections[0].findings_ar || "لم تُسجل"}`;
      }
    }

    if (currentStage === "valuation" || currentStage === "report") {
      const { data: comps } = await db.from("assignment_comparables")
        .select("comparable_id, weight").eq("assignment_id", assignment_id);
      stageData += `\nعدد المقارنات المرتبطة: ${comps?.length || 0}`;
      
      const { data: compChecks } = await db.from("compliance_checks")
        .select("check_name_ar, is_passed").eq("assignment_id", assignment_id);
      if (compChecks?.length) {
        const passed = compChecks.filter((c: any) => c.is_passed).length;
        stageData += `\nفحوص الامتثال: ${passed}/${compChecks.length} ناجحة`;
      }
    }

    if (currentStage === "report") {
      const { data: reports } = await db.from("report_versions")
        .select("version_number, language, created_at")
        .eq("assignment_id", assignment_id)
        .order("version_number", { ascending: false }).limit(2);
      stageData += `\nنسخ التقرير: ${reports?.length || 0}`;
    }

    const request = assignment.valuation_requests;
    const client = request?.clients;
    const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;

    const systemPrompt = `أنت "رقيم" — العقل الذكي لمنصة جساس للتقييم. أنت وكيل مستقل (Autonomous Agent) يراقب كل مرحلة ويقدم رؤى استباقية.

## سياق المهمة الحالية
- رقم المهمة: ${assignment_id}
- العميل: ${client?.name_ar || "غير محدد"} (${client?.client_type || ""})
- نوع التقييم: ${assignment.valuation_type || "عقاري"}
- الحالة الحالية: ${assignment.status}
- المرحلة: ${currentStage}
- العقار/الأصل: ${subject?.name_ar || subject?.description_ar || "غير محدد"}
- المدينة: ${subject?.city_ar || ""} - الحي: ${subject?.district_ar || ""}
${stageData}

## المرحلة الحالية
${STAGE_PROMPTS[currentStage] || ""}

## ذاكرتك التراكمية (من المراحل السابقة)
${memoryEntries.length ? memoryEntries.join("\n") : "لا توجد ملاحظات سابقة — هذه أول تفاعل."}

## قاعدة المعرفة المرجعية
${knowledgeContext || "لا توجد مستندات مرجعية محمّلة حالياً."}

${correctionsContext ? `## تصحيحات المدير (أعلى أولوية)\n${correctionsContext}` : ""}

## تعليمات السلوك
1. كن استباقياً: اكتشف المشاكل قبل أن يسأل عنها المقيّم.
2. كن مختصراً ومفيداً: لا تكرر معلومات واضحة.
3. استشهد بالمعايير: عند الإشارة لقاعدة، اذكر رقم المعيار (مثل IVS 105.20).
4. صنّف ملاحظاتك: ⚠️ تحذير | ℹ️ معلومة | ✅ جاهز | 🔴 يتطلب إجراء.
5. لا تعتمد شيئاً تلقائياً — اعرض التوصية وانتظر قرار المقيّم.
6. تذكّر: أنت مساعد ذكي وليس مقيّماً — الحكم المهني للمقيّم المعتمد فقط.

## سياق الصفحة
${page_context || "الصفحة الرئيسية"}`;

    if (mode === "analyze") {
      // Produce contextual insights for the current stage
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `حلل الوضع الحالي لهذه المهمة في مرحلة "${currentStage}" وقدم:
1. ملخص سريع (جملة واحدة)
2. أهم 3 ملاحظات أو تنبيهات
3. الإجراء المطلوب التالي
4. أي مخاطر مكتشفة

أجب بتنسيق JSON:
{"summary": "...", "observations": ["..."], "next_action": "...", "risk_flags": ["..."], "confidence": 0.0-1.0}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "stage_analysis",
              description: "تحليل مرحلة العمل وتقديم رؤى",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "ملخص سريع للوضع" },
                  observations: { type: "array", items: { type: "string" }, description: "الملاحظات" },
                  next_action: { type: "string", description: "الإجراء المطلوب" },
                  risk_flags: { type: "array", items: { type: "string" }, description: "المخاطر" },
                  confidence: { type: "number", description: "درجة الثقة 0-1" },
                },
                required: ["summary", "observations", "next_action", "risk_flags", "confidence"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "stage_analysis" } },
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للحساب" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      let analysis: any;

      // Parse tool call response
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          analysis = JSON.parse(toolCall.function.arguments);
        } catch {
          analysis = { summary: "تعذر تحليل الاستجابة", observations: [], next_action: "", risk_flags: [], confidence: 0 };
        }
      } else {
        // Fallback: try parsing from content
        const content = aiData.choices?.[0]?.message?.content || "";
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content.substring(0, 200), observations: [], next_action: "", risk_flags: [], confidence: 0.5 };
        } catch {
          analysis = { summary: content.substring(0, 200), observations: [], next_action: "", risk_flags: [], confidence: 0.5 };
        }
      }

      // Save to persistent memory
      await db.from("raqeem_agent_context").upsert({
        assignment_id,
        stage: currentStage,
        context_data: { assignment_status: assignment.status, valuation_type: assignment.valuation_type },
        observations: analysis.observations || [],
        pending_actions: analysis.next_action ? [analysis.next_action] : [],
        risk_flags: analysis.risk_flags || [],
        last_insight: analysis.summary,
        updated_at: new Date().toISOString(),
      }, { onConflict: "assignment_id,stage" });

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "chat") {
      // Context-aware chat with streaming
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "يرجى إضافة رصيد" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "وضع غير معروف" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("raqeem-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
