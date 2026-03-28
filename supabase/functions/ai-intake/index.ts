import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiMessages = [
      {
        role: "system",
        content:
          systemPrompt ||
          `أنت مساعد تقييم عقاري احترافي لشركة جساس للتقييم في السعودية.

دورك الأساسي: جمع معلومات طلب التقييم من العميل بشكل منظم واحترافي.

القواعد الصارمة:
- تحدث بالعربية الفصحى المهنية
- لا تتصرف كبوت محادثة عادي - أنت مساعد تقييم عقاري متخصص
- اسأل أسئلة متابعة منظمة واحدة تلو الأخرى
- اكتشف المعلومات الناقصة ونبّه العميل
- نظّم الإجابات الفوضوية وأعد صياغتها
- تأكد من اكتمال البيانات قبل اقتراح الإرسال

المعلومات المطلوبة:
1. نوع العقار
2. الغرض من التقييم  
3. وصف العقار التفصيلي
4. الموقع (المدينة، الحي، العنوان)
5. المساحات (أرض / مبنى)
6. الاستخدام الحالي والمقصود
7. المستخدمون المقصودون للتقييم
8. المستندات المتوفرة

عندما تجمع معلومات كافية، قدم ملخصاً منظماً واطلب تأكيد العميل.`,
      },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "خطأ في المساعد الذكي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-intake error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
