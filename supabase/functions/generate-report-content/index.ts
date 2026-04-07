import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Fetch relevant knowledge from raqeem_knowledge ───
async function fetchRelevantKnowledge(context: {
  assetType?: string;
  methodology?: string;
  propertyType?: string;
  purposeOfValuation?: string;
}): Promise<string> {
  try {
    const db = supabaseAdmin();
    const { data: docs } = await db
      .from("raqeem_knowledge")
      .select("title_ar, content, category, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!docs || docs.length === 0) return "";

    // Build search terms from context
    const searchTerms = [
      context.assetType,
      context.methodology,
      context.propertyType,
      context.purposeOfValuation,
      "تقرير", "تقييم", "معايير",
    ].filter(Boolean).map(t => t!.toLowerCase());

    // Score each document by relevance
    const scored = docs.map(doc => {
      const text = `${doc.title_ar || ""} ${doc.content || ""} ${doc.category || ""}`.toLowerCase();
      let score = doc.priority || 0;
      for (const term of searchTerms) {
        if (text.includes(term)) score += 10;
      }
      // Boost standards and guidelines
      if (doc.category === "standards" || doc.category === "guidelines") score += 15;
      if (doc.category === "methodology") score += 10;
      return { ...doc, score };
    });

    // Sort by score, take top relevant docs
    scored.sort((a, b) => b.score - a.score);

    // Dynamic truncation: fit within ~30K chars total
    const MAX_CHARS = 30000;
    let totalChars = 0;
    const selected: string[] = [];

    for (const doc of scored) {
      if (doc.score <= 0) break;
      const chunk = `### ${doc.title_ar}\n[${doc.category}]\n${doc.content}`;
      if (totalChars + chunk.length > MAX_CHARS) {
        // Truncate last doc to fit
        const remaining = MAX_CHARS - totalChars;
        if (remaining > 200) {
          selected.push(chunk.substring(0, remaining) + "...");
        }
        break;
      }
      selected.push(chunk);
      totalChars += chunk.length;
    }

    if (selected.length === 0) return "";

    return `\n\n══════ المراجع المهنية والمعايير ══════\nالمصادر التالية مستخرجة من قاعدة المعرفة المعتمدة. استخدمها لتعزيز دقة ومهنية التقرير:\n\n${selected.join("\n\n---\n\n")}`;
  } catch (e) {
    console.error("Knowledge fetch error:", e);
    return "";
  }
}

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
        comparables?: { description: string; value: number; source?: string; reference_number?: string; source_date?: string }[];
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
        discipline?: string;
        machineryInventory?: Array<{ name: string; type: string; value?: number; condition?: string }>;
        realEstateValue?: number;
        machineryValue?: number;
        totalValue?: number;
      };
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch relevant knowledge from the knowledge base
    const knowledgeContext = await fetchRelevantKnowledge(context);

    // Determine discipline
    const discipline = context.discipline || "real_estate";
    const isMixed = discipline === "mixed";
    const isMachinery = discipline === "machinery_equipment";

    // Build discipline-aware system prompt
    let disciplineInstructions = "";
    if (isMachinery) {
      disciplineInstructions = `
هذا تقرير تقييم آلات ومعدات. استخدم المصطلحات الهندسية والميكانيكية المناسبة:
- تكلفة الإحلال الجديد (RCN)، الإهلاك المادي، التقادم الوظيفي، التقادم الاقتصادي
- أساليب التقييم: التكلفة المستبدلة مع الاستهلاك، المقارنة السوقية للمعدات، القيمة الدفترية
- صف الحالة الميكانيكية والكهربائية والهيكلية لكل أصل
- اذكر ساعات التشغيل وسنة الصنع والشركة المصنعة عند توفرها`;
    } else if (isMixed) {
      disciplineInstructions = `
هذا تقرير تقييم مختلط يشمل عقارات وآلات ومعدات معاً.
يجب أن يتضمن التقرير:
1. قسم كامل لتقييم العقارات (أساليب المقارنة/التكلفة/الدخل)
2. قسم كامل لتقييم الآلات والمعدات (التكلفة المستبدلة مع الاستهلاك)
3. ملخص موحد يجمع القيمة الإجمالية = قيمة العقارات + قيمة الآلات والمعدات
- اعرض كل قسم بشكل مستقل مع تفاصيله الكاملة ثم اختم بالقيمة الإجمالية الموحدة`;
    }

    const systemPrompt = `أنت "رقيم" — محرك ذكاء اصطناعي متخصص في كتابة تقارير التقييم باللغة العربية وفقاً لمعايير IVS 2025 والهيئة السعودية للمقيمين المعتمدين (تقييم).
${disciplineInstructions}

══════ معايير التقرير المهني الموحد — قواعد ملزمة ══════

【أسلوب الكتابة】
- اللغة العربية الفصحى المهنية حصراً — لا يُقبل أي أسلوب غير رسمي
- استخدم مصطلحات التقييم المعتمدة (القيمة السوقية، أسلوب المقارنة، التدفقات النقدية المخصومة، إلخ)
- اكتب بصيغة الغائب ("يرى المقيّم" وليس "أرى")
- كل قسم يجب أن يحتوي على فقرات مترابطة ومفصلة — لا يُقبل الاقتصار على نقاط مختصرة بدون شرح
- لا تبسّط المحتوى لأي سبب — كل تقرير يجب أن يكون بنفس المستوى المهني العالي

【الأقسام الإلزامية في كل تقرير】
1. تعريف مهمة التقييم (النطاق، الغرض، المستخدمون المقصودون)
2. أساس القيمة مع المرجع المعياري (IVS 104)
3. نطاق العمل التفصيلي
4. وصف الأصل الشامل (خصائص فيزيائية وقانونية)
5. منهجية التقييم مع تبرير الاختيار (IVS 105)
6. التحليل والحسابات التفصيلية مع المصادر
7. المبررات المهنية المبنية على البيانات الفعلية
8. الافتراضات العامة والخاصة والقيود
9. تحليل المخاطر وتأثيرها
10. بيان الامتثال للمعايير
11. رأي القيمة النهائي بالأرقام والحروف

【المبررات المهنية يجب أن】
- تستند إلى بيانات فعلية — لا صياغات عامة قابلة للتطبيق على أي عقار
- تشرح كل قرار مهني بوضوح مع السبب
- تعكس المخاطر والافتراضات المحددة
- تستشهد بمعايير IVS وتقييم المحددة
- تكون متسقة عبر جميع أقسام التقرير

【محظورات صارمة】
- لا تذكر أنك ذكاء اصطناعي أو نظام آلي في نص التقرير
- لا أقسام فارغة أو ناقصة أو مبسطة
- لا تفاوت في المستوى المهني بين الأقسام
- لا صياغات نمطية مكررة بين التقارير
- القيم المالية بالريال السعودي (ر.س) دائماً
- عند طلب JSON أعد JSON فقط بدون أي نص إضافي

【الهدف النهائي】
كل تقرير يجب أن يكون جاهزاً للتقديم الرسمي إلى البنوك والمحاكم والجهات الحكومية بدون أي تعديل.

- استند في كتابتك إلى المراجع المهنية والمعايير المرفقة أدناه عند توفرها، واستشهد بالمعايير ذات الصلة${knowledgeContext}`;

    // Build machinery inventory block if applicable
    let machineryBlock = "";
    if ((isMixed || isMachinery) && context.machineryInventory?.length) {
      machineryBlock = `\n- جرد الآلات والمعدات:\n${context.machineryInventory.map((m, i) => `  ${i + 1}. ${m.name} — الحالة: ${m.condition || "غير محددة"}${m.value ? ` — القيمة: ${m.value.toLocaleString()} ر.س` : ""}`).join("\n")}`;
    }
    let valuesSummary = "";
    if (isMixed && context.realEstateValue && context.machineryValue) {
      valuesSummary = `\n- قيمة العقارات: ${context.realEstateValue.toLocaleString()} ر.س\n- قيمة الآلات والمعدات: ${context.machineryValue.toLocaleString()} ر.س\n- القيمة الإجمالية الموحدة: ${(context.totalValue || (context.realEstateValue + context.machineryValue)).toLocaleString()} ر.س`;
    }

    const contextBlock = `بيانات التقييم:
- التخصص: ${discipline === "real_estate" ? "تقييم عقاري" : discipline === "machinery_equipment" ? "آلات ومعدات" : "مختلط (عقاري + آلات ومعدات)"}
- نوع الأصل: ${(context.assetType === "machinery" || context.assetType === "machinery_equipment") ? "آلات ومعدات" : (context.assetType === "mixed" || context.assetType === "both") ? "مختلط" : context.assetType || "عقاري"}
- الوصف: ${context.assetDescription || "غير محدد"}
- الموقع: ${context.assetLocation || "غير محدد"}
- المدينة: ${context.assetCity || "غير محددة"}
- نوع العقار: ${context.propertyType || "سكني"}
- المنهجية: ${context.methodology || "أسلوب المقارنة"}
- القيمة المقدرة: ${context.estimatedValue ? context.estimatedValue.toLocaleString() + " ر.س" : "غير محددة"}${valuesSummary}
- العميل: ${context.clientName || "غير محدد"}
- رقم الهوية: ${context.clientIdNumber || "غير محدد"}
- غرض التقييم: ${context.purposeOfValuation || "تقدير القيمة السوقية"}
- مساحة الأرض: ${context.landArea || "غير محددة"} م²
- مساحة البناء: ${context.buildingArea || "غير محددة"} م²
- نوع الملكية: ${context.ownershipType || "ملكية حرة"}
- تاريخ المعاينة: ${context.inspectionDate || "غير محدد"}
- تاريخ التقييم: ${context.valuationDate || "غير محدد"}
- الرقم المرجعي: ${context.referenceNumber || "غير محدد"}${machineryBlock}
${context.inspectionSummary ? "- ملخص المعاينة: " + context.inspectionSummary : ""}
${context.comparables?.length ? "- المقارنات:\n" + context.comparables.map((c, i) => `  ${i + 1}. ${c.description} — ${c.value.toLocaleString()} ر.س${c.source ? " (المصدر: " + c.source + ")" : ""}${c.reference_number ? " [رقم المرجع: " + c.reference_number + "]" : ""}${c.source_date ? " [تاريخ المصدر: " + c.source_date + "]" : ""}`).join("\n") : ""}\n\nملاحظة مهمة: يجب ذكر مصدر كل مقارنة بوضوح في التقرير وفقاً لمتطلبات IVS 2025 ومعايير تقييم. عند الإشارة إلى المقارنات في قسم التحليل والحسابات، اذكر اسم المصدر وتاريخ الحصول على البيانات ورقم المرجع إن وُجد.`;

    let userPrompt = "";
    let useToolCalling = false;

    if (mode === "structured_sections") {
      useToolCalling = true;
      let requestedKeys: string[];
      if (isMachinery) {
        requestedKeys = sectionKeys || [
          "purpose", "scope", "machinery_inventory", "market", 
          "machinery_approaches", "machinery_calculations", "reconciliation", "assumptions", "compliance"
        ];
      } else if (isMixed) {
        requestedKeys = sectionKeys || [
          "purpose", "scope", "property_desc", "market", "hbu",
          "approaches", "calculations",
          "machinery_inventory", "machinery_approaches", "machinery_calculations",
          "unified_summary", "reconciliation", "assumptions", "compliance"
        ];
      } else {
        requestedKeys = sectionKeys || [
          "purpose", "scope", "property_desc", "market", "hbu",
          "approaches", "calculations", "reconciliation", "assumptions", "compliance"
        ];
      }

      let extraInstructions = "";
      if (isMixed) {
        extraInstructions = `\nمهم: قسم unified_summary يجب أن يتضمن جدولاً يجمع: قيمة العقارات + قيمة الآلات والمعدات = القيمة الإجمالية الموحدة.`;
      }

      userPrompt = `بناءً على البيانات التالية، قم بتوليد محتوى مهني كامل لأقسام تقرير التقييم المطلوبة.

${contextBlock}

الأقسام المطلوبة: ${requestedKeys.join(", ")}
${extraInstructions}
لكل قسم، اكتب محتوى مهنياً مفصلاً باللغة العربية والإنجليزية.
استند إلى المعايير والمراجع المرفقة في system prompt لتعزيز المحتوى.`;
    } else if (mode === "full_report") {
      if (isMixed) {
        userPrompt = `قم بتوليد تقرير تقييم مختلط (عقاري + آلات ومعدات) يشمل الأقسام التالية:

**القسم الأول: تقييم العقارات**
1. الملخص التنفيذي للعقارات
2. وصف العقار والموقع
3. تحليل السوق العقاري
4. الاستخدام الأعلى والأفضل
5. أساليب التقييم العقاري (المقارنة / التكلفة / الدخل)
6. التحليل والحسابات العقارية
7. رأي القيمة للعقارات

**القسم الثاني: تقييم الآلات والمعدات**
1. ملخص جرد الآلات والمعدات
2. وصف تفصيلي لكل أصل (الشركة المصنعة، الموديل، سنة الصنع، الحالة)
3. أساليب التقييم المستخدمة (التكلفة المستبدلة مع الاستهلاك)
4. حسابات الإهلاك والتقادم لكل أصل
5. رأي القيمة للآلات والمعدات

**القسم الثالث: الملخص الموحد**
1. جدول ملخص القيم (عقارات + آلات = الإجمالي)
2. التسوية والمطابقة النهائية
3. الرأي النهائي في القيمة الإجمالية
4. الافتراضات والشروط المقيّدة
5. بيان الامتثال
6. التوصيات

${contextBlock}

اكتب كل قسم بعنوان واضح ومحتوى مهني مفصّل. اختم بالقيمة الإجمالية الموحدة.
استند إلى المعايير والمراجع المرفقة في system prompt لتعزيز المحتوى.`;
      } else if (isMachinery) {
        userPrompt = `قم بتوليد تقرير تقييم آلات ومعدات كامل يشمل جميع الأقسام:
1. الملخص التنفيذي
2. جرد ووصف الآلات والمعدات (جدول تفصيلي: الاسم، الشركة المصنعة، الموديل، سنة الصنع، الرقم التسلسلي، الحالة)
3. تحليل السوق للمعدات المماثلة
4. المنهجية المتبعة (التكلفة المستبدلة مع الاستهلاك / المقارنة السوقية / القيمة الدفترية)
5. حسابات الإهلاك: المادي والوظيفي والاقتصادي لكل أصل
6. التسوية والمطابقة
7. الرأي النهائي في القيمة
8. الافتراضات والشروط المقيّدة
9. بيان الامتثال
10. التوصيات

${contextBlock}

اكتب كل قسم بعنوان واضح ومحتوى مهني مفصّل ومتسق.
استند إلى المعايير والمراجع المرفقة في system prompt لتعزيز المحتوى.`;
      } else {
        userPrompt = `قم بتوليد تقرير تقييم عقاري كامل يشمل جميع الأقسام:
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

اكتب كل قسم بعنوان واضح ومحتوى مهني مفصّل ومتسق.
استند إلى المعايير والمراجع المرفقة في system prompt لتعزيز المحتوى.`;
      }
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

اكتب محتوى مهنياً مفصلاً لهذا القسم فقط، بالعربية.
استند إلى المعايير والمراجع المرفقة في system prompt لتعزيز المحتوى.`;
    } else if (mode === "review") {
      userPrompt = `راجع النص التالي من تقرير تقييم عقاري وقدّم:
1. **تحليل الجودة**: تقييم شامل (الدقة المهنية، الامتثال لـ IVS 2025، المصطلحات)
2. **التحسينات المقترحة**: قائمة مرقمة بالتعديلات مع السبب
3. **النص المحسّن**: أعد كتابة النص بالكامل بعد تطبيق التحسينات

استند إلى المعايير والمراجع المرفقة في system prompt عند المراجعة.

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
