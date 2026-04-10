import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { sections, sourceLang, targetLang } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a professional real estate valuation translator specializing in Saudi Arabian property valuation standards (IVS 2025 and TAQEEM requirements).

CRITICAL RULES:
- Translate contextually using correct valuation terminology, NOT literal translation.
- Maintain legal, technical, and professional meaning in both languages.
- Use these standard terms consistently:
  Market Value = القيمة السوقية
  Fair Value = القيمة العادلة
  Highest and Best Use = الاستخدام الأعلى والأفضل
  Scope of Work = نطاق العمل
  Basis of Value = أساس القيمة
  Sales Comparison Approach = أسلوب المقارنة بالمبيعات
  Income Approach = أسلوب الدخل
  Cost Approach = أسلوب التكلفة
  Reconciliation = التسوية والمطابقة
  Assumptions = الافتراضات
  Special Assumptions = الافتراضات الخاصة
  Limiting Conditions = القيود والمحددات
  Valuation Date = تاريخ التقييم
  Valuer = المقيّم
  Certified Valuer = مقيّم معتمد
  Title Deed = صك الملكية
  Building Permit = رخصة البناء
  Zoning = تصنيف الاستخدام
  Land Area = مساحة الأرض
  Built-Up Area = المساحة المبنية
  Occupancy Rate = نسبة الإشغال
  Net Operating Income = صافي الدخل التشغيلي
  Capitalization Rate = معدل الرسملة
  Depreciation = الاستهلاك
  Replacement Cost = تكلفة الإحلال
  Subject Property = العقار موضوع التقييم
  Comparable Property = العقار المقارن
  Adjustment = التعديل
  Inspection = المعاينة
  TAQEEM = تقييم (الهيئة السعودية للمقيّمين المعتمدين)

- Preserve numbers, dates, currency formatting exactly
- Keep proper names unchanged: Ahmed Al-Malki / احمد المالكي
- Output must be valid JSON matching the input structure

SOURCE LANGUAGE: ${sourceLang === "ar" ? "Arabic" : "English"}
TARGET LANGUAGE: ${targetLang === "ar" ? "Arabic" : "English"}

Translate each section value. Return a JSON object with the same keys but translated values.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Translate the following report sections:\n\n${JSON.stringify(sections, null, 2)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description:
                  "Return translated report sections as a structured object",
                parameters: {
                  type: "object",
                  properties: {
                    translated_sections: {
                      type: "object",
                      description:
                        "Object with same keys as input but translated values",
                    },
                  },
                  required: ["translated_sections"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_translations" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const translated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(translated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
