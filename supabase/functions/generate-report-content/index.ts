import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "full_report" | "section" | "review";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { mode, sectionKey, existingText, context } = (await req.json()) as {
      mode: Mode;
      sectionKey?: string;
      existingText?: string;
      context: {
        assetType?: string;
        assetDescription?: string;
        assetLocation?: string;
        methodology?: string;
        estimatedValue?: number;
        comparables?: { description: string; value: number }[];
        inspectionSummary?: string;
        clientName?: string;
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
- اكتب بصيغة الغائب ("يرى المقيّم" وليس "أرى")`;

    let userPrompt = "";

    if (mode === "full_report") {
      userPrompt = `قم بتوليد تقرير تقييم كامل يشمل الأقسام التالية:
1. الملخص التنفيذي
2. وصف الأصل
3. تحليل الموقع والسوق
4. المنهجية المتبعة
5. التحليل والمقارنات
6. التقييم والقيمة المقدرة
7. الافتراضات والشروط المقيّدة
8. التوصيات

بيانات الأصل:
- النوع: ${context.assetType || "عقاري"}
- الوصف: ${context.assetDescription || "غير محدد"}
- الموقع: ${context.assetLocation || "غير محدد"}
- المنهجية: ${context.methodology || "أسلوب المقارنة"}
- القيمة المقدرة: ${context.estimatedValue ? context.estimatedValue.toLocaleString() + " ر.س" : "غير محددة"}
- العميل: ${context.clientName || "غير محدد"}
${context.inspectionSummary ? "- ملخص المعاينة: " + context.inspectionSummary : ""}
${context.comparables?.length ? "- المقارنات:\n" + context.comparables.map((c, i) => `  ${i + 1}. ${c.description} — ${c.value.toLocaleString()} ر.س`).join("\n") : ""}

اكتب كل قسم بعنوان واضح ومحتوى مهني مفصّل.`;
    } else if (mode === "section") {
      const sectionNames: Record<string, string> = {
        executive_summary: "الملخص التنفيذي",
        asset_description: "وصف الأصل",
        market_analysis: "تحليل السوق",
        methodology: "المنهجية المتبعة",
        valuation: "التقييم والقيمة",
        assumptions: "الافتراضات والشروط المقيّدة",
        recommendations: "التوصيات",
      };
      const sectionName = sectionNames[sectionKey || ""] || sectionKey;
      userPrompt = `اكتب قسم "${sectionName}" فقط لتقرير تقييم بناءً على البيانات التالية:
- النوع: ${context.assetType || "عقاري"}
- الوصف: ${context.assetDescription || "غير محدد"}
- الموقع: ${context.assetLocation || "غير محدد"}
- المنهجية: ${context.methodology || "أسلوب المقارنة"}
- القيمة المقدرة: ${context.estimatedValue ? context.estimatedValue.toLocaleString() + " ر.س" : "غير محددة"}
${context.comparables?.length ? "- المقارنات:\n" + context.comparables.map((c, i) => `  ${i + 1}. ${c.description} — ${c.value.toLocaleString()} ر.س`).join("\n") : ""}

اكتب محتوى مهنياً مفصلاً لهذا القسم فقط.`;
    } else if (mode === "review") {
      userPrompt = `راجع النص التالي من تقرير تقييم عقاري وقدّم:
1. **تحليل الجودة**: تقييم شامل للنص من حيث الدقة المهنية والامتثال لمعايير IVS 2025
2. **التحسينات المقترحة**: قائمة بالتعديلات المطلوبة مع شرح السبب
3. **النص المحسّن**: أعد كتابة النص بالكامل بعد تطبيق التحسينات

النص الحالي:
---
${existingText}
---`;
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
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام خدمات الذكاء الاصطناعي." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
