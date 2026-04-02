import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `أنت "رقيم" — مساعد ذكاء اصطناعي متخصص في التقييم العقاري والآلات والمعدات.
أنت أيضاً **المنسّق الذكي** لكل أنظمة منصة جساس. يمكنك تنفيذ إجراءات حقيقية عبر أدوات متخصصة.

## قيود صارمة — التعلم المتحكم به
- أنت لا تتعلم ذاتياً ولا تحدّث معرفتك تلقائياً.
- معرفتك تأتي حصرياً مما يزوّدك به المدير المعتمد (أحمد المالكي).
- لا تستخدم معلومات من مصادر خارجية غير موثقة.
- لا تُعدّل منطق التقييم بشكل مستقل.

## أولوية المعرفة (من الأعلى للأدنى)
1. تصحيحات المدير (أعلى أولوية مطلقة)
2. القواعد والتعليمات المعرّفة من المدير
3. المستندات المرفوعة من المدير (معايير، سياسات، أنظمة)
4. معايير IVS 2025 ومعايير تقييم السعودية

## الشفافية (إلزامية)
- دائماً اشرح منطقك وخطوات استنتاجك.
- استشهد بالمصادر عند الإمكان (رقم المعيار، اسم القاعدة، المستند).
- إذا طُبّق تصحيح سابق، أوضح ذلك.
- إذا لم تكن متأكداً، قل ذلك بصراحة.

## قدرات التنسيق (الأدوات المتاحة)
عندما يطلب المستخدم تنفيذ إجراء، استخدم الأداة المناسبة:
- **generate_scope**: لتوليد نطاق العمل والتسعير لطلب تقييم
- **run_valuation**: لتشغيل محرك التقييم وحساب القيمة

### قواعد استخدام الأدوات:
1. لا تستخدم أداة إلا إذا طلب المستخدم ذلك بوضوح
2. اسأل عن رقم الطلب (request_id) أو المهمة (assignment_id) إذا لم يُذكر
3. بعد تنفيذ الأداة، اعرض النتائج بشكل مهني ومنظم
4. لا تعتمد أي شيء تلقائياً — اعرض النتائج وانتظر قرار المقيّم

## دورك
- الإجابة على أسئلة التقييم وفقاً للمعايير والقواعد المعرّفة.
- تنسيق الأنظمة الداخلية عند الطلب.
- تحليل الوثائق المرفوعة واستخراج المعلومات الرئيسية.
- تقديم توصيات مهنية بناءً على المعرفة المتاحة.
- أنت مساعد وليس مقيّماً — لا تُصدر أحكام تقييمية نهائية.
- الإجابة باللغة العربية بشكل افتراضي.`;

// Tools definition for AI function calling
const TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_scope",
      description: "توليد نطاق العمل والتسعير لطلب تقييم محدد. يحلل المستندات ويحدد المنهجية والتسعير.",
      parameters: {
        type: "object",
        properties: {
          request_id: {
            type: "string",
            description: "معرّف طلب التقييم (UUID)"
          }
        },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_valuation",
      description: "تشغيل محرك التقييم لحساب القيمة باستخدام المناهج الثلاث (سوقي، دخل، تكلفة) لمهمة تقييم محددة.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: {
            type: "string",
            description: "معرّف مهمة التقييم (UUID)"
          },
          step: {
            type: "string",
            enum: ["full", "normalize", "market_data", "hbu", "approaches", "adjustments", "reconcile", "report"],
            description: "الخطوة المطلوبة — 'full' لتشغيل كل الخطوات"
          }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "توليد مسودة التقرير الكامل (11 قسم) لمهمة تقييم محددة. يجمع البيانات من 14 جدولاً ويُنتج تقريراً متوافقاً مع IVS 2025.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: {
            type: "string",
            description: "معرّف مهمة التقييم (UUID)"
          }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_compliance",
      description: "فحص امتثال التقرير للمعايير الدولية (IVS 2025) ومعايير تقييم السعودية. يتحقق من اكتمال الأقسام والبيانات الإلزامية.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: {
            type: "string",
            description: "معرّف مهمة التقييم (UUID)"
          }
        },
        required: ["assignment_id"]
      }
    }
  }
];

async function buildContextualPrompt(supabaseClient: any): Promise<string> {
  const contextSections: string[] = [BASE_SYSTEM_PROMPT];

  // 1. Admin corrections (highest priority)
  const { data: corrections } = await supabaseClient
    .from("raqeem_corrections")
    .select("original_question, corrected_answer, correction_reason")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (corrections && corrections.length > 0) {
    let section = "\n\n## تصحيحات المدير (أعلى أولوية — طبّقها دائماً)\n";
    for (const c of corrections) {
      section += `\n### سؤال: ${c.original_question}\n`;
      section += `الإجابة الصحيحة: ${c.corrected_answer}\n`;
      if (c.correction_reason) section += `السبب: ${c.correction_reason}\n`;
    }
    contextSections.push(section);
  }

  // 2. Admin rules
  const { data: rules } = await supabaseClient
    .from("raqeem_rules")
    .select("rule_title_ar, rule_content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(30);

  if (rules && rules.length > 0) {
    let section = "\n\n## قواعد وتعليمات المدير (إلزامية)\n";
    for (const r of rules) {
      const level = r.priority >= 10 ? "⚠️ إلزامية" : r.priority >= 7 ? "مهمة" : "عادية";
      section += `\n### [${level}] ${r.rule_title_ar}\n${r.rule_content}\n`;
    }
    contextSections.push(section);
  }

  // 3. Knowledge documents
  const { data: knowledge } = await supabaseClient
    .from("raqeem_knowledge")
    .select("title_ar, content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (knowledge && knowledge.length > 0) {
    let section = `\n\n## مستندات مرجعية من المدير (${knowledge.length} مستند)\n`;
    const perDocLimit = Math.min(3000, Math.floor(800000 / knowledge.length));
    for (const k of knowledge) {
      const content = k.content && k.content.length > perDocLimit
        ? k.content.substring(0, perDocLimit) + "..."
        : (k.content || "[محتوى غير مستخرج]");
      section += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
    }
    contextSections.push(section);
  }

  return contextSections.join("");
}

// Execute tool calls by invoking internal edge functions
async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    let functionName = "";
    let body: any = {};

    if (toolName === "generate_scope") {
      functionName = "generate-scope-pricing";
      body = { requestId: args.request_id };
    } else if (toolName === "run_valuation") {
      functionName = "valuation-engine";
      body = { assignmentId: args.assignment_id, step: args.step || "full" };
    } else {
      return { success: false, result: null, error: `أداة غير معروفة: ${toolName}` };
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, result: null, error: data.error || `خطأ ${resp.status}` };
    }
    return { success: true, result: data };
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return { success: false, result: null, error: e instanceof Error ? e.message : "خطأ غير متوقع" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, correction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Handle correction submission
    if (correction) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await userClient.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseClient.from("raqeem_corrections").insert({
        original_question: correction.original_question,
        original_answer: correction.original_answer,
        corrected_answer: correction.corrected_answer,
        correction_reason: correction.reason || null,
        corrected_by: user.id,
      });

      if (error) {
        console.error("Correction save error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save correction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build contextual system prompt
    const systemPrompt = await buildContextualPrompt(supabaseClient);

    // First call: with tools enabled (non-streaming to detect tool calls)
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: TOOLS,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      return handleAIError(firstResponse);
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices?.[0];

    // Check if AI wants to call tools
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      // Send orchestration status event first
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send initial status
          const statusEvent = {
            type: "orchestration_status",
            tools: toolCalls.map((tc: any) => ({
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}"),
              status: "running"
            }))
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: statusEvent }] })}\n\n`));

          // Execute all tool calls
          for (const tc of toolCalls) {
            const args = JSON.parse(tc.function.arguments || "{}");
            const result = await executeTool(tc.function.name, args, supabaseUrl, supabaseServiceKey);
            toolResults.push({
              tool_call_id: tc.id,
              role: "tool",
              name: tc.function.name,
              content: JSON.stringify(result),
            });

            // Send tool completion status
            const doneEvent = {
              type: "tool_complete",
              tool: tc.function.name,
              success: result.success,
              result: result.success ? result.result : null,
              error: result.error || null,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: doneEvent }] })}\n\n`));
          }

          // Second call: AI summarizes tool results (streaming)
          const secondMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolResults,
          ];

          const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: secondMessages,
              stream: true,
            }),
          });

          if (!secondResponse.ok || !secondResponse.body) {
            const errText = "حدث خطأ في تحليل النتائج";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errText } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Pipe the streaming response
          const reader = secondResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — stream a normal response
    const normalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!normalResponse.ok) {
      return handleAIError(normalResponse);
    }

    return new Response(normalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("raqeem-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAIError(response: Response) {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "تم تجاوز الحد المسموح للطلبات، يرجى المحاولة لاحقاً." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام المساعد الذكي." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const t = await response.text();
  console.error("AI gateway error:", response.status, t);
  return new Response(
    JSON.stringify({ error: "حدث خطأ في الاتصال بالمساعد الذكي" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
