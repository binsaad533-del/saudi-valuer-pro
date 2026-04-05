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
    const payload = await req.json();
    const {
      asset,
      valuation,
      methods,
      adjustments,
      confidence,
      risks,
      compliance,
      assumptions,
      section,
    } = payload;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `أنت كاتب تقارير تقييم مهني سعودي معتمد من الهيئة السعودية للمقيّمين المعتمدين (تقييم) وعضو RICS. تكتب مبررات مهنية عالية الجودة باللغة العربية.

══════ معايير الكتابة المهنية الموحدة ══════

【القواعد الملزمة】
- اكتب بأسلوب مهني رسمي يليق بتقارير التقييم المعتمدة — لا تبسيط ولا اختصار
- استخدم البيانات الفعلية المقدمة فقط — لا تخترع أرقاماً أو حقائق
- كن محدداً وغير عام — اذكر تفاصيل العقار والأرقام والمواقع الفعلية
- لا تناقض نتائج التقييم أو حالة الامتثال
- نوّع الصياغة — لا تكرر نفس القوالب بين التقارير المختلفة
- اكتب فقرات مترابطة ومفصلة وليس نقاطاً مختصرة
- التزم بمعايير IVS 2025 وتقييم واستشهد بأرقام المعايير المحددة (مثال: IVS 104.20)

【المبررات يجب أن】
- تستند إلى البيانات والأرقام الفعلية من الطلب
- تشرح كل قرار مهني بوضوح مع السبب المحدد
- تعكس المخاطر المكتشفة والافتراضات المعتمدة
- تكون متسقة مع باقي أقسام التقرير
- تكون جاهزة للتقديم الرسمي إلى البنوك والمحاكم والجهات الرقابية

【محظورات】
- لا صياغات عامة قابلة للتطبيق على أي عقار
- لا ملخصات مختصرة أو سطحية
- لا تبسيط بناءً على نوع العميل أو الغرض`;

    const contextBlock = `
بيانات الأصل:
${JSON.stringify(asset, null, 2)}

نتائج التقييم:
${JSON.stringify(valuation, null, 2)}

المنهجيات المستخدمة:
${JSON.stringify(methods, null, 2)}

التعديلات المطبقة:
${JSON.stringify(adjustments, null, 2)}

مؤشر الثقة: ${confidence?.overall ?? "غير محسوب"}% (${confidence?.level ?? ""})

المخاطر المكتشفة:
${JSON.stringify(risks, null, 2)}

حالة الامتثال: ${compliance?.passed ? "ناجح" : "يوجد مخالفات"}

الافتراضات:
${JSON.stringify(assumptions, null, 2)}
`;

    const sectionPrompts: Record<string, string> = {
      method_selection: `اكتب مبرر مهني لاختيار منهجية التقييم المستخدمة. اشرح لماذا هذه المنهجية هي الأنسب لهذا النوع من الأصول وهذا الغرض من التقييم.`,
      data_assessment: `اكتب تقييماً مهنياً لجودة البيانات المتوفرة. اذكر نقاط القوة والقصور في البيانات ومدى كفايتها للوصول إلى قيمة موثوقة.`,
      adjustments: `اشرح التعديلات المطبقة على المقارنات أو الحسابات ولماذا كانت ضرورية. اربط كل تعديل بالفروقات الفعلية.`,
      reconciliation: `اكتب مبرر المصالحة بين نتائج المنهجيات المختلفة وكيف تم الوصول للقيمة النهائية. اشرح أوزان كل منهجية.`,
      risk_commentary: `اكتب تعليقاً مهنياً على المخاطر المؤثرة في التقييم وكيف تم مراعاتها في الوصول للقيمة النهائية.`,
      assumptions: `اشرح الافتراضات المستخدمة في التقييم ولماذا هي معقولة ومبررة في ظل ظروف السوق الحالية.`,
    };

    const sectionKey = section || "method_selection";
    const userPrompt = `${sectionPrompts[sectionKey] || sectionPrompts.method_selection}

${contextBlock}

اكتب الناتج كفقرات مهنية متصلة (3-5 فقرات). لا تستخدم عناوين أو نقاط.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار في استخدام الذكاء الاصطناعي" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ text, section: sectionKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("justification error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
