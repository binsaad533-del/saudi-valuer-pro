import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "full_report" | "section" | "review" | "structured_sections";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode, sectionKey, sectionKeys, existingText, context } = body as {
      mode: Mode;
      sectionKey?: string;
      sectionKeys?: string[];
      existingText?: string;
      context: {
        assetType?: string;
        assetDescription?: string;
        assetLocation?: string;
        assetCity?: string;
        methodology?: string;
        estimatedValue?: number;
        comparables?: { description: string; value: number; source?: string }[];
        inspectionSummary?: string;
        clientName?: string;
        clientIdNumber?: string;
        purposeOfValuation?: string;
        landArea?: string;
        buildingArea?: string;
        propertyType?: string;
        ownershipType?: string;
        inspectionDate?: string;
        valuationDate?: string;
        referenceNumber?: string;
      };
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `أنت "رقيم" — محرك ذكاء اصطناعي متخصص في كتابة تقارير التقييم العقاري باللغة العربية وفقاً لمعايير IVS 2025 والهيئة السعودية للمقيمين المعتمدين (تقييم).

قواعد صارمة:
- اكتب بالعربية الفصحى المهنية فقط
- استخدم مصطلحات التقييم المعتمدة (القيمة السوقية، أسلوب المقارنة، التدفقات النقدية المخصومة، إلخ)
- التزم بهيكل التقرير المعتمد من هيئة تقييم
- لا تذكر أنك ذكاء اصطناعي أو نظام آلي في نص التقرير
- القيم المالية بالريال السعودي (ر.س)
- اكتب بصيغة الغائب ("يرى المقيّم" وليس "أرى")
- عند طلب JSON أعد JSON فقط بدون أي نص إضافي`;

    const contextBlock = `بيانات التقييم:
- نوع الأصل: ${context.assetType || "عقاري"}
- الوصف: ${context.assetDescription || "غير محدد"}
- الموقع: ${context.assetLocation || "غير محدد"}
- المدينة: ${context.assetCity || "غير محددة"}
- نوع العقار: ${context.propertyType || "سكني"}
- المنهجية: ${context.methodology || "أسلوب المقارنة"}
- القيمة المقدرة: ${context.estimatedValue ? context.estimatedValue.toLocaleString() + " ر.س" : "غير محددة"}
- العميل: ${context.clientName || "غير محدد"}
- رقم الهوية: ${context.clientIdNumber || "غير محدد"}
- غرض التقييم: ${context.purposeOfValuation || "تقدير القيمة السوقية"}
- مساحة الأرض: ${context.landArea || "غير محددة"} م²
- مساحة البناء: ${context.buildingArea || "غير محددة"} م²
- نوع الملكية: ${context.ownershipType || "ملكية حرة"}
- تاريخ المعاينة: ${context.inspectionDate || "غير محدد"}
- تاريخ التقييم: ${context.valuationDate || "غير محدد"}
- الرقم المرجعي: ${context.referenceNumber || "غير محدد"}
${context.inspectionSummary ? "- ملخص المعاينة: " + context.inspectionSummary : ""}
${context.comparables?.length ? "- المقارنات:\n" + context.comparables.map((c, i) => `  ${i + 1}. ${c.description} — ${c.value.toLocaleString()} ر.س${c.source ? " (المصدر: " + c.source + ")" : ""}`).join("\n") : ""}`;

    let userPrompt = "";
    let useToolCalling = false;

    if (mode === "structured_sections") {
      useToolCalling = true;
      const requestedKeys = sectionKeys || [
        "purpose", "scope", "property_desc", "market", "hbu",
        "approaches", "calculations", "reconciliation", "assumptions", "compliance"
      ];
      userPrompt = `بناءً على البيانات التالية، قم بتوليد محتوى مهني كامل لأقسام تقرير التقييم المطلوبة.

${contextBlock}

الأقسام المطلوبة: ${requestedKeys.join(", ")}

لكل قسم، اكتب محتوى مهنياً مفصلاً باللغة العربية والإنجليزية.`;
    } else if (mode === "full_report") {
      userPrompt = `قم بتوليد تقرير تقييم كامل يشمل جميع الأقسام:
1. الملخص التنفيذي
2. وصف الأصل والعقار
3. تحليل الموقع والسوق
4. الاستخدام الأعلى والأفضل
5. المنهجية المتبعة والأساليب المستخدمة
6. التحليل والحسابات والمقارنات
7. التسوية والمطابقة
8. الرأي النهائي في القيمة
9. الافتراضات والشروط المقيّدة
10. بيان الامتثال
11. التوصيات

${contextBlock}

اكتب كل قسم بعنوان واضح ومحتوى مهني مفصّل ومتسق.`;
    } else if (mode === "section") {
      const sectionNames: Record<string, string> = {
        executive_summary: "الملخص التنفيذي",
        purpose: "الغرض من التقييم والاستخدام المقصود",
        scope: "نطاق العمل",
        property_desc: "وصف العقار",
        legal: "الوصف القانوني والملكية",
        market: "نظرة عامة على السوق",
        hbu: "الاستخدام الأعلى والأفضل",
        approaches: "أساليب التقييم المستخدمة",
        calculations: "الحسابات والتحليل",
        reconciliation: "التسوية والمطابقة والرأي النهائي",
        assumptions: "الافتراضات والشروط المقيّدة",
        compliance: "بيان الامتثال",
        recommendations: "التوصيات",
      };
      const sectionName = sectionNames[sectionKey || ""] || sectionKey;
      userPrompt = `اكتب قسم "${sectionName}" فقط لتقرير تقييم بناءً على البيانات التالية:

${contextBlock}

اكتب محتوى مهنياً مفصلاً لهذا القسم فقط، بالعربية.`;
    } else if (mode === "review") {
      userPrompt = `راجع النص التالي من تقرير تقييم عقاري وقدّم:
1. **تحليل الجودة**: تقييم شامل (الدقة المهنية، الامتثال لـ IVS 2025، المصطلحات)
2. **التحسينات المقترحة**: قائمة مرقمة بالتعديلات مع السبب
3. **النص المحسّن**: أعد كتابة النص بالكامل بعد تطبيق التحسينات

النص الحالي:
---
${existingText}
---`;
    }

    // For structured_sections, use tool calling
    if (useToolCalling) {
      const requestedKeys = sectionKeys || [
        "purpose", "scope", "property_desc", "market", "hbu",
        "approaches", "calculations", "reconciliation", "assumptions", "compliance"
      ];

      const sectionProperties: Record<string, any> = {};
      for (const key of requestedKeys) {
        sectionProperties[`${key}_ar`] = { type: "string", description: `محتوى قسم ${key} بالعربية` };
        sectionProperties[`${key}_en`] = { type: "string", description: `Content of ${key} section in English` };
      }

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
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "generate_report_sections",
                  description: "Generate structured report sections in Arabic and English",
                  parameters: {
                    type: "object",
                    properties: {
                      sections: {
                        type: "object",
                        properties: sectionProperties,
                        required: Object.keys(sectionProperties),
                      },
                      final_value_text_ar: { type: "string", description: "القيمة النهائية مكتوبة بالحروف العربية" },
                      final_value_text_en: { type: "string", description: "Final value written in English words" },
                    },
                    required: ["sections"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "generate_report_sections" } },
          }),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام خدمات الذكاء الاصطناعي." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const t = await response.text();
        console.error("AI gateway error:", status, t);
        return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "لم يتم توليد البيانات المهيكلة" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let parsed;
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        return new Response(JSON.stringify({ error: "خطأ في تحليل البيانات المهيكلة" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ structured: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For streaming modes
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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام خدمات الذكاء الاصطناعي." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-report-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
